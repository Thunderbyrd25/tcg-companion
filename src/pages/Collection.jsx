import { useState, useMemo, useEffect, useRef } from 'react';
import { useStore } from '../hooks/useStore';
import { cardKey, getSection, supertypeToSection, checkLegality, checkEraLegality, effectiveRegMark, STANDARD_MIN_MARK, getEraMinMark } from '../utils/cards';

import { parseRawLines } from '../utils/cards';
import { useToast } from '../components/Toast';
import { ALL_SETS } from '../data/sets';
const SET_ID_TO_CODE = Object.fromEntries(ALL_SETS.filter(s => s.id).map(s => [s.id, s.code]));
import prizePackLookup from '../data/prizePackLookup.json';
import { ERA_FORMATS, ERA_GROUPS } from '../data/eras';
import { searchCards, searchByName, fetchSetsMetadata, fetchAllPrints, fetchPrizePackPrice, getCachedSetStats, fetchTCGDexSet, TCGDEX_SET_TOTALS, fetchReprintsForLegality } from '../utils/api';
import DeckCard from '../components/DeckCard';
import DeckModal from '../components/DeckModal';
import CardInfoModal from '../components/CardInfoModal';

const TABS = ['Cards', 'Sets', 'Decks', 'Wishlist'];
const CARDS_PER_PAGE = 100;

// Sum all variant counts; handles both old number format and new object format
function collQty(val) {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  return Object.values(val).reduce((s, v) => s + (v || 0), 0);
}

// Mirrors useStore's sumOwnedArr — handles both old integer and new per-copy boolean array formats
function sumOwnedArr(val, qty) {
  if (Array.isArray(val)) return val.slice(0, qty).reduce((s, v) => s + (v || 0), 0);
  return Math.min(qty, Math.max(0, val || 0));
}

// Adjust the standalone 'normal' collection qty for a card by delta
function adjustCollectionQty(rc, delta, state, dispatch) {
  const ck = cardKey(rc);
  const cur = state.collection[ck];
  if (cur && typeof cur === 'object') {
    dispatch({ type: 'SET_COLLECTION', collection: { ...state.collection, [ck]: { ...cur, normal: Math.max(0, (cur.normal || 0) + delta) } } });
  } else {
    dispatch({ type: 'SET_COLLECTION', collection: { ...state.collection, [ck]: Math.max(0, (typeof cur === 'number' ? cur : 0) + delta) } });
  }
}

// Inline quantity stepper bar — used in both Cards (collector view) and Sets section
function QtyBar({ rc, state, dispatch, style }) {
  const qty = collQty(state.collection[cardKey(rc)]);
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '5px 8px', borderTop: '1px solid var(--card-border)', background: 'var(--pill)', ...style }}
      onClick={e => e.stopPropagation()}
    >
      <button className="btn btn-ghost btn-xs" style={{ width: 24, height: 24, padding: 0, fontSize: 15, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => adjustCollectionQty(rc, -1, state, dispatch)}>−</button>
      <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 12, minWidth: 22, textAlign: 'center', color: qty > 0 ? 'var(--green)' : 'var(--muted)' }}>×{qty}</span>
      <button className="btn btn-ghost btn-xs" style={{ width: 24, height: 24, padding: 0, fontSize: 15, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => adjustCollectionQty(rc, 1, state, dispatch)}>+</button>
    </div>
  );
}

const VARIANTS = [
  // Standard treatments
  { key: 'normal',        label: 'Normal' },
  { key: 'reverseHolo',   label: 'Reverse Holo' },
  { key: 'cosmoHolo',     label: 'Cosmos Holo' },
  // SWSH alternate foil treatments
  { key: 'pokeball',      label: 'Poké Ball Holo' },
  { key: 'masterball',    label: 'Master Ball Holo' },
  // Classic-era edition variants (Base Set, Jungle, Fossil, etc.)
  { key: 'firstEdHolo',   label: '1st Ed. Holofoil' },
  { key: 'firstEdNormal', label: '1st Ed. Non-Holo' },
  { key: 'unlimHolo',     label: 'Unlimited Holofoil' },
  { key: 'unlimNormal',   label: 'Unlimited Non-Holo' },
  // Promo / stamped
  { key: 'prizestamped',  label: 'Prize Stamped' },
  { key: 'prerelease',    label: 'Pre-Release' },
  { key: 'gymstamped',    label: 'Gym / League Stamped' },
  { key: 'worldchamp',    label: 'World Championship' },
];

export default function Collection({ onOpenDeck }) {
  const { state, dispatch, getApiData, getDeckOwned } = useStore();
  const [tab, setTab] = useState('Cards');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [collectionCard, setCollectionCard] = useState(null); // { rc, own, api, decks }
  const [importOpen, setImportOpen] = useState(false);
  const toast = useToast();

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 24, fontWeight: 800, letterSpacing: .4, color: 'var(--yellow)' }}>Collection</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setImportOpen(true)}>Import</button>
          <button className="btn btn-ghost btn-sm" onClick={() => exportCollection(state, getDeckOwned)}>Export</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, background: 'var(--dark)', borderRadius: 10, padding: 5, marginBottom: 18 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: 8, border: 'none', borderRadius: 7,
            fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 12, cursor: 'pointer',
            background: tab === t ? 'var(--yellow)' : 'transparent',
            color: tab === t ? 'var(--dark)' : 'var(--muted)', transition: 'all .2s',
          }}>{t}</button>
        ))}
      </div>

      {tab === 'Cards' && (
        <CardsTab
          search={search} setSearch={setSearch}
          typeFilter={typeFilter} setTypeFilter={setTypeFilter}
          state={state} getApiData={getApiData} getDeckOwned={getDeckOwned}
          dispatch={dispatch}
          onCardClick={setCollectionCard}
        />
      )}
      {tab === 'Sets' && <BrowseTab state={state} dispatch={dispatch} getDeckOwned={getDeckOwned} />}
      {tab === 'Decks' && <DecksTab state={state} getApiData={getApiData} getDeckOwned={getDeckOwned} onOpenDeck={onOpenDeck} />}
      {tab === 'Wishlist' && <WishlistTab state={state} dispatch={dispatch} getApiData={getApiData} getDeckOwned={getDeckOwned} onCardClick={setCollectionCard} />}

      {importOpen && <ImportCollectionModal onClose={() => setImportOpen(false)} toast={toast} dispatch={dispatch} state={state} />}

      {collectionCard && (
        <CollectionCardModal
          entry={collectionCard}
          state={state}
          dispatch={dispatch}
          getDeckOwned={getDeckOwned}
          onClose={() => setCollectionCard(null)}
        />
      )}
    </div>
  );
}

