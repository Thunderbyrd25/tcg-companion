import { useEffect, useRef } from 'react';
import { useStore } from './useStore';
import { lookupCard, getCachedCard, fetchReprintsForLegality, fetchAllPrints } from '../utils/api';
import { cardKey, checkEraLegality, effectiveRegMark, STANDARD_MIN_MARK, getEraMinMark } from '../utils/cards';

// Pass a single deck, an array of decks, or null to enrich all decks in state.
export function useEnrich(deckOrDecks) {
  const { state, dispatch } = useStore();
  const runningRef = useRef(false);
  const reprintChecked = useRef(new Set());     // Standard reprint checks
  const eraReprintChecked = useRef(new Set()); // Era reprint checks: "eraLabel||name"

  // Effect 1: fetch card API data for cards not yet in cache
  useEffect(() => {
    const decks = deckOrDecks == null
      ? state.decks
      : Array.isArray(deckOrDecks) ? deckOrDecks : [deckOrDecks];

    if (!decks.length || runningRef.current) return;

    const seen = new Set();
    const preloaded = {};  // cards already in localStorage cache
    const toFetch = [];    // cards that need an API call

    for (const deck of decks) {
      for (const rc of deck.rawCards) {
        if (!rc.setCode || !rc.num) continue;
        const ck = cardKey(rc);
        if (seen.has(ck) || (state.apiCache[ck] !== undefined && state.apiCache[ck] !== null)) continue;
        seen.add(ck);

        const cached = getCachedCard(rc.setCode, rc.num);
        if (cached !== undefined && cached !== null) {
          preloaded[ck] = cached;
        } else {
          // null means a previous lookup failed; retry in case it was a transient/bug-caused failure
          toFetch.push(rc);
        }
      }
    }

    // Immediately hydrate React state from localStorage cache (single dispatch, no API calls)
    if (Object.keys(preloaded).length) {
      dispatch({ type: 'SET_API_DATA', updates: preloaded });
    }

    if (!toFetch.length) return;

    runningRef.current = true;

    (async () => {
      const BATCH = 5;
      const allUpdates = {};
      for (let i = 0; i < toFetch.length; i += BATCH) {
        const batch = toFetch.slice(i, i + BATCH);
        await Promise.all(batch.map(async rc => {
          const data = await lookupCard(rc.setCode, rc.num, rc.name);
          allUpdates[cardKey(rc)] = data;
        }));
        // Dispatch every 30 cards for progressive loading without too many re-renders
        if ((i + BATCH) % 30 === 0 || i + BATCH >= toFetch.length) {
          dispatch({ type: 'SET_API_DATA', updates: { ...allUpdates } });
        }
        if (i + BATCH < toFetch.length) await sleep(200);
      }
      runningRef.current = false;
    })();
  }, [deckOrDecks == null ? state.decks.length : JSON.stringify((Array.isArray(deckOrDecks) ? deckOrDecks : [deckOrDecks]).map(d => d?.id))]);

  // Effect 2: once card data is loaded, fetch standard-legal reprints for any card that
  // isn't explicitly legal (e.g. old Prism Energy whose legal reprint isn't in the deck).
  // Runs whenever apiCache grows so it catches both freshly fetched and preloaded cards.
  // reprintChecked prevents redundant API calls even across re-renders.
  useEffect(() => {
    const decks = deckOrDecks == null
      ? state.decks
      : Array.isArray(deckOrDecks) ? deckOrDecks : [deckOrDecks];

    for (const deck of decks) {
      if (deck.format !== 'Standard') continue;
      for (const rc of deck.rawCards) {
        if (!rc.setCode || !rc.num) continue;
        const data = state.apiCache[cardKey(rc)];
        if (!data) continue;
        if (data.supertype === 'Energy' && data.subtypes?.includes('Basic')) continue;
        // Skip only if this specific print is directly H+ legal (no rotated reg mark).
        // If the API says Legal but the print has a D/E/F/G mark, the legality comes from
        // a reprint we haven't cached yet — we still need to fetch it for hasLegalStdReprint.
        const rm = effectiveRegMark(data.setCode, data.regulationMark);
        // Skip only if this print has a current-era mark — it's directly legal, no reprint needed.
        // Process both rotated-mark (e.g. G) and no-mark (old BW/XY/SM) cards so their
        // legal reprints get fetched into apiCache for hasLegalStdReprint to find.
        if (rm && rm >= STANDARD_MIN_MARK) continue;

        const rk = `${data.name}||${(data.subtypes || []).slice().sort().join(',')}`;
        if (reprintChecked.current.has(rk)) continue;
        reprintChecked.current.add(rk);

        // Fire-and-forget: fetch any standard-legal reprint and add it to apiCache
        fetchReprintsForLegality(data.name, { subtypes: data.subtypes, hp: data.hp, attacks: data.attacks }).then(reprints => {
          if (!reprints.length) return;
          const updates = {};
          for (const r of reprints) updates[`${r.name}||${r.setCode}||${r.number}`] = r;
          dispatch({ type: 'SET_API_DATA', updates });
        });
      }
    }
  }, [Object.keys(state.apiCache).length]);

  // Effect 3: for Era format decks, fetch all prints of cards that sit outside the
  // era range so checkLegality can find era-legal reprints (e.g. N in Dark Explorers
  // is outside BCR-ROS but the Fates Collide reprint is inside the range).
  useEffect(() => {
    const decks = deckOrDecks == null
      ? state.decks
      : Array.isArray(deckOrDecks) ? deckOrDecks : [deckOrDecks];

    for (const deck of decks) {
      if (deck.format !== 'Era' || !deck.eraLabel) continue;
      for (const rc of deck.rawCards) {
        if (!rc.setCode || !rc.num) continue;
        const data = state.apiCache[cardKey(rc)];
        if (!data) continue;
        if (data.supertype === 'Energy' && data.subtypes?.includes('Basic')) continue;
        // Skip only if directly legal: set in range AND (no reg-mark era, or mark is legal)
        if (checkEraLegality(rc, deck.eraLabel).legal) {
          const eraMinMark = getEraMinMark(deck.eraLabel);
          if (!eraMinMark || (data.regulationMark && data.regulationMark >= eraMinMark)) continue;
        }

        const rk = `${deck.eraLabel}||${data.name}`;
        if (eraReprintChecked.current.has(rk)) continue;
        eraReprintChecked.current.add(rk);

        // Fetch all prints; add any that fall within the era range to apiCache so
        // checkLegality's era-reprint check can find them.
        fetchAllPrints(data.name, { loose: true }).then(prints => {
          const updates = {};
          for (const p of prints) {
            if (!p.setCode) continue;
            if (checkEraLegality({ setCode: p.setCode, num: p.number }, deck.eraLabel).legal) {
              updates[`${p.name}||${p.setCode}||${p.number}`] = p;
            }
          }
          if (Object.keys(updates).length) dispatch({ type: 'SET_API_DATA', updates });
        });
      }
    }
  }, [Object.keys(state.apiCache).length]);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
