import { PTCGO_TO_SET_ID, ALL_SETS } from '../data/sets';

const TCG_API = 'https://api.pokemontcg.io/v2/cards';

// Reverse map: TCG API set ID (e.g. 'sv4') → PTCGO code (e.g. 'PAR')
// Used to fill in setCode when the API returns no ptcgoCode for a set.
const SET_ID_TO_CODE = Object.fromEntries(ALL_SETS.filter(s => s.id).map(s => [s.id, s.code]));
// Maps PTCGL energy symbol notation {D} → card name word e.g. "Darkness"
const ENERGY_SYMBOLS = { D:'Darkness',F:'Fire',R:'Fire',W:'Water',G:'Grass',L:'Lightning',P:'Psychic',C:'Colorless',M:'Metal',Y:'Fairy',N:'Dragon' };
export function expandEnergySymbols(name) {
  if (!name) return name;
  let n = name.replace(/\{([A-Z])\}/g, (_, t) => ENERGY_SYMBOLS[t] || t).replace(/\s+/g,' ').trim();
  // Strip "Basic " prefix — pokemontcg.io names energies as "Darkness Energy" not "Basic Darkness Energy"
  n = n.replace(/^Basic (\w+ Energy)$/i, '$1');
  return n;
}

// Returns the energy type (e.g. 'Darkness') if the card name is a basic energy, else null.
// Matches "Darkness Energy", "Basic Darkness Energy", "Basic {D} Energy" (after expansion), etc.
const BASIC_ENERGY_TYPES = ['Grass','Fire','Water','Lightning','Psychic','Fighting','Darkness','Metal','Fairy','Colorless','Dragon'];
export function getBasicEnergyType(name) {
  if (!name) return null;
  const n = expandEnergySymbols(name);
  const m = n.match(/^(?:Basic )?(Grass|Fire|Water|Lightning|Psychic|Fighting|Darkness|Metal|Fairy|Colorless|Dragon) Energy$/i);
  return m ? m[1] : null;
}
const CARD_SELECT = 'id,name,supertype,subtypes,types,set,rarity,images,legalities,regulationMark,tcgplayer,number,attacks,hp,abilities,weaknesses,retreatCost';

let apiKey = localStorage.getItem('ptcg_apikey') || '';
const cache = new Map();

// Persist card cache to localStorage so it survives page reloads
const CACHE_KEY = 'tcg_card_cache';
const CACHE_VERSION = 6;

(function hydrateCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed.v !== CACHE_VERSION) return; // bust on version change
    for (const [k, v] of Object.entries(parsed.data)) if (v !== null) cache.set(k, v);
  } catch {}
})();

let _saveTimer = null;
function persistCache() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try {
      const data = {};
      for (const [k, v] of cache) if (v !== null) data[k] = v; // don't persist nulls; retry on next load
      localStorage.setItem(CACHE_KEY, JSON.stringify({ v: CACHE_VERSION, data }));
    } catch {}
  }, 500);
}

// Returns the cached card data by setCode+num, or undefined if not cached yet
export function getCachedCard(setCode, num) {
  if (!setCode || !num) return undefined;
  return cache.get(cacheKey(setCode, num));
}

// Returns per-set { totalValue, cachedCount } from the persistent module cache
export function getCachedSetStats() {
  const stats = {};
  for (const card of cache.values()) {
    if (!card?.setId) continue;
    const sid = card.setId;
    if (!stats[sid]) stats[sid] = { totalValue: 0, cachedCount: 0 };
    stats[sid].totalValue += (card.marketPrice || 0);
    stats[sid].cachedCount++;
  }
  return stats;
}

export function setApiKey(key) {
  apiKey = key;
  localStorage.setItem('ptcg_apikey', key);
}
export function getApiKey() { return apiKey; }

function headers() {
  return apiKey ? { 'X-Api-Key': apiKey } : {};
}

function cacheKey(setCode, num) {
  return `${setCode}-${num}`.toLowerCase();
}

