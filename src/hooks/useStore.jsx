import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { cardKey, parseRawLines, buildSectionMap, supertypeToSection } from '../utils/cards';

const Ctx = createContext(null);

// Normalize blingSel stored value to array of length qty (handles old single-object format)
function getBlingArray(stored, qty) {
  if (!stored) return new Array(qty).fill(null);
  if (!Array.isArray(stored)) return new Array(qty).fill(stored);
  const arr = [...stored];
  while (arr.length < qty) arr.push(null);
  return arr.slice(0, qty);
}

// Normalize ownedMap value to per-copy boolean array.
// Old format: integer N → first N copies owned.
// New format: boolean[] → per-copy owned status.
function toOwnedArr(val, qty) {
  if (Array.isArray(val)) {
    const arr = [...val];
    while (arr.length < qty) arr.push(0);
    return arr.slice(0, qty);
  }
  const n = Math.min(qty, Math.max(0, val || 0));
  return Array.from({ length: qty }, (_, i) => i < n ? 1 : 0);
}
function sumOwnedArr(val, qty) {
  if (Array.isArray(val)) return val.slice(0, qty).reduce((s, v) => s + (v || 0), 0);
  return Math.min(qty, Math.max(0, val || 0));
}

const INITIAL = {
  decks: [],         // [{id,name,format,eraLabel,notes,rawCards,raw,sectionMap,ownedMap,blingSel,isBuyList}]
  apiCache: {},      // cardKey -> apiData
  collection: {},    // cardKey -> qty (standalone collection)
  wishlist: [],      // [{name,setCode,num,qty}] — manually added want list
};

function load() {
  try {
    const raw = localStorage.getItem('tcg_v4');
    if (raw) return { ...INITIAL, ...JSON.parse(raw) };
  } catch {}
  return INITIAL;
}

function save(state) {
  try {
    localStorage.setItem('tcg_v4', JSON.stringify({
      decks: state.decks,
      collection: state.collection,
      wishlist: state.wishlist || [],
      // don't persist apiCache — it gets re-fetched
    }));
  } catch {}
}