// ── Collection Card Modal ─────────────────────────────────────────────────────
function CollectionCardModal({ entry, state, dispatch, getDeckOwned, onClose }) {
  const { rc, own, api } = entry;
  const ck = cardKey(rc);
  const standalone = collQty(state.collection[ck]);

  const deckBreakdown = useMemo(() => {
    return state.decks
      .filter(d => !d.isBuyList)
      .flatMap(d => {
        const owned = getDeckOwned(d, rc);
        const inDeck = d.rawCards.find(c => cardKey(c) === ck);
        if (!inDeck) return [];
        return [{ deck: d, owned, total: inDeck.qty }];
      });
  }, [state.decks, rc, ck]);

  function setStandalone(val) {
    const v = Math.max(0, parseInt(val) || 0);
    const cur = state.collection[ck];
    if (cur && typeof cur === 'object') {
      // Adjust normal to bring total to v, clamped to 0
      const others = collQty(cur) - (cur.normal || 0);
      dispatch({ type: 'SET_COLLECTION', collection: { ...state.collection, [ck]: { ...cur, normal: Math.max(0, v - others) } } });
    } else {
      dispatch({ type: 'SET_COLLECTION', collection: { ...state.collection, [ck]: v } });
    }
  }

  const [showCardInfo, setShowCardInfo] = useState(false);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {api?.imageSmall && (
            <img
              src={api.imageLarge || api.imageSmall}
              alt={rc.name}
              style={{ width: 120, borderRadius: 8, flexShrink: 0, cursor: 'pointer' }}
              onClick={() => setShowCardInfo(true)}
              title="Click for full card info"
            />
          )}
          <div style={{ flex: 1 }}>
            <h3 style={{ marginTop: 0, marginBottom: 4 }}>{rc.name}</h3>
            {api?.setName && <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>{api.setName} · #{api.number || rc.num}</div>}

            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>
              Total owned: <span style={{ color: 'var(--yellow)' }}>×{own}</span>
            </div>

            {deckBreakdown.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>In Decks</div>
                {deckBreakdown.map(({ deck, owned, total }) => (
                  <div key={deck.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--card-border)', fontSize: 12 }}>
                    <span style={{ fontWeight: 700 }}>{deck.name}</span>
                    <span>
                      <span style={{ color: owned >= total ? 'var(--green)' : owned > 0 ? 'var(--orange)' : 'var(--muted)' }}>{owned}</span>
                      <span style={{ color: 'var(--muted)' }}> / {total} in deck</span>
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Standalone (not in any deck)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button className="btn btn-ghost btn-xs" style={{ width: 28, height: 28, padding: 0, justifyContent: 'center', fontSize: 16 }} onClick={() => setStandalone(standalone - 1)}>−</button>
                <input
                  type="number" min={0} value={standalone}
                  onChange={e => setStandalone(e.target.value)}
                  style={{ width: 50, textAlign: 'center', padding: '4px', fontSize: 13, fontWeight: 800 }}
                />
                <button className="btn btn-ghost btn-xs" style={{ width: 28, height: 28, padding: 0, justifyContent: 'center', fontSize: 16 }} onClick={() => setStandalone(standalone + 1)}>+</button>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          {api && <button className="btn btn-ghost" onClick={() => setShowCardInfo(true)}>Card Info</button>}
          {(() => {
            const onWishlist = (state.wishlist || []).some(w => cardKey(w) === ck);
            return (
              <button
                className={`btn btn-sm ${onWishlist ? 'btn-yellow' : 'btn-ghost'}`}
                onClick={() => onWishlist
                  ? dispatch({ type: 'REMOVE_WISHLIST', ck })
                  : dispatch({ type: 'ADD_WISHLIST', item: { name: rc.name, setCode: rc.setCode, num: rc.num, qty: 1 } })
                }
              >
                {onWishlist ? '★ Wishlisted' : '☆ Wishlist'}
              </button>
            );
          })()}
        </div>
      </div>

      {showCardInfo && api && <CardInfoModal card={api} onClose={() => setShowCardInfo(false)} />}
    </div>
  );
}

// ── Cards Tab ─────────────────────────────────────────────────────────────────
// Set order map: older sets = lower index (show first when sorting by set)
const SET_ORDER = (() => {
  const m = {};
  [...ALL_SETS].reverse().forEach((s, i) => { m[s.code] = i; });
  return m;
})();

const FORMAT_FILTERS = ['All', 'Standard', 'Expanded', 'GLC', 'Eternal'];

function CardsTab({ search, setSearch, typeFilter, setTypeFilter, state, getApiData, getDeckOwned, dispatch, onCardClick }) {
  const [sort, setSort] = useState('set');
  const [showUnowned, setShowUnowned] = useState(false);
  const [setFilter, setSetFilter] = useState('');
  const [formatFilter, setFormatFilter] = useState('All');
  const [eraFilter, setEraFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loadingSet, setLoadingSet] = useState(false);
  const [loadedSets, setLoadedSets] = useState(0);
  const [viewMode, setViewMode] = useState('collector'); // 'collector' | 'player'
  const [expandedCards, setExpandedCards] = useState(new Set()); // card names expanded in player view
  const [playerModalGroup, setPlayerModalGroup] = useState(null); // group opened in player modal
  const fetchingRef = useRef(false);
  const fetchedSetsRef = useRef(new Set());
  const reprintChecked = useRef(new Set());

  // Reset to page 1 whenever any filter or sort changes
  useEffect(() => { setPage(1); }, [sort, setFilter, formatFilter, eraFilter, showUnowned, typeFilter, search]);

  // When Standard filter is active, ensure H+ reprints are loaded for any cached card
  // that has a rotated or missing regulation mark — so hasLegalStdReprint can find them.
  useEffect(() => {
    if (formatFilter !== 'Standard') return;
    for (const data of Object.values(state.apiCache)) {
      if (!data?.name || !data.setCode) continue;
      if (data.supertype === 'Energy' && data.subtypes?.includes('Basic')) continue;
      const rm = effectiveRegMark(data.setCode, data.regulationMark);
      if (rm && rm >= STANDARD_MIN_MARK) continue; // already directly legal — no reprint needed
      const rk = `${data.name}||${(data.subtypes || []).slice().sort().join(',')}`;
      if (reprintChecked.current.has(rk)) continue;
      reprintChecked.current.add(rk);
      fetchReprintsForLegality(data.name, { subtypes: data.subtypes, hp: data.hp, attacks: data.attacks })
        .then(reprints => {
          if (!reprints.length) return;
          const updates = {};
          for (const r of reprints) updates[`${r.name}||${r.setCode}||${r.number}`] = r;
          dispatch({ type: 'SET_API_DATA', updates });
        });
    }
  }, [formatFilter, Object.keys(state.apiCache).length]);

  // When an era filter is active, ensure all prints of out-of-range cards are loaded so
  // checkLegality's era reprint check can find era-legal prints (e.g. Base Set Switch is
  // legal in BRS-SCR because Switch exists in BRS).
  const eraReprintChecked = useRef(new Set());
  useEffect(() => {
    if (formatFilter !== 'Era' || !eraFilter) return;
    for (const data of Object.values(state.apiCache)) {
      if (!data?.name || !data.setCode) continue;
      if (data.supertype === 'Energy' && data.subtypes?.includes('Basic')) continue;
      // Skip only if directly legal: set in range AND (pre-mark era, or mark is legal)
      if (checkEraLegality({ setCode: data.setCode, num: data.number }, eraFilter).legal) {
        const eraMinMark = getEraMinMark(eraFilter);
        if (!eraMinMark || (data.regulationMark && data.regulationMark >= eraMinMark)) continue;
      }
      const rk = `${eraFilter}||${data.name}`;
      if (eraReprintChecked.current.has(rk)) continue;
      eraReprintChecked.current.add(rk);
      fetchAllPrints(data.name, { loose: true }).then(prints => {
        const updates = {};
        for (const p of prints) {
          if (!p.setCode) continue;
          if (checkEraLegality({ setCode: p.setCode, num: p.number }, eraFilter).legal) {
            updates[`${p.name}||${p.setCode}||${p.number}`] = p;
          }
        }
        if (Object.keys(updates).length) dispatch({ type: 'SET_API_DATA', updates });
      });
    }
  }, [formatFilter, eraFilter, Object.keys(state.apiCache).length]);

  // When showUnowned is on and a specific set is selected, fetch that set into cache
  useEffect(() => {
    if (!showUnowned || !setFilter) return;
    const setMeta = ALL_SETS.find(s => s.code === setFilter);
    if (!setMeta?.id || fetchedSetsRef.current.has(setFilter)) return;
    let cancelled = false;
    setLoadingSet(true);
    searchCards(null, setMeta.id, 1).then(({ cards }) => {
      if (cancelled) return;
      if (cards.length) {
        const updates = {};
        for (const card of cards) {
          const ck = cardKey({ name: card.name, setCode: card.setCode || setFilter, num: card.number });
          updates[ck] = { ...card, setCode: card.setCode || setFilter };
        }
        dispatch({ type: 'SET_API_DATA', updates });
        fetchedSetsRef.current.add(setFilter);
      }
      setLoadingSet(false);
    }).catch(() => { if (!cancelled) setLoadingSet(false); });
    return () => { cancelled = true; };
  }, [showUnowned, setFilter]);

  // When showUnowned is on with no set filter, fetch ALL sets oldest-first in background
  useEffect(() => {
    if (!showUnowned || setFilter) return;
    if (fetchingRef.current) return;
    const allSetsOldestFirst = [...ALL_SETS].reverse(); // ALL_SETS is newest-first
    const toFetch = allSetsOldestFirst.filter(s => s.id && !fetchedSetsRef.current.has(s.code));
    if (!toFetch.length) return;
    fetchingRef.current = true;
    setLoadingSet(true);
    (async () => {
      const BATCH = 4;
      for (let i = 0; i < toFetch.length; i += BATCH) {
        if (!fetchingRef.current) break; // cancelled (e.g. set filter applied)
        const batch = toFetch.slice(i, i + BATCH);
        await Promise.all(batch.map(async s => {
          try {
            const { cards } = await searchCards(null, s.id, 1);
            if (cards.length) {
              const updates = {};
              for (const card of cards) {
                const ck = cardKey({ name: card.name, setCode: card.setCode || s.code, num: card.number });
                updates[ck] = { ...card, setCode: card.setCode || s.code };
              }
              dispatch({ type: 'SET_API_DATA', updates });
            }
            fetchedSetsRef.current.add(s.code);
          } catch {}
        }));
        setLoadedSets(fetchedSetsRef.current.size);
        if (i + BATCH < toFetch.length) await new Promise(r => setTimeout(r, 250));
      }
      fetchingRef.current = false;
      setLoadingSet(false);
    })();
    return () => { fetchingRef.current = false; };
  }, [showUnowned, setFilter]);

  const deckUsage = useMemo(() => {
    const map = {};        // cardKey -> [deck names]
    const neededMap = {};  // cardKey -> [deck names where more copies are needed]
    const inDecks = {};    // cardKey -> total owned-in-deck copies across all decks
    for (const deck of state.decks) {
      if (deck.isBuyList) continue;
      for (const rc of deck.rawCards) {
        const ck = cardKey(rc);
        if (!map[ck]) map[ck] = [];
        map[ck].push(deck.name);
        const owned = sumOwnedArr(deck.ownedMap?.[ck], rc.qty);
        inDecks[ck] = (inDecks[ck] || 0) + owned;
        if (rc.qty - owned > 0) {
          if (!neededMap[ck]) neededMap[ck] = [];
          if (!neededMap[ck].includes(deck.name)) neededMap[ck].push(deck.name);
        }

        // Also register bling-substituted prints so they show as "in deck".
        // e.g. if the deck lists Charizard ex OBF but the user owns the MEG bling,
        // the MEG print should appear as "in deck", not "not in deck".
        const stored = deck.blingSel?.[ck];
        if (stored) {
          const blings = Array.isArray(stored) ? stored : new Array(rc.qty).fill(stored);
          for (const b of blings) {
            if (!b || (b.setCode === rc.setCode && b.number === rc.num)) continue;
            const altCk = cardKey({ name: rc.name, setCode: b.setCode || '', num: b.number || '' });
            if (!map[altCk]) map[altCk] = [];
            if (!map[altCk].includes(deck.name)) map[altCk].push(deck.name);
          }
        }
      }
    }
    return { map, neededMap, inDecks };
  }, [state.decks]);

  // All cards: owned (own > 0) always shown; unowned deck cards shown if showUnowned
  const allCards = useMemo(() => {
    const seen = {};

    // Helper: normalize blingSel stored value to an array of length qty
    function blingArr(stored, qty) {
      if (!stored) return new Array(qty).fill(null);
      if (!Array.isArray(stored)) return new Array(qty).fill(stored);
      const arr = [...stored];
      while (arr.length < qty) arr.push(null);
      return arr.slice(0, qty);
    }

    for (const deck of state.decks) {
      const owned = deck.ownedMap || {};
      for (const rc of deck.rawCards) {
        const deckCk = cardKey(rc);
        const ownedCount = owned[deckCk] ?? 0;
        const api = getApiData(rc);
        const blings = blingArr(deck.blingSel?.[deckCk], rc.qty);

        // Tally per-print ownership from blingSel
        // A copy is "owned" if its index < ownedCount
        const printOwned = {}; // cardKey -> { rc, api, ownedCount }
        for (let i = 0; i < rc.qty; i++) {
          let b = blings[i];
          // Patch stale bling data that was cached before SET_ID_TO_CODE fallback was added
          if (b && !b.setCode && b.setId) b = { ...b, setCode: SET_ID_TO_CODE[b.setId] || '' };
          const altRc = b && (b.setCode !== rc.setCode || b.number !== rc.num)
            ? { name: rc.name, setCode: b.setCode, num: b.number }
            : rc;
          const altCk = cardKey(altRc);
          if (!printOwned[altCk]) printOwned[altCk] = { rc: altRc, api: b || api, owned: 0 };
          if (i < ownedCount) printOwned[altCk].owned++;
        }

        // Merge into seen
        for (const [altCk, { rc: altRc, api: altApi, owned: altOwned }] of Object.entries(printOwned)) {
          if (!seen[altCk]) seen[altCk] = { rc: altRc, own: 0, api: null };
          seen[altCk].own += altOwned;
          if (!seen[altCk].api && altApi) seen[altCk].api = altApi;
        }

        // Also ensure the base print appears (even if 0 owned) so unowned mode can show it
        if (!seen[deckCk]) seen[deckCk] = { rc, own: 0, api: null };
        if (!seen[deckCk].api && api) seen[deckCk].api = api;
      }
    }
    for (const [ck, qty] of Object.entries(state.collection)) {
      const total = collQty(qty);
      if (total > 0) {
        if (!seen[ck]) {
          const parts = ck.split('||');
          seen[ck] = { rc: { name: parts[0] || ck, setCode: parts[1] || '', num: parts[2] || '' }, own: 0, api: null };
        }
        seen[ck].own += total;
      }
    }
    // Include all apiCache cards so unowned ones are visible when showUnowned is on
    for (const [ck, api] of Object.entries(state.apiCache)) {
      if (!api?.setCode || !api?.number) continue;
      if (seen[ck]) { if (!seen[ck].api) seen[ck].api = api; continue; }
      seen[ck] = { rc: { name: api.name, setCode: api.setCode, num: api.number, qty: 1 }, own: 0, api };
    }
    return Object.values(seen).map(e => ({ ...e, decks: deckUsage.map[cardKey(e.rc)] || [], neededDecks: deckUsage.neededMap[cardKey(e.rc)] || [] }));
  }, [state, getApiData, getDeckOwned, deckUsage]);

  // All sets grouped by era, for the set filter dropdown
  const setsByEra = useMemo(() => {
    const groups = {};
    for (const s of ALL_SETS) {
      if (!groups[s.era]) groups[s.era] = [];
      groups[s.era].push(s);
    }
    return groups;
  }, []);

  const filtered = useMemo(() => allCards.filter(({ rc, own, api }) => {
    if (!showUnowned && own <= 0) return false;
    if (search && !rc.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (setFilter && rc.setCode !== setFilter) return false;
    if (eraFilter) {
      const fakeDeck = { format: 'Era', eraLabel: eraFilter };
      if (!checkLegality({ ...rc, qty: 1 }, fakeDeck, api, state.apiCache).legal) return false;
    }
    if (formatFilter !== 'All') {
      const fakeDeck = { format: formatFilter, eraLabel: eraFilter };
      if (!checkLegality({ ...rc, qty: 1 }, fakeDeck, api, state.apiCache).legal) return false;
    }
    if (typeFilter === 'all') return true;
    const sec = api ? supertypeToSection(api.supertype) : getSection(rc.name, {}, {});
    if (typeFilter === 'pokemon') return sec === 'Pokemon';
    if (typeFilter === 'trainer') return sec === 'Trainer';
    if (typeFilter === 'energy') return sec === 'Energy';
    if (typeFilter === 'in-use') return (deckUsage.map[cardKey(rc)] || []).length > 0;
    if (typeFilter === 'not-in-use') return (deckUsage.map[cardKey(rc)] || []).length === 0;
    return true;
  }), [allCards, showUnowned, search, setFilter, eraFilter, formatFilter, typeFilter, deckUsage]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (sort === 'name') return a.rc.name.localeCompare(b.rc.name);
    if (sort === 'price-desc') return ((b.api?.marketPrice || 0) - (a.api?.marketPrice || 0));
    if (sort === 'price-asc') return ((a.api?.marketPrice || 0) - (b.api?.marketPrice || 0));
    if (sort === 'most-used') return (b.decks.length - a.decks.length) || a.rc.name.localeCompare(b.rc.name);
    if (sort === 'least-used') return (a.decks.length - b.decks.length) || a.rc.name.localeCompare(b.rc.name);
    // 'set': oldest set first, then by card number within set
    if (sort === 'set-new') {
      const setDiff = (SET_ORDER[b.rc.setCode] ?? -1) - (SET_ORDER[a.rc.setCode] ?? -1);
      if (setDiff !== 0) return setDiff;
      return (parseInt(a.rc.num) || 0) - (parseInt(b.rc.num) || 0);
    }
    const setDiff = (SET_ORDER[a.rc.setCode] ?? 999) - (SET_ORDER[b.rc.setCode] ?? 999);
    if (setDiff !== 0) return setDiff;
    return (parseInt(a.rc.num) || 0) - (parseInt(b.rc.num) || 0);
  }), [filtered, sort]);

  // Player view: group by card name, aggregate quantities
  const playerGroups = useMemo(() => {
    if (viewMode !== 'player') return [];
    const groups = new Map();
    for (const entry of sorted) {
      const name = entry.rc.name;
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(entry);
    }
    return [...groups.values()].map(prints => {
      const totalOwn = prints.reduce((s, p) => s + p.own, 0);
      // Display: print with most copies owned (fall back to first in sort order)
      const displayEntry = prints.reduce((best, p) => p.own > best.own ? p : best, prints[0]);
      return { name: prints[0].rc.name, displayEntry, prints, totalOwn };
    });
  }, [sorted, viewMode]);

  function toggleExpand(name) {
    setExpandedCards(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  return (
    <>
      {/* Filter/sort bar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search cards…"
          style={{ flex: 1, minWidth: 160, maxWidth: 260, padding: '8px 14px' }} />

        {/* Type chips */}
        {['all', 'pokemon', 'trainer', 'energy'].map(f => (
          <button key={f} className={`chip ${typeFilter === f ? 'on' : ''}`} onClick={() => setTypeFilter(f)}>
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <button className={`chip ${typeFilter === 'in-use' ? 'on' : ''}`} onClick={() => setTypeFilter(t => t === 'in-use' ? 'all' : 'in-use')}>In Deck</button>
        <button className={`chip ${typeFilter === 'not-in-use' ? 'on' : ''}`} onClick={() => setTypeFilter(t => t === 'not-in-use' ? 'all' : 'not-in-use')}>Not in Deck</button>

        {/* View mode toggle */}
        <div style={{ display: 'flex', background: 'var(--pill)', borderRadius: 8, border: '1px solid var(--card-border)', overflow: 'hidden', flexShrink: 0 }}>
          {['collector', 'player'].map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)} style={{
              padding: '5px 12px', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all .15s',
              background: viewMode === mode ? 'var(--yellow)' : 'transparent',
              color: viewMode === mode ? '#000' : 'var(--muted)',
              fontFamily: "'Outfit',sans-serif",
            }}>
              {mode === 'collector' ? 'Collector' : 'Player'}
            </button>
          ))}
        </div>

        {/* Dropdowns */}
        <select value={sort} onChange={e => setSort(e.target.value)} style={{ padding: '7px 10px', fontSize: 12 }}>
          <option value="set">Sort: Set (oldest first)</option>
          <option value="set-new">Sort: Set (newest first)</option>
          <option value="name">Sort: Name</option>
          <option value="price-desc">Sort: Price (high → low)</option>
          <option value="price-asc">Sort: Price (low → high)</option>
          <option value="most-used">Sort: Most Used</option>
          <option value="least-used">Sort: Least Used</option>
        </select>

        <select value={setFilter} onChange={e => { setSetFilter(e.target.value); setEraFilter(''); }} style={{ padding: '7px 10px', fontSize: 12 }}>
          <option value="">All Sets</option>
          {Object.entries(setsByEra).map(([era, sets]) => (
            <optgroup key={era} label={era}>
              {sets.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
            </optgroup>
          ))}
        </select>

        {/* Owned/unowned toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" checked={showUnowned} onChange={e => setShowUnowned(e.target.checked)}
            style={{ width: 14, height: 14, accentColor: 'var(--yellow)', cursor: 'pointer' }} />
          Show unowned
        </label>
      </div>

      {/* Format blocks + Era dropdown */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        {FORMAT_FILTERS.map(f => {
          const colorVar = f === 'Standard' ? 'var(--std)' : f === 'Expanded' ? 'var(--exp)' : f === 'GLC' ? 'var(--glc)' : f === 'Eternal' ? 'var(--eternal)' : 'var(--muted)';
          const active = formatFilter === f && !eraFilter;
          return (
            <button key={f} onClick={() => { setFormatFilter(f); setEraFilter(''); }} style={{
              padding: '5px 14px',
              border: `2px solid ${active ? colorVar : 'var(--card-border)'}`,
              borderRadius: 8,
              background: active ? `color-mix(in srgb, ${colorVar} 15%, transparent)` : 'transparent',
              color: active ? colorVar : 'var(--muted)',
              fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all .15s',
            }}>{f === 'All' ? 'All Formats' : f}</button>
          );
        })}
        <select
          value={eraFilter}
          onChange={e => { setEraFilter(e.target.value); setFormatFilter('All'); }}
          style={{
            padding: '5px 12px', fontSize: 12, borderRadius: 8, cursor: 'pointer',
            border: `2px solid ${eraFilter ? 'var(--era)' : 'var(--card-border)'}`,
            background: eraFilter ? 'rgba(196,123,222,.12)' : 'transparent',
            color: eraFilter ? 'var(--era)' : 'var(--muted)',
            fontFamily: "'Outfit',sans-serif", fontWeight: 700,
          }}
        >
          <option value="">Era</option>
          {Object.entries(ERA_GROUPS).map(([group, formats]) => (
            <optgroup key={group} label={group}>
              {formats.map(f => (
                <option key={f.code} value={f.code}>{f.label} · {f.desc}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        {viewMode === 'player' ? `${playerGroups.length} card${playerGroups.length !== 1 ? 's' : ''}` : `${sorted.length} print${sorted.length !== 1 ? 's' : ''}`}
        {loadingSet && (
          <span style={{ color: 'var(--yellow)' }}>
            {setFilter ? 'Loading set…' : `Loading sets… ${loadedSets}/${ALL_SETS.length}`}
          </span>
        )}
      </div>

      {(viewMode === 'player' ? playerGroups.length === 0 : sorted.length === 0) ? (
        <div style={{ textAlign: 'center', padding: 56, color: 'var(--muted)' }}>
          <p>No cards match the current filters.</p>
        </div>
      ) : viewMode === 'collector' ? (
        /* ── Collector view: one tile per print ── */
        <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 12 }}>
          {sorted.slice((page - 1) * CARDS_PER_PAGE, page * CARDS_PER_PAGE).map(({ rc, own, api, decks, neededDecks }) => {
            const ck = cardKey(rc);
            const onWishlist = (state.wishlist || []).some(w => cardKey(w) === ck);
            const isNeeded = neededDecks.length > 0;
            const coveredDecks = decks.filter(d => !neededDecks.includes(d));
            return (
            <div
              key={ck}
              style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, overflow: 'hidden', transition: 'all .2s', position: 'relative', cursor: 'pointer', opacity: own <= 0 ? .45 : 1 }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'var(--blue)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = 'var(--card-border)'; }}
              onClick={() => onCardClick({ rc, own, api, decks })}
            >
              {api?.imageSmall
                ? <img src={api.imageSmall} alt={rc.name} style={{ width: '100%', display: 'block' }} loading="lazy" />
                : <div style={{ height: 90, background: 'var(--pill)' }} />
              }
              {own > 0 && (
                <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,.82)', color: 'var(--yellow)', fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 11, padding: '2px 6px', borderRadius: 4 }}>×{own}</div>
              )}
              {(decks.length > 0 || onWishlist) && (
                <div style={{ position: 'absolute', top: 6, left: 6, background: isNeeded ? 'rgba(249,115,22,.9)' : onWishlist && !decks.length ? 'rgba(255,203,5,.9)' : 'rgba(74,222,128,.9)', color: '#000', fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4 }}>
                  {decks.length > 0 ? (decks.length === 1 ? '1 deck' : `${decks.length} decks`) : '★'}
                </div>
              )}
              <div style={{ padding: '8px 10px' }}>
                <div style={{ fontWeight: 800, fontSize: 12, lineHeight: 1.3 }}>{rc.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{api?.setName || rc.setCode || ''}{rc.num ? ` · ${rc.num}` : ''}</div>
                {api?.marketPrice != null && (
                  <div style={{ display: 'flex', gap: 5, alignItems: 'baseline', marginTop: 2 }}>
                    {own > 1 && <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700 }}>${(api.marketPrice * own).toFixed(2)}</span>}
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>${api.marketPrice.toFixed(2)}{own > 1 ? ' ea' : ''}</span>
                  </div>
                )}
                {(decks.length > 0 || onWishlist) && (
                  <div style={{ fontSize: 10, marginTop: 3, lineHeight: 1.5 }}>
                    {isNeeded && <div style={{ color: 'var(--orange)' }}>Need: {neededDecks.slice(0, 2).join(', ')}{neededDecks.length > 2 ? ` +${neededDecks.length - 2}` : ''}</div>}
                    {coveredDecks.length > 0 && <div style={{ color: 'var(--green)' }}>{coveredDecks.slice(0, 2).join(', ')}{coveredDecks.length > 2 ? ` +${coveredDecks.length - 2}` : ''}</div>}
                    {onWishlist && <div style={{ color: 'var(--yellow)' }}>★ Wishlist</div>}
                  </div>
                )}
              </div>
              <QtyBar rc={rc} state={state} dispatch={dispatch} />
            </div>
            );
          })}
        </div>
        {sorted.length > CARDS_PER_PAGE && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--card-border)' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Page {page} of {Math.ceil(sorted.length / CARDS_PER_PAGE)}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.min(Math.ceil(sorted.length / CARDS_PER_PAGE), p + 1))} disabled={page === Math.ceil(sorted.length / CARDS_PER_PAGE)}>Next</button>
          </div>
        )}
        </>
      ) : (
        /* ── Player view: one tile per card name, grouped ── */
        <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 12 }}>
          {playerGroups.slice((page - 1) * CARDS_PER_PAGE, page * CARDS_PER_PAGE).map(({ name, displayEntry, prints, totalOwn }) => {
            const { rc, api } = displayEntry;
            const allDecks = [...new Set(prints.flatMap(p => p.decks))];
            const allNeededDecks = [...new Set(prints.flatMap(p => p.neededDecks || []))];
            const onWishlist = (state.wishlist || []).some(w => prints.some(p => cardKey(w) === cardKey(p.rc)));
            const isExpanded = expandedCards.has(name);
            const multiPrint = prints.length > 1;
            const isNeeded = allNeededDecks.length > 0;
            const coveredDecks = allDecks.filter(d => !allNeededDecks.includes(d));
            // Sum owned-in-deck copies across all prints of this card
            const inDeck = prints.reduce((s, p) => s + (deckUsage.inDecks[cardKey(p.rc)] || 0), 0);
            const spare = Math.max(0, totalOwn - inDeck);
            return (
              <div key={name} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, overflow: 'hidden', transition: 'all .2s', position: 'relative', cursor: 'pointer', opacity: totalOwn <= 0 ? .45 : 1 }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'var(--blue)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = 'var(--card-border)'; }}
                onClick={() => setPlayerModalGroup({ name, displayEntry, prints, totalOwn })}
              >
                {api?.imageSmall
                  ? <img src={api.imageSmall} alt={name} style={{ width: '100%', display: 'block' }} loading="lazy" />
                  : <div style={{ height: 90, background: 'var(--pill)' }} />
                }
                {totalOwn > 0 && (
                  <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,.82)', color: 'var(--yellow)', fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 11, padding: '2px 6px', borderRadius: 4 }}>×{totalOwn}</div>
                )}
                {(allDecks.length > 0 || onWishlist) && (
                  <div style={{ position: 'absolute', top: 6, left: 6, background: isNeeded ? 'rgba(249,115,22,.9)' : onWishlist && !allDecks.length ? 'rgba(255,203,5,.9)' : 'rgba(74,222,128,.9)', color: '#000', fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4 }}>
                    {allDecks.length > 0 ? (allDecks.length === 1 ? '1 deck' : `${allDecks.length} decks`) : '★'}
                  </div>
                )}
                <div style={{ padding: '8px 10px 6px' }}>
                  <div style={{ fontWeight: 800, fontSize: 12, lineHeight: 1.3 }}>{name}</div>
                  {multiPrint
                    ? <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{prints.length} prints</div>
                    : <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{api?.setName || rc.setCode}{rc.num ? ` · ${rc.num}` : ''}</div>
                  }
                  {(allDecks.length > 0 || onWishlist) && (
                    <div style={{ fontSize: 10, marginTop: 3, lineHeight: 1.5 }}>
                      {isNeeded && <div style={{ color: 'var(--orange)' }}>Need: {allNeededDecks.slice(0, 2).join(', ')}{allNeededDecks.length > 2 ? ` +${allNeededDecks.length - 2}` : ''}</div>}
                      {coveredDecks.length > 0 && <div style={{ color: 'var(--green)' }}>{coveredDecks.slice(0, 2).join(', ')}{coveredDecks.length > 2 ? ` +${coveredDecks.length - 2}` : ''}</div>}
                      {onWishlist && <div style={{ color: 'var(--yellow)' }}>★ Wishlist</div>}
                    </div>
                  )}
                </div>
                {/* Collapsible qty bar for player view */}
                <div onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '5px 8px', borderTop: '1px solid var(--card-border)', background: 'var(--pill)' }}>
                    {totalOwn === 0 ? (
                      <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 12, color: 'var(--muted)' }}>×0</span>
                    ) : (
                      <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: 12, fontWeight: 700 }}>
                        {inDeck > 0 && <span style={{ color: 'var(--green)' }}>×{inDeck}</span>}
                        {inDeck > 0 && spare > 0 && <span style={{ color: 'var(--muted)', fontWeight: 400 }}> + </span>}
                        {spare > 0 && <span style={{ color: 'var(--orange)' }}>×{spare}</span>}
                      </span>
                    )}
                    {multiPrint && (
                      <button className="btn btn-ghost btn-xs" style={{ width: 22, height: 22, padding: 0, fontSize: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }} onClick={() => toggleExpand(name)}>
                        {isExpanded ? '▲' : '▼'}
                      </button>
                    )}
                  </div>
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--card-border)', padding: '4px 6px', background: 'var(--bg)' }}>
                      {prints.map(({ rc: prc }) => {
                        const qty = collQty(state.collection[cardKey(prc)]);
                        return (
                          <div key={cardKey(prc)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 0', borderBottom: '1px solid var(--card-border)', fontSize: 10 }}>
                            <span style={{ flex: 1, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prc.setCode} {prc.num}</span>
                            <button className="btn btn-ghost btn-xs" style={{ width: 20, height: 20, padding: 0, fontSize: 13 }} onClick={() => adjustCollectionQty(prc, -1, state, dispatch)}>−</button>
                            <span style={{ fontWeight: 700, minWidth: 18, textAlign: 'center', color: qty > 0 ? 'var(--green)' : 'var(--muted)' }}>×{qty}</span>
                            <button className="btn btn-ghost btn-xs" style={{ width: 20, height: 20, padding: 0, fontSize: 13 }} onClick={() => adjustCollectionQty(prc, 1, state, dispatch)}>+</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {playerGroups.length > CARDS_PER_PAGE && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--card-border)' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Page {page} of {Math.ceil(playerGroups.length / CARDS_PER_PAGE)}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.min(Math.ceil(playerGroups.length / CARDS_PER_PAGE), p + 1))} disabled={page === Math.ceil(playerGroups.length / CARDS_PER_PAGE)}>Next</button>
          </div>
        )}
        </>
      )}

      {playerModalGroup && (
        <PlayerCardModal
          group={playerModalGroup}
          state={state}
          dispatch={dispatch}
          getDeckOwned={getDeckOwned}
          onClose={() => setPlayerModalGroup(null)}
        />
      )}
    </>
  );
}

// ── Player Card Modal ─────────────────────────────────────────────────────────
function PlayerCardModal({ group, state, dispatch, getDeckOwned, onClose }) {
  const { name, displayEntry, prints, totalOwn } = group;
  const displayApi = displayEntry.api;
  const [infoCard, setInfoCard] = useState(null);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
          {displayApi?.imageSmall && (
            <img src={displayApi.imageLarge || displayApi.imageSmall} alt={name}
              style={{ width: 100, borderRadius: 8, flexShrink: 0, cursor: 'pointer' }}
              onClick={() => setInfoCard(displayApi)}
              title="Click for card info"
            />
          )}
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 4px' }}>{name}</h3>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 2 }}>
              Total owned: <span style={{ color: 'var(--yellow)' }}>×{totalOwn}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{prints.length} print{prints.length !== 1 ? 's' : ''}</div>
          </div>
        </div>

        {prints.map(({ rc, own, api }) => {
          const ck = cardKey(rc);
          const standalone = collQty(state.collection[ck]);

          // Build deck rows by checking per-copy blings so each deck slot is attributed
          // to whichever physical print fills it, not just the deck's listed print.
          function normBlingArr(stored, qty) {
            if (!stored) return new Array(qty).fill(null);
            if (!Array.isArray(stored)) return new Array(qty).fill(stored);
            const arr = [...stored]; while (arr.length < qty) arr.push(null);
            return arr.slice(0, qty);
          }
          const deckRows = state.decks.filter(d => !d.isBuyList).flatMap(d => {
            let ownedAsThis = 0, totalSlots = 0;
            for (const rawRc of d.rawCards) {
              const ownedCount = d.ownedMap?.[cardKey(rawRc)] ?? 0;
              const blings = normBlingArr(d.blingSel?.[cardKey(rawRc)], rawRc.qty);
              for (let i = 0; i < rawRc.qty; i++) {
                const b = blings[i];
                const copyKey = b && (b.setCode !== rawRc.setCode || b.number !== rawRc.num)
                  ? cardKey({ name: rawRc.name, setCode: b.setCode, num: b.number })
                  : cardKey(rawRc);
                if (copyKey === ck) {
                  totalSlots++;
                  if (i < ownedCount) ownedAsThis++;
                }
              }
            }
            if (totalSlots === 0) return [];
            return [{ deck: d, owned: ownedAsThis, total: totalSlots }];
          });
          const rowStyle = { fontSize: 11, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--card-border)', marginTop: 4, paddingTop: 4 };
          const btnStyle = { width: 24, height: 24, padding: 0, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, flexShrink: 0 };

          return (
            <div key={ck} style={{ marginBottom: 10, padding: '10px 12px', background: 'var(--pill)', borderRadius: 8, border: '1px solid var(--card-border)' }}>
              {/* Header: set name + price */}
              <div>
                <span style={{ fontWeight: 800, fontSize: 12 }}>{api?.setName || rc.setCode}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 6 }}>#{rc.num}</span>
                {api?.marketPrice != null && <span style={{ fontSize: 10, color: 'var(--green)', marginLeft: 8 }}>${api.marketPrice.toFixed(2)}</span>}
              </div>
              {/* Deck breakdown rows */}
              {deckRows.map(({ deck, owned, total }) => (
                <div key={deck.id} style={{ ...rowStyle, color: 'var(--muted)' }}>
                  <span>{deck.name}</span>
                  <span style={{ color: owned >= total ? 'var(--green)' : owned > 0 ? 'var(--orange)' : 'var(--muted)' }}>
                    {owned}/{total} covered
                  </span>
                </div>
              ))}
              {/* Not in a deck — standalone collection qty, always shown */}
              <div style={{ ...rowStyle, color: 'var(--muted)' }}>
                <span>Not in a deck</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }} onClick={e => e.stopPropagation()}>
                  <button className="btn btn-ghost btn-xs" style={btnStyle} onClick={() => adjustCollectionQty(rc, -1, state, dispatch)}>−</button>
                  <span style={{ fontWeight: 700, fontSize: 12, minWidth: 22, textAlign: 'center', color: standalone > 0 ? 'var(--orange)' : 'var(--muted)' }}>×{standalone}</span>
                  <button className="btn btn-ghost btn-xs" style={btnStyle} onClick={() => adjustCollectionQty(rc, 1, state, dispatch)}>+</button>
                </div>
              </div>
            </div>
          );
        })}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Done</button>
        </div>
      </div>
      {infoCard && <CardInfoModal card={infoCard} onClose={() => setInfoCard(null)} />}
    </div>
  );
}