export function parseCard(c) {
  const tcg = c.tcgplayer?.prices;
  const marketPrice =
    tcg?.holofoil?.market ??
    tcg?.normal?.market ??
    tcg?.['1stEditionHolofoil']?.market ??
    tcg?.reverseHolofoil?.market ??
    null;
  return {
    id: c.id,
    name: c.name,
    supertype: c.supertype,
    subtypes: c.subtypes || [],
    setName: c.set?.name || '',
    setId: c.set?.id || '',
    setCode: c.set?.ptcgoCode || SET_ID_TO_CODE[c.set?.id] || '',
    number: c.number || '',
    rarity: c.rarity || '',
    imageSmall: c.images?.small || '',
    imageLarge: c.images?.large || '',
    legalities: c.legalities || {},
    regulationMark: c.regulationMark || '',
    tcgplayerUrl: c.tcgplayer?.url || '',
    marketPrice,
    reverseHoloPrice: tcg?.reverseHolofoil?.market ?? null,
    stampedPrice: tcg?.stampedHolofoil?.market ?? tcg?.stamped?.market ?? null,
    rawTcg: tcg || null,
    types: c.types || [],
    hp: c.hp || '',
    attacks: (c.attacks || []).map(a => a.name),
    attacksFull: c.attacks || [],
    abilities: c.abilities || [],
    weaknesses: c.weaknesses || [],
    retreatCost: c.retreatCost?.length ?? null,
  };
}

export async function lookupCard(setCode, num, cardName) {
  if (!setCode || !num) return null;
  const key = cacheKey(setCode, num);
  if (cache.has(key) && cache.get(key) !== null) return cache.get(key);

  // Basic energies: always skip set/number lookup — pokemontcg.io may have a hyper rare / special
  // art at that number (e.g. SVE-23 = special illustration rare Darkness Energy). We always want
  // the most recent common-rarity print instead.
  const energyTypeDirect = getBasicEnergyType(cardName || '');
  if (energyTypeDirect) {
    const q = encodeURIComponent(`name:"${energyTypeDirect} Energy" supertype:Energy rarity:Common`);
    const res = await fetch(`${TCG_API}?q=${q}&select=${CARD_SELECT}&pageSize=1&orderBy=-set.releaseDate`, { headers: headers() });
    if (res.ok) {
      const d = await res.json();
      if (d.data?.length) {
        const parsed = parseCard(d.data[0]);
        cache.set(key, parsed); persistCache();
        return parsed;
      }
    }
    cache.set(key, null); persistCache();
    return null;
  }

  try {
    const setId = PTCGO_TO_SET_ID[setCode.toUpperCase()];

    // Strategy 1: direct ID lookup (most precise)
    if (setId) {
      const normalizedName = cardName ? expandEnergySymbols(cardName) : '';
      for (const n of [num, num.padStart(3, '0')]) {
        const res = await fetch(`${TCG_API}/${setId}-${n}?select=${CARD_SELECT}`, { headers: headers() });
        if (res.ok) {
          const d = await res.json();
          if (d.data) {
            // If name given, verify it matches (avoids wrong card at same number)
            // Also check reverse: API name inside our name (e.g. "Darkness Energy" inside "Basic Darkness Energy")
            const apiNameL = d.data.name.toLowerCase();
            const ourNameL = normalizedName.toLowerCase();
            const nameMatch = !normalizedName
              || apiNameL.includes(ourNameL.split(' ')[0])
              || ourNameL.includes(apiNameL);
            if (nameMatch) {
              const parsed = parseCard(d.data);
              cache.set(key, parsed); persistCache();
              return parsed;
            }
          }
        }
      }
    }

    // Strategy 2: name + number search
    if (cardName) {
      const safeName = expandEnergySymbols(cardName).replace(/[^a-zA-Z0-9 ]/g, '').trim();
      const q = encodeURIComponent(`name:"${safeName}" number:${num}`);
      const res = await fetch(`${TCG_API}?q=${q}&select=${CARD_SELECT}`, { headers: headers() });
      if (res.ok) {
        const d = await res.json();
        if (d.data?.length) {
          const pick = d.data.find(c => c.set?.ptcgoCode?.toLowerCase() === setCode.toLowerCase())
            || d.data.find(c => c.number === num)
            || d.data[0];
          const parsed = parseCard(pick);
          cache.set(key, parsed); persistCache();
          return parsed;
        }
      }
    }

    // Strategy 3: ptcgoCode + number
    const q2 = encodeURIComponent(`number:${num} set.ptcgoCode:${setCode}`);
    const res2 = await fetch(`${TCG_API}?q=${q2}&select=${CARD_SELECT}`, { headers: headers() });
    if (res2.ok) {
      const d = await res2.json();
      if (d.data?.length) {
        const parsed = parseCard(d.data[0]);
        cache.set(key, parsed); persistCache();
        return parsed;
      }
    }

    // Strategy 4: basic energy fallback (should rarely be reached now)
    const energyType = getBasicEnergyType(cardName || '');
    if (energyType) {
      const q3 = encodeURIComponent(`name:"${energyType} Energy" supertype:Energy rarity:Common`);
      const res3 = await fetch(`${TCG_API}?q=${q3}&select=${CARD_SELECT}&pageSize=1&orderBy=-set.releaseDate`, { headers: headers() });
      if (res3.ok) {
        const d = await res3.json();
        if (d.data?.length) {
          const parsed = parseCard(d.data[0]);
          cache.set(key, parsed); persistCache();
          return parsed;
        }
      }
    }

    cache.set(key, null); persistCache();
    return null;
  } catch {
    cache.set(key, null); persistCache();
    return null;
  }
}