function reducer(state, action) {
  switch (action.type) {

    case 'SAVE_DECK': {
      const { deck } = action;
      const idx = state.decks.findIndex(d => d.id === deck.id);
      const decks = idx >= 0
        ? state.decks.map((d, i) => i === idx ? deck : d)
        : [...state.decks, deck];
      return { ...state, decks };
    }

    case 'DELETE_DECK': {
      const decks = state.decks.filter(d => d.id !== action.id);
      if (!action.addToCollection) return { ...state, decks };
      const collection = { ...state.collection };
      for (const rc of (action.rawCards || [])) {
        const ck = cardKey(rc);
        const owned = sumOwnedArr(action.ownedMap?.[ck], rc.qty);
        if (owned > 0) collection[ck] = (collection[ck] || 0) + owned;
      }
      return { ...state, decks, collection };
    }

    case 'SET_OWNED': {
      const { deckId, ck, val } = action;
      const decks = state.decks.map(d => {
        if (d.id !== deckId) return d;
        const rc = d.rawCards.find(c => cardKey(c) === ck);
        const capped = Math.min(rc?.qty || 999, Math.max(0, val));
        return { ...d, ownedMap: { ...d.ownedMap, [ck]: capped } };
      });
      return { ...state, decks };
    }

    // Per-group owned: sets owned count for copies [firstCopyIndex, firstCopyIndex+groupQty).
    // Migrates storage to per-copy array so groups are tracked independently.
    case 'SET_GROUP_OWNED': {
      const { deckId, ck, firstCopyIndex, groupQty, val } = action;
      const decks = state.decks.map(d => {
        if (d.id !== deckId) return d;
        const rc = d.rawCards.find(c => cardKey(c) === ck);
        const qty = rc?.qty || 0;
        const arr = toOwnedArr(d.ownedMap?.[ck], qty);
        const clamped = Math.min(groupQty, Math.max(0, val));
        for (let i = 0; i < groupQty; i++) arr[firstCopyIndex + i] = i < clamped ? 1 : 0;
        return { ...d, ownedMap: { ...d.ownedMap, [ck]: arr } };
      });
      return { ...state, decks };
    }

    case 'SET_BLING': {
      const { deckId, ck, blingSel, copyIndex } = action;
      const decks = state.decks.map(d => {
        if (d.id !== deckId) return d;
        const existing = d.blingSel || {};
        let newVal;
        if (copyIndex === undefined || copyIndex === null) {
          newVal = blingSel; // apply to all copies (legacy / clear-all)
        } else {
          const rc = d.rawCards.find(c => cardKey(c) === ck);
          const arr = getBlingArray(existing[ck], rc?.qty || 1);
          arr[copyIndex] = blingSel;
          newVal = arr;
        }
        return { ...d, blingSel: { ...existing, [ck]: newVal } };
      });
      return { ...state, decks };
    }

    case 'MARK_DECK_OWNED': {
      const { deckId, own } = action;
      const decks = state.decks.map(d => {
        if (d.id !== deckId) return d;
        const om = {};
        for (const rc of d.rawCards) om[cardKey(rc)] = own ? rc.qty : 0;
        return { ...d, ownedMap: om };
      });
      return { ...state, decks };
    }

    case 'MARK_ALL_OWNED': {
      const decks = state.decks.map(d => {
        if (d.isBuyList) return d;
        const om = {};
        for (const rc of d.rawCards) om[cardKey(rc)] = rc.qty;
        return { ...d, ownedMap: om };
      });
      return { ...state, decks };
    }

    case 'SET_API_DATA': {
      const { updates } = action; // { [key]: apiData }
      return { ...state, apiCache: { ...state.apiCache, ...updates } };
    }

    case 'SET_COLLECTION':
      return { ...state, collection: action.collection };

    case 'ADD_WISHLIST': {
      const { item } = action; // { name, setCode, num, qty? }
      const ck = cardKey(item);
      const existing = (state.wishlist || []).find(w => cardKey(w) === ck);
      if (existing) {
        return { ...state, wishlist: state.wishlist.map(w => cardKey(w) === ck ? { ...w, qty: (w.qty || 1) + (item.qty || 1) } : w) };
      }
      return { ...state, wishlist: [...(state.wishlist || []), { name: item.name, setCode: item.setCode || '', num: item.num || '', qty: item.qty || 1 }] };
    }

    case 'REMOVE_WISHLIST':
      return { ...state, wishlist: (state.wishlist || []).filter(w => cardKey(w) !== action.ck) };

    case 'SET_WISHLIST_QTY': {
      const { ck, qty } = action;
      if (qty <= 0) return { ...state, wishlist: (state.wishlist || []).filter(w => cardKey(w) !== ck) };
      return { ...state, wishlist: (state.wishlist || []).map(w => cardKey(w) === ck ? { ...w, qty } : w) };
    }

    case 'APPLY_COLLECTION': {
      // Apply collection owned counts to all decks
      const decks = state.decks.map(d => {
        const om = { ...d.ownedMap };
        for (const rc of d.rawCards) {
          const ck = cardKey(rc);
          const owned = action.collection[ck] ?? action.collection[rc.name];
          if (owned !== undefined) om[ck] = Math.min(rc.qty, owned);
        }
        return { ...d, ownedMap: om };
      });
      return { ...state, decks, collection: action.collection };
    }

    case 'IMPORT_ALL': {
      return {
        ...state,
        decks: action.decks,
        collection: action.collection || {},
      };
    }

    default:
      return state;
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, load);

  useEffect(() => { save(state); }, [state]);

  const getApiData = useCallback((rc) => {
    return state.apiCache[cardKey(rc)] ?? null;
  }, [state.apiCache]);

  const getDeckOwned = useCallback((deck, rc) => {
    return sumOwnedArr(deck.ownedMap?.[cardKey(rc)], rc.qty);
  }, []);

  // Returns per-copy owned array (1=owned, 0=not owned), length=rc.qty
  const getDeckOwnedArr = useCallback((deck, rc) => {
    return toOwnedArr(deck.ownedMap?.[cardKey(rc)], rc.qty);
  }, []);

  const getDeckBling = useCallback((deck, rc) => {
    return getBlingArray(deck.blingSel?.[cardKey(rc)], rc.qty);
  }, []);

  const deckPct = useCallback((deck) => {
    let tot = 0, own = 0;
    for (const rc of deck.rawCards) {
      tot += rc.qty;
      own += getDeckOwned(deck, rc);
    }
    return tot > 0 ? Math.round((own / tot) * 100) : 0;
  }, [getDeckOwned]);

  const deckCost = useCallback((deck, ownedOnly = false) => {
    let total = 0;
    for (const rc of deck.rawCards) {
      const api = getApiData(rc);
      const ownedArr = getDeckOwnedArr(deck, rc);
      const blingArr = getBlingArray(deck.blingSel?.[cardKey(rc)], rc.qty);
      for (let i = 0; i < rc.qty; i++) {
        if (ownedOnly && ownedArr[i]) continue;
        const price = blingArr[i]?.marketPrice ?? api?.marketPrice;
        if (price) total += price;
      }
    }
    return total;
  }, [getApiData, getDeckOwnedArr]);

  return (
    <Ctx.Provider value={{ state, dispatch, getApiData, getDeckOwned, getDeckOwnedArr, getDeckBling, deckPct, deckCost }}>
      {children}
    </Ctx.Provider>
  );
}

export function useStore() {
  return useContext(Ctx);
}