// ── Browse Tab ────────────────────────────────────────────────────────────────
function BrowseTab({ state, dispatch, getDeckOwned }) {
  const [setsMeta, setSetsMeta] = useState({});
  const [selectedSet, setSelectedSet] = useState(null); // null = set grid, obj = inside a set
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedCard, setSelectedCard] = useState(null);
  // Inside-a-set controls
  const [cardSort, setCardSort] = useState('number');      // 'number' | 'name' | 'price' | 'owned'
  const [cardFilter, setCardFilter] = useState('all');     // 'all' | 'collection' | 'decks' | 'both' | 'needed' | 'unowned'
  // Set-grid controls
  const [gridSort, setGridSort] = useState('era');      // 'era' | 'completion' | 'value' | 'name'
  const [eraFilter, setEraFilter] = useState('');
  const searchTimer = useRef(null);

  useEffect(() => { fetchSetsMetadata().then(setSetsMeta); }, []);

  // When a set is selected, auto-load its cards
  useEffect(() => {
    if (!selectedSet) { setResults([]); return; }
    runSearch(1, selectedSet.id, '');
  }, [selectedSet]);

  // Query search within a set or global
  useEffect(() => {
    if (selectedSet) return; // set browsing handled above
    if (!query) { setResults([]); setTotalCount(0); return; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => runSearch(1, null, query), 400);
    return () => clearTimeout(searchTimer.current);
  }, [query]);

  async function runSearch(p = 1, setId = null, q = query) {
    if (!setId && !q) return;
    setLoading(true);

    let cards = [], totalCount = 0;

    // Known TCGDex-only sets (ME era etc.) — skip pokemontcg.io entirely
    const isTCGDexSet = setId && !q && TCGDEX_SET_TOTALS[setId] != null;

    if (!isTCGDexSet) {
      ({ cards, totalCount } = await searchCards(q, setId, p));
      // Fallback 1: retry by PTCGO code if set.id returned nothing
      if (totalCount === 0 && setId && !q && selectedSet?.code) {
        ({ cards, totalCount } = await searchCards('', null, p, selectedSet.code));
      }
    }

    // Fallback 2 (or primary for TCGDex sets): TCGDex for sets not in pokemontcg.io
    if (totalCount === 0 && setId && !q) {
      const tcgCards = await fetchTCGDexSet(setId, selectedSet?.code || '', selectedSet?.name || '');
      if (tcgCards.length > 0) {
        const updates = {};
        for (const card of tcgCards) {
          const ck = cardKey({ name: card.name, setCode: card.setCode, num: card.number });
          updates[ck] = card;
        }
        dispatch({ type: 'SET_API_DATA', updates });
        setResults(tcgCards);
        setTotalCount(tcgCards.length);
        setPage(1);
        setLoading(false);
        return;
      }
    }

    // Cache cards so set grid can compute total set value
    if (cards.length > 0) {
      const updates = {};
      for (const card of cards) {
        const ck = cardKey({ name: card.name, setCode: card.setCode, num: card.number });
        updates[ck] = card;
      }
      dispatch({ type: 'SET_API_DATA', updates });
    }
    // Deduplicate when appending (prevents duplicates from StrictMode double-invocation
    // or overlapping parallel-fetch pages on Load more)
    setResults(prev => {
      if (p === 1) return cards;
      const seen = new Set(prev.map(c => `${c.setCode}||${c.number}`));
      return [...prev, ...cards.filter(c => !seen.has(`${c.setCode}||${c.number}`))];
    });
    setTotalCount(totalCount);
    setPage(p);
    setLoading(false);
  }

  function setVariantQty(card, variant, delta) {
    const ck = cardKey({ name: card.name, setCode: card.setCode, num: card.number });
    const cur = state.collection[ck];
    const obj = (cur && typeof cur === 'object')
      ? { ...cur }
      : { normal: typeof cur === 'number' ? cur : 0, reverseHolo: 0, pokeball: 0, masterball: 0, prizestamped: 0 };
    obj[variant] = Math.max(0, (obj[variant] || 0) + delta);
    dispatch({ type: 'SET_COLLECTION', collection: { ...state.collection, [ck]: obj } });
  }

  function getVariantQty(card, variant) {
    const val = state.collection[cardKey({ name: card.name, setCode: card.setCode, num: card.number })];
    if (!val) return 0;
    if (typeof val === 'number') return variant === 'normal' ? val : 0;
    return val[variant] || 0;
  }

  function getCollectionQty(card) {
    return collQty(state.collection[cardKey({ name: card.name, setCode: card.setCode, num: card.number })]);
  }

  function getDeckQty(card) {
    const ck = cardKey({ name: card.name, setCode: card.setCode, num: card.number });
    let total = 0;
    for (const deck of state.decks) {
      if (deck.isBuyList) continue;
      const rc = deck.rawCards.find(r => cardKey(r) === ck);
      if (rc) total += sumOwnedArr(deck.ownedMap?.[ck], rc.qty);
    }
    return total;
  }

  function getQty(card) {
    return getCollectionQty(card) + getDeckQty(card);
  }

  // Compute per-set stats.
  // Total set value comes from the persistent module cache in api.js (survives page reload).
  // Owned count/value comes from state.apiCache (populated by useEnrich + browse dispatch).
  const setStats = useMemo(() => {
    const stats = {};

    // Total set value from persistent module cache
    for (const [sid, ms] of Object.entries(getCachedSetStats())) {
      stats[sid] = { owned: 0, value: 0, totalValue: ms.totalValue, cachedCount: ms.cachedCount };
    }

    // Owned count + value from state.apiCache
    for (const [ck, apiData] of Object.entries(state.apiCache)) {
      if (!apiData?.setId) continue;
      const sid = apiData.setId;
      if (!stats[sid]) stats[sid] = { owned: 0, value: 0, totalValue: 0, cachedCount: 0 };
      let totalOwned = 0;
      for (const deck of state.decks) {
        if (deck.isBuyList) continue;
        const rc = deck.rawCards.find(r => cardKey(r) === ck);
        if (rc) totalOwned += sumOwnedArr(deck.ownedMap?.[ck], rc.qty);
      }
      const standalone = collQty(state.collection[ck]);
      const owned = totalOwned + standalone;
      if (owned > 0) {
        stats[sid].owned += 1; // count unique card designs, not total copies
        stats[sid].value += owned * (apiData.marketPrice || 0);
      }
    }
    return stats;
  }, [state.apiCache, state.decks, state.collection]);

  // Keys for cards that are needed: either in a deck with insufficient owned copies, or on the wishlist
  const neededKeys = useMemo(() => {
    const keys = new Set();
    for (const deck of state.decks) {
      if (deck.isBuyList) continue;
      for (const rc of deck.rawCards) {
        if (rc.qty - getDeckOwned(deck, rc) > 0) keys.add(cardKey(rc));
      }
    }
    for (const item of (state.wishlist || [])) keys.add(cardKey(item));
    return keys;
  }, [state.decks, state.wishlist, getDeckOwned]);

  // Maps cardKey → { deckNames, neededDecks } for badge + info in set view
  const deckUsageMap = useMemo(() => {
    const map = {};
    for (const deck of state.decks) {
      if (deck.isBuyList) continue;
      for (const rc of deck.rawCards) {
        const ck = cardKey(rc);
        if (!map[ck]) map[ck] = { deckNames: [], neededDecks: [] };
        if (!map[ck].deckNames.includes(deck.name)) map[ck].deckNames.push(deck.name);
        const owned = sumOwnedArr(deck.ownedMap?.[ck], rc.qty);
        if (rc.qty - owned > 0 && !map[ck].neededDecks.includes(deck.name)) {
          map[ck].neededDecks.push(deck.name);
        }
      }
    }
    return map;
  }, [state.decks]);

  // Processed results for inside-a-set view
  const displayResults = useMemo(() => {
    let list = results;
    if (cardFilter === 'collection') list = list.filter(c => getCollectionQty(c) > 0);
    if (cardFilter === 'decks')      list = list.filter(c => getDeckQty(c) > 0);
    if (cardFilter === 'both')       list = list.filter(c => getQty(c) > 0);
    if (cardFilter === 'needed')     list = list.filter(c => neededKeys.has(cardKey({ name: c.name, setCode: c.setCode, num: c.number })));
    if (cardFilter === 'unowned')    list = list.filter(c => getQty(c) === 0);
    list = [...list];
    if (cardSort === 'number') list.sort((a, b) => (parseInt(a.number) || 0) - (parseInt(b.number) || 0));
    if (cardSort === 'name')   list.sort((a, b) => a.name.localeCompare(b.name));
    if (cardSort === 'price')  list.sort((a, b) => (b.marketPrice || 0) - (a.marketPrice || 0));
    if (cardSort === 'owned')  list.sort((a, b) => {
      const diff = getQty(b) - getQty(a);
      return diff !== 0 ? diff : (parseInt(a.number) || 0) - (parseInt(b.number) || 0);
    });
    return list;
  }, [results, cardSort, cardFilter, state.collection, neededKeys]);

  // Set grid — sorted and filtered
  const allSets = useMemo(() => {
    let sets = ALL_SETS.filter(s => !eraFilter || s.era === eraFilter);
    if (gridSort === 'name')       sets = [...sets].sort((a, b) => a.name.localeCompare(b.name));
    if (gridSort === 'completion') sets = [...sets].sort((a, b) => {
      const sa = setStats[a.id] || {}, sb = setStats[b.id] || {};
      const ta = setsMeta[a.id]?.total || TCGDEX_SET_TOTALS[a.id] || 0;
      const tb = setsMeta[b.id]?.total || TCGDEX_SET_TOTALS[b.id] || 0;
      const pa = ta > 0 ? sa.owned / ta : 0, pb = tb > 0 ? sb.owned / tb : 0;
      return pb - pa;
    });
    if (gridSort === 'value') sets = [...sets].sort((a, b) =>
      (setStats[b.id]?.value || 0) - (setStats[a.id]?.value || 0)
    );
    return sets;
  }, [eraFilter, gridSort, setStats, setsMeta]);

  const allEras = useMemo(() => [...new Set(ALL_SETS.map(s => s.era))], []);

  // Set grid view
  if (!selectedSet && !query) {
    const groupedSets = gridSort === 'era' ? groupByEra(allSets) : null;
    return (
      <div>
        {/* Set grid toolbar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search card name across all sets…"
            style={{ flex: 1, minWidth: 180, padding: '9px 14px' }} />
          <select value={eraFilter} onChange={e => setEraFilter(e.target.value)}
            style={{ padding: '8px 10px', background: 'var(--darker)', border: '1px solid var(--card-border)', borderRadius: 8, color: 'var(--fg)', fontSize: 12 }}>
            <option value="">All eras</option>
            {allEras.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <select value={gridSort} onChange={e => setGridSort(e.target.value)}
            style={{ padding: '8px 10px', background: 'var(--darker)', border: '1px solid var(--card-border)', borderRadius: 8, color: 'var(--fg)', fontSize: 12 }}>
            <option value="era">Era order</option>
            <option value="completion">Completion %</option>
            <option value="value">My value</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
        {groupedSets
          ? Object.entries(groupedSets).map(([era, sets]) => (
            <div key={era} style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--yellow)', marginBottom: 12, letterSpacing: 1, textTransform: 'uppercase', borderBottom: '2px solid var(--card-border)', paddingBottom: 6 }}>{era}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                {sets.map(s => <SetTile key={s.code} s={s} setsMeta={setsMeta} setStats={setStats} onClick={() => setSelectedSet(s)} />)}
              </div>
            </div>
          ))
          : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {allSets.map(s => <SetTile key={s.code} s={s} setsMeta={setsMeta} setStats={setStats} onClick={() => setSelectedSet(s)} />)}
            </div>
          )
        }
      </div>
    );
  }
  // Inside a set or global search results
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedSet(null); setQuery(''); setResults([]); }}>← Back</button>
        {selectedSet
          ? <span style={{ fontWeight: 800, fontSize: 13 }}>{selectedSet.name} <span style={{ color: 'var(--muted)', fontSize: 11 }}>({selectedSet.code})</span></span>
          : <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search…" style={{ flex: 1, padding: '8px 14px' }} autoFocus />
        }
        {!selectedSet && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{loading ? 'Searching…' : `${totalCount} results`}</span>}
        {selectedSet && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {/* Filter */}
            {[
              { key: 'all',        label: 'All' },
              { key: 'both',       label: 'Owned' },
              { key: 'collection', label: 'In Collection' },
              { key: 'decks',      label: 'In Decks' },
              { key: 'needed',     label: 'Needed' },
              { key: 'unowned',    label: 'Unowned' },
            ].map(({ key, label }) => (
              <button key={key} className={`btn btn-sm ${cardFilter === key ? 'btn-yellow' : 'btn-ghost'}`}
                style={{ fontSize: 10, padding: '4px 10px' }}
                onClick={() => setCardFilter(key)}>{label}</button>
            ))}
            <div style={{ width: 1, height: 16, background: 'var(--card-border)' }} />
            {/* Sort */}
            <select value={cardSort} onChange={e => setCardSort(e.target.value)}
              style={{ padding: '4px 8px', background: 'var(--darker)', border: '1px solid var(--card-border)', borderRadius: 6, color: 'var(--fg)', fontSize: 11 }}>
              <option value="number">Set order</option>
              <option value="name">Name A–Z</option>
              <option value="price">Price ↓</option>
              <option value="owned">Owned first</option>
            </select>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              {loading ? 'Loading…' : `${displayResults.length}${cardFilter !== 'all' ? `/${results.length}` : ''} cards`}
            </span>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 12 }}>
        {displayResults.map(card => {
          const collQtyVal = getCollectionQty(card);
          const deckQtyVal = getDeckQty(card);
          const qty = collQtyVal + deckQtyVal;
          const ck = cardKey({ name: card.name, setCode: card.setCode, num: card.number });
          const usage = deckUsageMap[ck] || { deckNames: [], neededDecks: [] };
          const { deckNames, neededDecks } = usage;
          const onWishlist = (state.wishlist || []).some(w => cardKey(w) === ck);
          const isNeeded = neededDecks.length > 0;
          const coveredDecks = deckNames.filter(d => !neededDecks.includes(d));
          const rc = { name: card.name, setCode: card.setCode, num: card.number };
          return (
            <div key={card.id} onClick={() => setSelectedCard(card)}
              style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', transition: 'all .2s', position: 'relative', opacity: qty <= 0 ? 0.45 : 1 }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'var(--blue)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = 'var(--card-border)'; }}
            >
              {card.imageSmall
                ? <img src={card.imageSmall} alt={card.name} style={{ width: '100%', display: 'block' }} loading="lazy" />
                : <div style={{ height: 90, background: 'var(--pill)' }} />
              }
              {qty > 0 && (
                <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,.82)', color: 'var(--yellow)', fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 11, padding: '2px 6px', borderRadius: 4 }}
                  title={collQtyVal > 0 && deckQtyVal > 0 ? `${collQtyVal} in collection, ${deckQtyVal} in decks` : collQtyVal > 0 ? 'In collection' : 'In decks'}>
                  ×{qty}
                </div>
              )}
              {(deckNames.length > 0 || onWishlist) && (
                <div style={{ position: 'absolute', top: 6, left: 6, background: isNeeded ? 'rgba(249,115,22,.9)' : onWishlist && !deckNames.length ? 'rgba(255,203,5,.9)' : 'rgba(74,222,128,.9)', color: '#000', fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4 }}>
                  {deckNames.length > 0 ? (deckNames.length === 1 ? '1 deck' : `${deckNames.length} decks`) : '★'}
                </div>
              )}
              <div style={{ padding: '8px 10px' }}>
                <div style={{ fontWeight: 800, fontSize: 12, lineHeight: 1.3 }}>{card.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{card.setName || card.setCode}{card.number ? ` · ${card.number}` : ''}</div>
                {card.marketPrice != null && (
                  <div style={{ display: 'flex', gap: 5, alignItems: 'baseline', marginTop: 2 }}>
                    {qty > 1 && <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700 }}>${(card.marketPrice * qty).toFixed(2)}</span>}
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>${card.marketPrice.toFixed(2)}{qty > 1 ? ' ea' : ''}</span>
                  </div>
                )}
                {(deckNames.length > 0 || onWishlist) && (
                  <div style={{ fontSize: 10, marginTop: 3, lineHeight: 1.5 }}>
                    {isNeeded && <div style={{ color: 'var(--orange)' }}>Need: {neededDecks.slice(0, 2).join(', ')}{neededDecks.length > 2 ? ` +${neededDecks.length - 2}` : ''}</div>}
                    {coveredDecks.length > 0 && <div style={{ color: 'var(--green)' }}>{coveredDecks.slice(0, 2).join(', ')}{coveredDecks.length > 2 ? ` +${coveredDecks.length - 2}` : ''}</div>}
                    {onWishlist && <div style={{ color: 'var(--yellow)' }}>★ Wishlist</div>}
                  </div>
                )}
              </div>
              <QtyBar rc={rc} state={state} dispatch={dispatch} />
            </div>
          );
        })}
      </div>
      {results.length < totalCount && (
        <button className="btn btn-ghost" style={{ width: '100%', marginTop: 12 }}
          onClick={() => selectedSet
            ? runSearch(page + 1, selectedSet.id, '')
            : runSearch(page + 1, null, query)}>
          Load more ({results.length}/{totalCount})
        </button>
      )}

      {selectedCard && (
        <BrowseCardModal
          card={selectedCard}
          getVariantQty={getVariantQty}
          setVariantQty={setVariantQty}
          onClose={() => setSelectedCard(null)}
          dispatch={dispatch}
          wishlist={state.wishlist || []}
          deckUsages={(() => {
            const ck = cardKey({ name: selectedCard.name, setCode: selectedCard.setCode, num: selectedCard.number });
            return state.decks
              .filter(d => !d.isBuyList)
              .flatMap(d => {
                const rc = d.rawCards.find(r => cardKey(r) === ck);
                if (!rc) return [];
                return [{ deck: d, qty: rc.qty, owned: sumOwnedArr(d.ownedMap?.[ck], rc.qty) }];
              });
          })()}
        />
      )}
    </div>
  );
}