// Fetch and cache set metadata (logos, totals, release dates)
const SETS_META_KEY = 'tcg_sets_meta';
const SETS_META_VERSION = 3;
let setsMetaCache = null;

export async function fetchSetsMetadata() {
  if (setsMetaCache) return setsMetaCache;
  try {
    const stored = localStorage.getItem(SETS_META_KEY);
    if (stored) {
      const p = JSON.parse(stored);
      if (p.v === SETS_META_VERSION) { setsMetaCache = p.data; return setsMetaCache; }
    }
  } catch {}
  try {
    const res = await fetch(`https://api.pokemontcg.io/v2/sets?orderBy=-releaseDate&pageSize=250`, { headers: headers() });
    if (res.ok) {
      const d = await res.json();
      const data = {};
      for (const s of (d.data || [])) {
        data[s.id] = { id: s.id, name: s.name, logo: s.images?.logo || '', symbol: s.images?.symbol || '', total: s.total || s.printedTotal || 0, releaseDate: s.releaseDate || '', ptcgoCode: s.ptcgoCode || '' };
      }
      setsMetaCache = data;
      try { localStorage.setItem(SETS_META_KEY, JSON.stringify({ v: SETS_META_VERSION, data })); } catch {}
      return data;
    }
  } catch {}
  return {};
}

