import { useEffect, useRef } from 'react';
import { useStore } from './useStore';
import { lookupCard, getCachedCard } from '../utils/api';
import { cardKey } from '../utils/cards';

// Pass a single deck, an array of decks, or null to enrich all decks in state.
export function useEnrich(deckOrDecks) {
  const { state, dispatch } = useStore();
  const runningRef = useRef(false);

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
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