// ── Set Tile ──────────────────────────────────────────────────────────────────
function SetTile({ s, setsMeta, setStats, onClick }) {
  const meta = setsMeta[s.id] || {};
  const stats = setStats[s.id] || { owned: 0, value: 0 };
  const total = meta.total || TCGDEX_SET_TOTALS[s.id] || 0;
  const pct = total > 0 ? Math.round((stats.owned / total) * 100) : 0;
  return (
    <div onClick={onClick}
      style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '12px 14px', cursor: 'pointer', transition: 'all .15s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--yellow)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--card-border)'; e.currentTarget.style.transform = ''; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ background: '#111', borderRadius: 6, padding: '4px 6px', minWidth: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {meta.symbol
            ? <img src={meta.symbol} alt="" style={{ height: 22, width: 'auto', objectFit: 'contain' }} />
            : <span style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 800 }}>{s.code}</span>
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 12, lineHeight: 1.3 }}>{s.name}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>{s.code}{meta.releaseDate ? ` · ${meta.releaseDate.slice(0,7)}` : ''}</div>
        </div>
      </div>
      {meta.logo && (
        <div style={{ background: '#0a0a18', borderRadius: 8, padding: '8px', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 52 }}>
          <img src={meta.logo} alt={s.name} style={{ maxHeight: 44, maxWidth: '100%', objectFit: 'contain' }} />
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, marginBottom: 4 }}>
        <span style={{ color: stats.owned > 0 ? 'var(--green)' : 'var(--muted)', fontWeight: 700 }}>
          {stats.owned}/{total > 0 ? total : '?'}
        </span>
        {stats.totalValue > 0 && (() => {
          const partial = total > 0 && stats.cachedCount < total;
          return (
            <span style={{ color: 'var(--muted)', fontWeight: 700 }}
              title={partial
                ? `Partial — ${stats.cachedCount}/${total} cards cached. Browse the set to load all prices. You own: $${stats.value.toFixed(2)}`
                : `Full set value. You own: $${stats.value.toFixed(2)}`}>
              {partial ? '~' : ''}${stats.totalValue.toFixed(2)}
            </span>
          );
        })()}
        <span style={{ color: pct > 0 ? 'var(--yellow)' : 'var(--muted)' }}>{pct}%</span>
      </div>
      <div style={{ height: 4, background: 'var(--pill)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? 'var(--green)' : 'var(--yellow)', borderRadius: 2, transition: 'width .3s' }} />
      </div>
    </div>
  );
}