// Fetch alternate prints of a card (for bling selector).
// Fetches all cards with the same name, then filters to only those with
// matching HP + attacks (same card design, different set/art treatment).
// Falls back to set-only if hp/attacks aren't loaded yet.
// Pass loose:true to skip HP/attacks filtering (used for stamped promo lookup).
const printsCache = new Map();
export async function fetchAllPrints(cardName, { supertype, hp, attackNames, attacksFull, regulationMark, setId, loose } = {}) {
  const isPokemon = supertype?.toLowerCase() === 'pokémon' || supertype?.toLowerCase() === 'pokemon';
  const energyType = getBasicEnergyType(cardName);
  // Compact damage+cost signature so different evolutions of the same-named card get separate cache entries
  const dmgSig = (!loose && isPokemon && attacksFull?.length)
    ? attacksFull.map(a => `${a.name}:${a.damage || ''}:${(a.cost || []).slice().sort().join('')}`).sort().join('|')
    : '';
  // Basic energies share one cache entry regardless of "Basic X Energy" vs "X Energy" naming
  const key = energyType
    ? `energy||${energyType.toLowerCase()}`
    : loose
      ? `${cardName.toLowerCase()}||loose`
      : `${cardName.toLowerCase()}||${isPokemon ? `${hp || ''}||${(attackNames || []).sort().join(',')}||${regulationMark || ''}||${dmgSig}` : 'trainer'}`;
  if (printsCache.has(key)) return printsCache.get(key);

  try {
    const energyType = getBasicEnergyType(cardName);

    let q;
    if (energyType) {
      // Basic energy: search broadly by type — catches "Darkness Energy", "Basic Darkness Energy", etc.
      q = `name:${energyType} name:Energy supertype:Energy`;
    } else {
      // Split name into individual words to avoid Lucene issues with apostrophes/colons.
      // "Boss's Orders" → ["Boss", "Orders"] → `name:Boss name:Orders`
      const words = cardName.split(/[^a-zA-Z0-9]+/).filter(w => w.length >= 2);
      q = words.map(w => `name:${w}`).join(' ') || `name:${cardName}`;
    }

    const pageSize = 250;
    const res = await fetch(`${TCG_API}?q=${encodeURIComponent(q)}&select=${CARD_SELECT}&pageSize=${pageSize}&orderBy=set.releaseDate`, { headers: headers() });
    if (res.ok) {
      const d = await res.json();
      let cards = (d.data || []).map(parseCard);
      const totalCount = d.totalCount || 0;
      if (totalCount > pageSize) {
        const totalPages = Math.ceil(totalCount / pageSize);
        const extra = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) =>
            fetch(`${TCG_API}?q=${encodeURIComponent(q)}&select=${CARD_SELECT}&pageSize=${pageSize}&page=${i + 2}&orderBy=set.releaseDate`, { headers: headers() })
              .then(r => r.ok ? r.json() : { data: [] })
          )
        );
        for (const pd of extra) cards = cards.concat((pd.data || []).map(parseCard));
      }

      const normalize = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
      if (energyType) {
        // For basic energies: keep any card whose name contains the energy type and "energy"
        const et = energyType.toLowerCase();
        cards = cards.filter(c => {
          const n = normalize(c.name);
          return n.includes(et) && n.includes('energy');
        });
      } else {
        // Filter to name match. Strip parenthetical suffixes before comparing so that
        // "Boss's Orders (Geeta)" / "Boss's Orders (Cyrus)" match a search for "Boss's Orders".
        const stripParens = s => s.replace(/\s*\([^)]*\)/g, '').trim();
        const normBase = normalize(stripParens(cardName));
        cards = cards.filter(c => normalize(stripParens(c.name)) === normBase);
      }

      // For Pokémon, further filter client-side to matching HP + attacks (skipped in loose mode)
      if (!loose && isPokemon && hp && attackNames?.length) {
        const wantedAttacks = new Set(attackNames.map(a => a.toLowerCase()));
        cards = cards.filter(c => {
          if (c.hp !== hp) return false;
          const cardAttacks = new Set(c.attacks.map(a => a.toLowerCase()));
          if (![...wantedAttacks].every(a => cardAttacks.has(a))) return false;
          // Cross-check damage + energy cost when full attack data is available
          if (attacksFull?.length) {
            for (const wanted of attacksFull) {
              const found = c.attacksFull.find(a => a.name?.toLowerCase() === wanted.name?.toLowerCase());
              if (!found) return false;
              if ((found.damage || '') !== (wanted.damage || '')) return false;
              const wCost = (wanted.cost || []).slice().sort().join(',');
              const fCost = (found.cost || []).slice().sort().join(',');
              if (wCost !== fCost) return false;
            }
          }
          return true;
        });
      }

      printsCache.set(key, cards);
      return cards;
    }
  } catch {}
  printsCache.set(key, []);
  return [];
}

// Fetch live Prize Pack Series price for a specific card by name + number.
// Uses the Vite dev proxy (/tcgplayer-search) to avoid CORS — falls back gracefully if unavailable.
const prizePackPriceCache = new Map();
export async function fetchPrizePackPrice(cardName, cardNumber) {
  const norm = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const key = norm(cardName) + '|' + String(cardNumber).replace(/^0+/, '');
  if (prizePackPriceCache.has(key)) return prizePackPriceCache.get(key);

  try {
    const res = await fetch('/tcgplayer-search/v1/search/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 0, size: 10,
        filters: {
          term: { productLineName: ['pokemon'], setName: ['Prize Pack Series Cards'] },
          range: {}, match: { productName: cardName },
        },
        context: { shippingCountry: 'US' },
        settings: { useFuzzySearch: false },
        sort: {},
      }),
    });
    if (!res.ok) throw new Error('non-200');
    const d = await res.json();
    const items = d?.results?.[0]?.results ?? [];
    // Find the matching card by normalized name + leading number
    const match = items.find(p => {
      const pName = norm(p.productName || '');
      const pNum = (p.customAttributes?.number || '').toString().split('/')[0].replace(/^0+/, '');
      return pName === norm(cardName) && pNum === String(cardNumber).replace(/^0+/, '');
    });
    const price = match?.marketPrice ?? null;
    prizePackPriceCache.set(key, price);
    return price;
  } catch {
    return null;
  }
}

// Fetch cards for deck builder (by set + optional search)
export async function searchCards(query, setId, page = 1) {
  try {
    let q = '';
    if (query) {
      const allWords = query.split(/[^a-zA-Z0-9]+/).filter(Boolean);
      const words = allWords.filter(w => w.length >= 2).length > 0
        ? allWords.filter(w => w.length >= 2)
        : allWords; // fall back to short tokens if nothing longer (e.g. "n's")
      if (words.length) q += words.map(w => `name:${w}*`).join(' ');
    }
    if (setId) q += (q ? ' ' : '') + `set.id:${setId}`;
    if (!q) return { cards: [], totalCount: 0 };

    const encoded = encodeURIComponent(q);
    // Within a set: sort by number; global search: newest sets first
    const orderBy = setId ? 'number' : '-set.releaseDate,number';
    const pageSize = setId ? 250 : 20;

    function parsePage(data) {
      return (data || []).map(c => {
        const parsed = parseCard(c);
        if (parsed.setCode && parsed.number) {
          const key = cacheKey(parsed.setCode, parsed.number);
          if (!cache.has(key)) cache.set(key, parsed);
        }
        return parsed;
      });
    }

    const res = await fetch(
      `${TCG_API}?q=${encoded}&select=${CARD_SELECT}&pageSize=${pageSize}&page=${page}&orderBy=${orderBy}`,
      { headers: headers() }
    );
    if (res.ok) {
      const d = await res.json();
      let cards = parsePage(d.data);
      const totalCount = d.totalCount || 0;

      // Fetch remaining pages in parallel when browsing a full set (no text query)
      if (setId && !query && totalCount > pageSize) {
        const totalPages = Math.ceil(totalCount / pageSize);
        const extra = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) =>
            fetch(`${TCG_API}?q=${encoded}&select=${CARD_SELECT}&pageSize=${pageSize}&page=${i + 2}&orderBy=${orderBy}`, { headers: headers() })
              .then(r => r.ok ? r.json() : { data: [] })
          )
        );
        for (const pd of extra) cards = cards.concat(parsePage(pd.data));
      }

      persistCache();
      // Sort numerically by card number (API sorts lexicographically, "10" < "2")
      if (setId) cards.sort((a, b) => (parseInt(a.number) || 0) - (parseInt(b.number) || 0));
      return { cards, totalCount };
    }
  } catch {}
  return { cards: [], totalCount: 0 };
}