// ── Energy cost dots (used in BrowseCardModal attacks) ───────────────────────
const ENERGY_COLOR = {
  Fire:'#e8460a', Water:'#4a90d9', Grass:'#3a9a3a', Lightning:'#e8c200',
  Psychic:'#9b59b6', Fighting:'#b87333', Darkness:'#555', Metal:'#8e9dad',
  Dragon:'#7b68ee', Fairy:'#e91e8c', Colorless:'#aaa',
};
function EnergyCost({ cost }) {
  if (!cost?.length) return null;
  return (
    <span style={{ display:'inline-flex', gap:2, verticalAlign:'middle', marginRight:4 }}>
      {cost.map((type, i) => (
        <span key={i} style={{ display:'inline-block', width:14, height:14, borderRadius:'50%',
          background: ENERGY_COLOR[type]||'#aaa', border:'1px solid rgba(255,255,255,.2)',
          fontSize:7, color:'#fff', textAlign:'center', lineHeight:'14px', fontWeight:800 }}
          title={type}>{type[0]}</span>
      ))}
    </span>
  );
}

// ── Browse Card Modal (card info + collection tracking + deck usage) ──────────
function BrowseCardModal({ card, getVariantQty, setVariantQty, onClose, deckUsages = [], dispatch, wishlist = [] }) {
  const [activeCard, setActiveCard] = useState(card);
  const [altPrints, setAltPrints] = useState([]);
  const [loadingAlts, setLoadingAlts] = useState(false);
  const [decksOpen, setDecksOpen] = useState(true);
  const [stampedCard, setStampedCard] = useState(null);
  const [loadingStamped, setLoadingStamped] = useState(true);
  const [prizePackPrice, setPrizePackPrice] = useState(null);

  // Sync activeCard when parent changes the card prop (shouldn't happen, but safe)
  useEffect(() => { setActiveCard(card); setAltPrints([]); }, [card?.id]);

  // Check Prize Pack lookup: same name + number exists as a Prize Pack Series card on TCGPlayer.
  const normName = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const ppKey = normName(card.name) + '|' + card.number.replace(/^0+/, '');
  const bundledPrizePrice = prizePackLookup[ppKey]; // number or null (entry exists = has prize pack)
  const hasPrizePack = ppKey in prizePackLookup;

  // Fetch live prize pack price via proxy (falls back to bundled price if unavailable)
  useEffect(() => {
    if (!hasPrizePack) return;
    setPrizePackPrice(typeof bundledPrizePrice === 'number' ? bundledPrizePrice : null);
    fetchPrizePackPrice(card.name, card.number).then(p => {
      if (p != null) setPrizePackPrice(p);
    });
  }, [card.id, hasPrizePack]);

  useEffect(() => {
    setLoadingStamped(true);
    setLoadingAlts(true);

    function isPromoSet(p) {
      const id = p.setId?.toLowerCase() ?? '';
      const name = p.setName?.toLowerCase() ?? '';
      return (
        p.rarity === 'Promo' ||
        id.includes('promo') ||
        /p$/i.test(id) ||
        name.includes('promo') ||
        name.includes('prize') ||
        p.rawTcg?.stampedHolofoil?.market != null ||
        p.rawTcg?.stamped?.market != null
      );
    }

    // Pass 1: strict (same HP + attacks) — also used for alt prints list
    fetchAllPrints(card.name, {
      supertype: card.supertype,
      hp: card.hp,
      attackNames: card.attacks,
      attacksFull: card.attacksFull,
    }).then(async prints => {
      setAltPrints(prints.filter(p => p.id !== card.id));
      setLoadingAlts(false);

      let stamped = prints.find(p => p.id !== card.id && p.setId !== card.setId && isPromoSet(p));

      // Pass 2: loose (name-only) — catches promos with slightly different stats
      if (!stamped) {
        const loose = await fetchAllPrints(card.name, { loose: true });
        stamped = loose.find(p =>
          p.id !== card.id &&
          p.setId !== card.setId &&
          isPromoSet(p) &&
          (p.rawTcg?.stampedHolofoil?.market != null ||
           p.rawTcg?.stamped?.market != null ||
           p.rarity === 'Promo')
        ) ?? null;
      }

      setStampedCard(stamped ?? null);
      setLoadingStamped(false);
    });
  }, [card.id]);

  // Prices — primarily from rawTcg (same card entry on TCGPlayer, different variant keys).
  // stampedCard from fetchAllPrints is a fallback for sets where the stamped version is a
  // separate API card entry entirely (some older promo sets).
  const prices = {
    normal:        card.rawTcg?.holofoil?.market ?? card.rawTcg?.normal?.market ?? null,
    reverseHolo:   card.rawTcg?.reverseHolofoil?.market ?? null,
    cosmoHolo:     card.rawTcg?.cosmosHolofoil?.market ?? null,
    pokeball:      null,
    masterball:    null,
    firstEdHolo:   card.rawTcg?.['1stEditionHolofoil']?.market ?? null,
    firstEdNormal: card.rawTcg?.['1stEditionNormal']?.market ?? null,
    unlimHolo:     card.rawTcg?.unlimitedHolofoil?.market ?? null,
    unlimNormal:   card.rawTcg?.unlimitedNormal?.market ?? null,
    // Prize Pack price: live-fetched via proxy (falls back to bundled JSON price), then API card data
    prizestamped:  prizePackPrice ?? card.stampedPrice ?? stampedCard?.marketPrice ?? stampedCard?.rawTcg?.holofoil?.market ?? null,
    prerelease:    null,
    gymstamped:    null,
    worldchamp:    null,
  };

  function isVariantAvailable(key) {
    if (getVariantQty(card, key) > 0) return true; // always show if already tracked
    if (key === 'normal') return true;
    if (key === 'reverseHolo')   return card.rawTcg?.reverseHolofoil?.market != null;
    if (key === 'cosmoHolo')     return card.rawTcg?.cosmosHolofoil?.market != null;
    if (key === 'firstEdHolo')   return card.rawTcg?.['1stEditionHolofoil']?.market != null;
    if (key === 'firstEdNormal') return card.rawTcg?.['1stEditionNormal']?.market != null;
    if (key === 'unlimHolo')     return card.rawTcg?.unlimitedHolofoil?.market != null;
    if (key === 'unlimNormal')   return card.rawTcg?.unlimitedNormal?.market != null;
    // Prize Pack lookup → immediate; stampedPrice on base card → immediate; API fallback after load
    if (key === 'prizestamped')  return hasPrizePack || card.stampedPrice != null || (!loadingStamped && stampedCard != null);
    // pokeball/masterball/prerelease/gymstamped/worldchamp: only show if user already owns some
    return false;
  }

  const visibleVariants = VARIANTS.filter(v => isVariantAvailable(v.key));
  const collectionTotal = VARIANTS.reduce((s, v) => s + getVariantQty(card, v.key), 0);
  const deckTotal = deckUsages.reduce((s, u) => s + u.owned, 0);
  const total = collectionTotal + deckTotal;

  const displayCard = activeCard || card;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 720, display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Left: card image */}
        {(displayCard.imageLarge || displayCard.imageSmall) && (
          <img
            src={displayCard.imageLarge || displayCard.imageSmall}
            alt={displayCard.name}
            style={{ width: 200, borderRadius: 10, flexShrink: 0, border: '2px solid var(--card-border)' }}
          />
        )}

        {/* Right: card info + collection tracking */}
        <div style={{ flex: 1, minWidth: 220 }}>

          {/* Name + HP */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, letterSpacing: .5, color: 'var(--yellow)' }}>{displayCard.name}</span>
            {displayCard.hp && <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>HP {displayCard.hp}</span>}
          </div>

          {/* Type line */}
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>
            {displayCard.supertype}{displayCard.subtypes?.length ? ` — ${displayCard.subtypes.join(', ')}` : ''}
          </div>

          {/* Abilities */}
          {displayCard.abilities?.map((ab, i) => (
            <div key={i} style={{ marginBottom: 10, padding: '8px 10px', background: 'rgba(255,203,5,.06)', border: '1px solid rgba(255,203,5,.2)', borderRadius: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--yellow)', marginBottom: 3 }}>
                {ab.type}: {ab.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.5 }}>{ab.text}</div>
            </div>
          ))}

          {/* Attacks */}
          {displayCard.attacksFull?.map((atk, i) => (
            <div key={i} style={{ marginBottom: 10, padding: '8px 10px', background: 'var(--pill)', border: '1px solid var(--card-border)', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                <EnergyCost cost={atk.cost} />
                <span style={{ fontWeight: 800, fontSize: 12 }}>{atk.name}</span>
                {atk.damage && <span style={{ marginLeft: 'auto', fontWeight: 800, fontSize: 13, color: 'var(--text)' }}>{atk.damage}</span>}
              </div>
              {atk.text && <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>{atk.text}</div>}
            </div>
          ))}

          {/* Weakness / Retreat */}
          {(displayCard.weaknesses?.length > 0 || displayCard.retreatCost != null) && (
            <div style={{ display: 'flex', gap: 16, marginTop: 4, marginBottom: 12, fontSize: 11, color: 'var(--muted)' }}>
              {displayCard.weaknesses?.map((w, i) => (
                <span key={i}>Weakness: <strong style={{ color: 'var(--text)' }}>{w.type} {w.value}</strong></span>
              ))}
              {displayCard.retreatCost != null && (
                <span>Retreat: <strong style={{ color: 'var(--text)' }}>{displayCard.retreatCost === 0 ? 'Free' : `×${displayCard.retreatCost}`}</strong></span>
              )}
            </div>
          )}

          {/* Set info */}
          <div style={{ fontSize: 10, color: 'var(--muted)', borderTop: '1px solid var(--card-border)', paddingTop: 8, marginTop: 4, marginBottom: 12 }}>
            <div>{displayCard.setName}{displayCard.number ? ` · #${displayCard.number}` : ''}{displayCard.rarity ? ` · ${displayCard.rarity}` : ''}</div>
            {displayCard.regulationMark && <div style={{ marginTop: 2 }}>Regulation Mark: {displayCard.regulationMark}</div>}
            {displayCard.marketPrice != null && (
              <div style={{ marginTop: 4 }}>
                <span style={{ color: 'var(--green)', fontWeight: 700 }}>${displayCard.marketPrice.toFixed(2)}</span>
                {displayCard.reverseHoloPrice != null && (
                  <span style={{ color: 'var(--muted)', marginLeft: 10 }}>Rev. Holo: ${displayCard.reverseHoloPrice.toFixed(2)}</span>
                )}
              </div>
            )}
          </div>

          {/* Alt prints switcher */}
          {(loadingAlts || altPrints.length > 0) && (
            <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--card-border)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                Other Prints{loadingAlts && ' …'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 10, padding: '3px 8px', fontWeight: displayCard.id === card.id ? 800 : 400 }}
                  onClick={() => setActiveCard(card)}
                >
                  {card.setName} #{card.number}
                  {card.marketPrice != null ? ` · $${card.marketPrice.toFixed(2)}` : ''}
                </button>
                {altPrints.map(p => (
                  <button
                    key={p.id}
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 10, padding: '3px 8px', fontWeight: p.id === displayCard.id ? 800 : 400 }}
                    onClick={() => setActiveCard(p)}
                  >
                    {p.setName} #{p.number}
                    {p.marketPrice != null ? ` · $${p.marketPrice.toFixed(2)}` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Collection tracking (always based on the original `card`) */}
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
            Track in Collection
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>
            Total owned: <span style={{ color: 'var(--yellow)' }}>×{total}</span>
            {collectionTotal > 0 && deckTotal > 0 && (
              <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 400, marginLeft: 8 }}>
                ({collectionTotal} collection · {deckTotal} in decks)
              </span>
            )}
          </div>

          {visibleVariants.map(({ key, label }) => {
            const qty = getVariantQty(card, key);
            const price = prices[key];
            const priceLoading = key === 'prizestamped' && card.stampedPrice == null && loadingStamped;
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ flex: 1, fontSize: 12, fontWeight: qty > 0 ? 800 : 400, color: qty > 0 ? 'var(--text)' : 'var(--muted)' }}>{label}</span>
                <span style={{ fontSize: 10, color: price != null ? 'var(--green)' : 'var(--muted)', minWidth: 44, textAlign: 'right' }}>
                  {priceLoading ? '…' : price != null ? `$${price.toFixed(2)}` : '—'}
                </span>
                <button className="btn btn-ghost btn-xs" style={{ width: 26, height: 26, padding: 0, justifyContent: 'center', fontSize: 16 }} onClick={() => setVariantQty(card, key, -1)}>−</button>
                <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 13, minWidth: 20, textAlign: 'center', color: qty > 0 ? 'var(--green)' : 'var(--muted)' }}>×{qty}</span>
                <button className="btn btn-ghost btn-xs" style={{ width: 26, height: 26, padding: 0, justifyContent: 'center', fontSize: 16 }} onClick={() => setVariantQty(card, key, 1)}>+</button>
              </div>
            );
          })}

          {/* Deck usage section */}
          {deckUsages.length > 0 && (
            <div style={{ marginTop: 12, borderTop: '1px solid var(--card-border)', paddingTop: 12 }}>
              <button
                onClick={() => setDecksOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--fg)', cursor: 'pointer', padding: 0, marginBottom: decksOpen ? 8 : 0, width: '100%', textAlign: 'left' }}
              >
                <span style={{ fontSize: 12, fontWeight: 800 }}>In Decks</span>
                <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>({deckUsages.length})</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>{decksOpen ? '▲' : '▼'}</span>
              </button>
              {decksOpen && deckUsages.map(({ deck, qty, owned }) => {
                const allOwned = owned >= qty;
                return (
                  <div key={deck.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: 6, marginBottom: 4, background: 'var(--darker)' }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{deck.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>needs ×{qty}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: allOwned ? 'var(--green)' : 'var(--orange)' }}>
                        {owned}/{qty} owned
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="modal-actions" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <button className="btn btn-ghost" onClick={onClose}>Done</button>
            {(() => {
              const ck = cardKey({ name: card.name, setCode: card.setCode, num: card.number });
              const onWishlist = wishlist.some(w => cardKey(w) === ck);
              return (
                <button
                  className={`btn btn-sm ${onWishlist ? 'btn-yellow' : 'btn-ghost'}`}
                  onClick={() => onWishlist
                    ? dispatch({ type: 'REMOVE_WISHLIST', ck })
                    : dispatch({ type: 'ADD_WISHLIST', item: { name: card.name, setCode: card.setCode, num: card.number, qty: 1 } })
                  }
                >
                  {onWishlist ? '★ Wishlisted' : '☆ Wishlist'}
                </button>
              );
            })()}
            {displayCard.tcgplayerUrl && (
              <a href={displayCard.tcgplayerUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                TCGPlayer ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Decks Tab ─────────────────────────────────────────────────────────────────
function DecksTab({ state, getApiData, getDeckOwned, onOpenDeck }) {
  const [editDeck, setEditDeck] = useState(null);
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 16 }}>
        {state.decks.map(deck => (
          <DeckCard key={deck.id} deck={deck} onClick={() => onOpenDeck(deck.id)} onEdit={() => setEditDeck(deck)} />
        ))}
      </div>
      {editDeck && <DeckModal deck={editDeck} onClose={() => setEditDeck(null)} onSaved={() => {}} />}
    </>
  );
}

// ── Wishlist Tab ──────────────────────────────────────────────────────────────
function WishlistTab({ state, dispatch, getApiData, getDeckOwned, onCardClick }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef(null);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearchLoading(true);
      const res = await searchByName(searchQuery.trim());
      setSearchResults(res);
      setSearchLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  function addToWishlist(card) {
    dispatch({ type: 'ADD_WISHLIST', item: { name: card.name, setCode: card.setCode || '', num: card.number || '', qty: 1 } });
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
  }

  // Build deck-needed map
  const byDeck = {};
  for (const deck of state.decks) {
    for (const rc of deck.rawCards) {
      const own = getDeckOwned(deck, rc);
      const need = rc.qty - own;
      if (need <= 0) continue;
      if (!byDeck[deck.name]) byDeck[deck.name] = { deck, items: [] };
      byDeck[deck.name].items.push({ rc, need });
    }
  }
  const deckEntries = Object.values(byDeck);

  const manualWishlist = state.wishlist || [];
  const hasAnything = manualWishlist.length > 0 || deckEntries.length > 0;

  return (
    <div>
      {/* ── My Wishlist ── */}
      <div className="sec-div" style={{ marginBottom: 10 }}>
        <div className="lbl">My Wishlist</div>
        <div className="line" />
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginLeft: 8, whiteSpace: 'nowrap', fontSize: 12 }}
          onClick={() => { setSearchOpen(v => !v); setSearchQuery(''); setSearchResults([]); }}
        >
          {searchOpen ? '✕ Close' : '+ Add Card'}
        </button>
      </div>

      {searchOpen && (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <input
            ref={searchRef}
            autoFocus
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search card name…"
            style={{ width: '100%', background: 'var(--dark)', border: '1px solid var(--card-border)', borderRadius: 7, padding: '7px 10px', color: 'var(--text)', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }}
          />
          {searchLoading && <div style={{ color: 'var(--muted)', fontSize: 12 }}>Searching…</div>}
          {!searchLoading && searchResults.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 6 }}>
              {searchResults.map(card => (
                <div key={card.id || `${card.setCode}-${card.number}`} style={{ cursor: 'pointer', borderRadius: 6, overflow: 'hidden', position: 'relative' }}
                  onClick={() => addToWishlist(card)} title={`${card.name} (${card.setCode})`}>
                  {card.imageSmall
                    ? <img src={card.imageSmall} alt={card.name} style={{ width: '100%', display: 'block' }} />
                    : <div style={{ width: '100%', aspectRatio: '2.5/3.5', background: 'var(--pill)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--muted)', padding: 2, textAlign: 'center' }}>{card.name}</div>
                  }
                </div>
              ))}
            </div>
          )}
          {!searchLoading && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>No results.</div>
          )}
        </div>
      )}

      {manualWishlist.length === 0 && (
        <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 18, paddingLeft: 2 }}>No cards added yet.</div>
      )}

      {manualWishlist.map(item => {
        const rc = { name: item.name, setCode: item.setCode || '', num: item.num || '' };
        const api = getApiData(rc);
        const ck = cardKey(item);
        return (
          <div key={ck} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '9px 12px', marginBottom: 6 }}>
            {api?.imageSmall
              ? <img src={api.imageSmall} alt="" style={{ width: 30, height: 42, objectFit: 'cover', borderRadius: 3, cursor: 'pointer' }} onClick={() => api && onCardClick({ rc, own: 0, api, decks: [] })} />
              : <div style={{ width: 30, height: 42, background: 'var(--pill)', borderRadius: 3 }} />
            }
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 13 }}>{item.name}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                {api?.setName || item.setCode || ''}
                {item.num ? ` · ${item.num}` : ''}
                <span style={{ marginLeft: 6, color: 'var(--yellow)', fontWeight: 700 }}>Wishlist</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {api?.marketPrice && <span style={{ fontSize: 11, color: 'var(--orange)', fontWeight: 700 }}>${(api.marketPrice * item.qty).toFixed(2)}</span>}
              <button className="btn btn-ghost btn-xs" style={{ width: 24, height: 24, padding: 0, fontSize: 15 }} onClick={() => dispatch({ type: 'SET_WISHLIST_QTY', ck, qty: item.qty - 1 })}>−</button>
              <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 13, minWidth: 20, textAlign: 'center' }}>×{item.qty}</span>
              <button className="btn btn-ghost btn-xs" style={{ width: 24, height: 24, padding: 0, fontSize: 15 }} onClick={() => dispatch({ type: 'SET_WISHLIST_QTY', ck, qty: item.qty + 1 })}>+</button>
              <button className="btn btn-ghost btn-xs" style={{ width: 24, height: 24, padding: 0, fontSize: 13, color: 'var(--red)' }} onClick={() => dispatch({ type: 'REMOVE_WISHLIST', ck })}>✕</button>
            </div>
          </div>
        );
      })}

      {/* ── Deck Needs ── */}
      {deckEntries.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div className="sec-div"><div className="lbl">Needed for Decks</div><div className="line" /></div>
          {deckEntries.map(({ deck, items }) => (
            <div key={deck.id}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--yellow)', margin: '12px 0 6px', textTransform: 'uppercase', letterSpacing: .5 }}>{deck.name}</div>
              {items.map(({ rc, need }) => {
                const api = getApiData(rc);
                return (
                  <div key={cardKey(rc)} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '9px 12px', marginBottom: 6 }}>
                    {api?.imageSmall
                      ? <img src={api.imageSmall} alt="" style={{ width: 30, height: 42, objectFit: 'cover', borderRadius: 3, cursor: 'pointer' }} onClick={() => api && onCardClick({ rc, own: getDeckOwned(deck, rc), api, decks: [deck.name] })} />
                      : <div style={{ width: 30, height: 42, background: 'var(--pill)', borderRadius: 3 }} />
                    }
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>{rc.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)' }}>{api?.setName || rc.setCode || ''}{rc.num ? ` · ${rc.num}` : ''}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {api?.marketPrice && <span style={{ fontSize: 11, color: 'var(--orange)', fontWeight: 700 }}>${(api.marketPrice * need).toFixed(2)}</span>}
                      <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: 11, fontWeight: 700, background: 'var(--red)', color: '#fff', padding: '2px 6px', borderRadius: 4 }}>Need ×{need}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {!hasAnything && (
        <div style={{ textAlign: 'center', padding: 56, color: 'var(--muted)' }}>
          <p>You own everything across all your decks and have no wishlist items.</p>
        </div>
      )}
    </div>
  );
}

// ── Import Modal ──────────────────────────────────────────────────────────────
function ImportCollectionModal({ onClose, toast, dispatch, state }) {
  const [raw, setRaw] = useState('');
  function apply() {
    const stripped = raw.split('\n').filter(l => !l.trim().startsWith('#')).join('\n');
    const parsed = parseRawLines(stripped);
    if (!parsed.length) { toast('Could not parse any cards', 'red'); return; }
    const collection = { ...state.collection };
    for (const pc of parsed) {
      collection[cardKey(pc)] = pc.qty;
      collection[pc.name] = pc.qty;
    }
    dispatch({ type: 'APPLY_COLLECTION', collection });
    toast(`Collection updated — ${parsed.length} card types`, 'green');
    onClose();
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Import My Collection</h3>
        <p className="modal-hint">Paste cards you already own. Quantities = how many you have. Re-importing sets counts, doesn't double them.</p>
        <textarea className="fi" value={raw} onChange={e => setRaw(e.target.value)}
          placeholder={"4 Charizard ex OBF 125\n3 Ultra Ball SVI 196\n# Lines starting with # are ignored"} />
        <div className="modal-actions">
          <button className="btn btn-yellow" onClick={apply}>⚡ Apply</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function exportCollection(state, getDeckOwned) {
  const seen = {};
  for (const deck of state.decks) {
    for (const rc of deck.rawCards) {
      const ck = cardKey(rc);
      const own = getDeckOwned(deck, rc);
      if (own > 0) seen[ck] = { rc, own: (seen[ck]?.own || 0) + own };
    }
  }
  const lines = Object.values(seen).map(({ rc, own }) =>
    `${own} ${rc.name}${rc.setCode ? ' ' + rc.setCode + ' ' + rc.num : ''}`
  );
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain' }));
  a.download = 'my-collection.txt';
  a.click();
}

function groupByEra(sets) {
  const map = {};
  for (const s of sets) {
    if (!map[s.era]) map[s.era] = [];
    map[s.era].push(s);
  }
  return map;
}
