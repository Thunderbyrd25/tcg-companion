import { PTCGO_TO_SET_ID, ALL_SETS } from '../data/sets';

// ── Feature flag ─────────────────────────────────────────────────────────────
// Set to true to route card lookups + set browsing through TCGDex instead of
// pokemontcg.io. Legality data (regulationMark, legalities) and TCGPlayer prices
// are NOT available from TCGDex, so Standard legality checking will be degraded.
// Flip back to false to revert with zero other changes needed.
export const USE_TCGDEX = false;

// Rollback flag: flip to true to bypass our Scrydex-backed backend and hit
// pokemontcg.io directly again (restores the old X-Api-Key header path below).
// Keep this around through the rollout window; remove once the new backend's
// been the default in production for a while with no issues.
export const USE_LEGACY_PTCGIO = false;
// ─────────────────────────────────────────────────────────────────────────────

const TCG_API = USE_LEGACY_PTCGIO ? 'https://api.pokemontcg.io/v2/cards' : '/api/cards';
export const CARD_IMAGE_PLACEHOLDER = '/card-placeholder.svg';

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
const CARD_SELECT = 'id,name,supertype,subtypes,types,set,rarity,images,legalities,regulationMark,tcgplayer,number,attacks,hp,abilities,weaknesses,retreatCost,rules,nationalPokedexNumbers';

let apiKey = localStorage.getItem('ptcg_apikey') || '';
const cache = new Map();

// Persist card cache to localStorage so it survives page reloads
const CACHE_KEY = 'tcg_card_cache';
const CACHE_VERSION = 16;

(function hydrateCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed.v !== CACHE_VERSION) {
      localStorage.removeItem(CACHE_KEY); // delete stale data so it doesn't outlast the version bump
      return;
    }
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
  return USE_LEGACY_PTCGIO && apiKey ? { 'X-Api-Key': apiKey } : {};
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
    rules: c.rules || [],
    nationalPokedexNumbers: c.nationalPokedexNumbers || [],
  };
}

export async function lookupCard(setCode, num, cardName) {
  if (USE_TCGDEX) return lookupCardTCGDex(setCode, num, cardName);
  if (!setCode || !num) return null;
  const key = cacheKey(setCode, num);
  if (cache.has(key) && cache.get(key) !== null) return cache.get(key);

  try {
    const setId = PTCGO_TO_SET_ID[setCode.toUpperCase()];

    // Some promo sets use letter-prefixed card numbers in the API (e.g. XY promos: XY126, BW promos: BW100).
    // When the input num is plain digits, also try the prefixed variant.
    const PROMO_NUM_PREFIX = { xyp: 'XY', bwp: 'BW' };
    const promoPrefix = setId ? (PROMO_NUM_PREFIX[setId] || '') : '';

    // Strategy 1: direct ID lookup (most precise)
    if (setId) {
      const normalizedName = cardName ? expandEnergySymbols(cardName) : '';
      const numsToTry = [num, num.padStart(3, '0')];
      if (promoPrefix && /^\d+$/.test(num)) {
        numsToTry.push(`${promoPrefix}${num}`);
        numsToTry.push(`${promoPrefix}${num.padStart(2, '0')}`);
      }
      for (const n of [...new Set(numsToTry)]) {
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

    // Strategy 1.5: basic energy — never fall through to Strategies 2/3 (they match wrong Pokémon)
    const energyType = getBasicEnergyType(cardName || '');
    if (energyType) {
      if (setId) {
        // 1.5a: exact set + number (handles specific art variants like SVE 18)
        const qExact = encodeURIComponent(`name:"${energyType} Energy" set.id:${setId} number:${num}`);
        const resExact = await fetch(`${TCG_API}?q=${qExact}&select=${CARD_SELECT}&pageSize=1`, { headers: headers() });
        if (resExact.ok) {
          const dExact = await resExact.json();
          if (dExact.data?.length) {
            const parsed = parseCard(dExact.data[0]);
            cache.set(key, parsed); persistCache();
            return parsed;
          }
        }
        // 1.5b: any energy of this type in the set (handles Energy N → set conversions where number is wrong)
        const qSet = encodeURIComponent(`name:"${energyType} Energy" set.id:${setId}`);
        const resSet = await fetch(`${TCG_API}?q=${qSet}&select=${CARD_SELECT}&pageSize=1`, { headers: headers() });
        if (resSet.ok) {
          const dSet = await resSet.json();
          if (dSet.data?.length) {
            const parsed = parseCard(dSet.data[0]);
            cache.set(key, parsed); persistCache();
            return parsed;
          }
        }
      }
      // Strategy 1.5c: SVE fallback — if the specified set has no basic energies of this type,
      // show the SVE (Scarlet & Violet Energies) art so the card isn't blank.
      const sveSetId = PTCGO_TO_SET_ID['SVE'];
      if (sveSetId && setId !== sveSetId) {
        const qSVE = encodeURIComponent(`name:"${energyType} Energy" set.id:${sveSetId}`);
        const resSVE = await fetch(`${TCG_API}?q=${qSVE}&select=${CARD_SELECT}&pageSize=1`, { headers: headers() });
        if (resSVE.ok) {
          const dSVE = await resSVE.json();
          if (dSVE.data?.length) {
            const parsed = parseCard(dSVE.data[0]);
            cache.set(key, parsed); persistCache();
            return parsed;
          }
        }
      }
      // pokemontcg.io has no match — try TCGDex before giving up
      return lookupCardTCGDex(setCode, num, cardName);
    }

    // Strategy 2: name + number search (non-energy cards only)
    if (cardName) {
      const safeName = expandEnergySymbols(cardName).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9 '.'\-]/g, '').trim();
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

    // Strategy 3: ptcgoCode + number (non-energy cards only)
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

    // All pokemontcg.io strategies failed — try TCGDex
    return lookupCardTCGDex(setCode, num, cardName);
  } catch {
    return lookupCardTCGDex(setCode, num, cardName);
  }
}

// Fetch and cache set metadata (logos, totals, release dates)
const SETS_META_KEY = 'tcg_sets_meta';
const SETS_META_VERSION = 4;
let setsMetaCache = null;

export async function fetchSetsMetadata() {
  if (USE_TCGDEX) return fetchSetsMetadataTCGDex();
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

// Fetch all prints of a card by name, cache them, and return any standard-legal ones
// matching the given subtypes. Used by useEnrich to proactively populate apiCache with
// legal reprints for cards that are outside the current Standard era range.
// reprintSearched prevents redundant API calls within a session.
const reprintSearched = new Set();
// Fetch standard-legal reprints of a card, filtering to the same card design.
// subtypes: used to require same subtype (prevents basic energy matching special energy).
// hp + attacks: for Pokémon, require same HP and at least one shared attack so a modern
// Azelf V doesn't count as a legal reprint of the old DP-era Azelf.
export async function fetchReprintsForLegality(name, { subtypes, hp, attacks } = {}) {
  const key = `${name.toLowerCase()}||${(subtypes || []).slice().sort().join(',')}`;
  if (reprintSearched.has(key)) return [];
  reprintSearched.add(key);
  try {
    // Normalize accented chars to ASCII (é→e etc.) and keep dots/hyphens/apostrophes
    // that appear in real card names ("Pokégear 3.0", "Mr. Mime", "Wo-Chien ex").
    // Strip only characters that would break the quoted query syntax.
    const safeName = name
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // strip diacritics
      .replace(/[^a-zA-Z0-9 '.'\-]/g, '')                 // keep alnum, space, dot, apostrophe, hyphen
      .trim();
    const q = encodeURIComponent(`name:"${safeName}"`);
    const res = await fetch(
      `${TCG_API}?q=${q}&select=${CARD_SELECT}&pageSize=50&orderBy=-set.releaseDate`,
      { headers: headers() }
    );
    if (res.ok) {
      const d = await res.json();
      const cards = (d.data || []).map(parseCard);
      for (const c of cards) {
        const ck = cacheKey(c.setCode, c.number);
        if (!cache.has(ck)) { cache.set(ck, c); }
      }
      persistCache();
      return cards.filter(c => {
        if (c.legalities?.standard !== 'Legal') return false;
        if (subtypes?.length && !subtypes.some(st => c.subtypes?.includes(st))) return false;
        // For Pokémon: require identical HP and exact same attack list
        if (hp && attacks?.length) {
          if (c.hp !== hp) return false;
          const cAtks = (c.attacks || []).map(a => a.toLowerCase()).sort();
          const srcAtks = [...attacks].map(a => a.toLowerCase()).sort();
          if (cAtks.length !== srcAtks.length || !srcAtks.every((a, i) => a === cAtks[i])) return false;
        }
        return true;
      });
    }
  } catch {}
  return [];
}

// Fetch alternate prints of a card (for bling selector).
// Fetches all cards with the same name, then filters to only those with
// matching HP + attacks (same card design, different set/art treatment).
// Falls back to set-only if hp/attacks aren't loaded yet.
// Pass loose:true to skip HP/attacks filtering (used for stamped promo lookup).
const printsCache = new Map();
export async function fetchAllPrints(cardName, { supertype, subtypes, hp, attackNames, attacksFull, regulationMark, loose } = {}) {
  const isPokemon = supertype?.toLowerCase() === 'pokémon' || supertype?.toLowerCase() === 'pokemon';
  // Don't treat special energies (old Metal/Darkness Energy) as basic energies in the print search
  const isSpecialEnergy = subtypes?.includes('Special');
  const energyType = isSpecialEnergy ? null : getBasicEnergyType(cardName);
  // Compact damage+cost signature so different evolutions of the same-named card get separate cache entries
  const dmgSig = (!loose && isPokemon && attacksFull?.length)
    ? attacksFull.map(a => `${a.name}:${a.damage || ''}:${(a.cost || []).slice().sort().join('')}`).sort().join('|')
    : '';
  // Basic energies share one cache entry regardless of "Basic X Energy" vs "X Energy" naming
  const key = energyType
    ? `energy||${energyType.toLowerCase()}`
    : isSpecialEnergy
      ? `special-energy||${cardName.toLowerCase()}`
      : loose
        ? `${cardName.toLowerCase()}||loose`
        : `${cardName.toLowerCase()}||${isPokemon ? `${hp || ''}||${(attackNames || []).sort().join(',')}||${regulationMark || ''}||${dmgSig}` : 'trainer'}`;
  if (printsCache.has(key)) return printsCache.get(key);

  try {
    let q;
    if (energyType) {
      // Use quoted phrase so "name:Water Energy" doesn't OR-expand to include all Energy cards.
      // subtypes:Basic excludes special energies (Wash Energy, Speed Energy, Heat Energy, etc.).
      q = `name:"${energyType} Energy" supertype:Energy subtypes:Basic`;
    } else if (isSpecialEnergy) {
      // Special energies: exact name + Special subtype so basic prints don't mix in.
      const safeName = cardName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9 '.'\-]/g, '').trim();
      q = `name:"${safeName}" supertype:Energy subtypes:Special`;
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
        // Keep only Basic energies matching this type — excludes special energies client-side too.
        const et = energyType.toLowerCase();
        cards = cards.filter(c => {
          const n = normalize(c.name);
          return n.includes(et) && n.includes('energy')
            && (c.subtypes?.includes('Basic') || !c.subtypes?.length);
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
          if (cardAttacks.size !== wantedAttacks.size) return false;
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

// Fetch all cards featuring a given national Pokédex number.
// Used for "Other Appearances" — shows every card that features the same Pokémon
// regardless of card name (e.g. Darkrai Legend shows up for Darkrai #491).
const appearancesCache = new Map();
export async function fetchAllAppearances(pokedexNumbers) {
  if (!pokedexNumbers?.length) return [];
  const num = pokedexNumbers[0];
  const key = `appearances-${num}`;
  if (appearancesCache.has(key)) return appearancesCache.get(key);
  try {
    const q = encodeURIComponent(`nationalPokedexNumbers:${num}`);
    const res = await fetch(
      `${TCG_API}?q=${q}&select=id,name,images,set,number&pageSize=250&orderBy=set.releaseDate`,
      { headers: headers() }
    );
    if (res.ok) {
      const d = await res.json();
      const cards = (d.data || []).map(c => ({
        id: c.id,
        name: c.name,
        setName: c.set?.name || '',
        setCode: c.set?.ptcgoCode || SET_ID_TO_CODE[c.set?.id] || '',
        number: c.number || '',
        imageSmall: c.images?.small || '',
      }));
      appearancesCache.set(key, cards);
      return cards;
    }
  } catch {}
  appearancesCache.set(key, []);
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

// Fetch a specific card image for splash display (format container art).
// Results are persisted to localStorage so they survive page reloads.
const SPLASH_LS_KEY = 'tcg_splash_v5';
const splashMemCache = new Map();
(function hydrateSplash() {
  try {
    const raw = localStorage.getItem(SPLASH_LS_KEY);
    if (raw) for (const [k, v] of Object.entries(JSON.parse(raw))) if (v) splashMemCache.set(k, v);
  } catch {}
})();
let _splashTimer = null;
function persistSplash() {
  clearTimeout(_splashTimer);
  _splashTimer = setTimeout(() => {
    try {
      const data = {};
      for (const [k, v] of splashMemCache) if (v) data[k] = v;
      localStorage.setItem(SPLASH_LS_KEY, JSON.stringify(data));
    } catch {}
  }, 800);
}
export async function fetchSplashImage({ name, setCode, number } = {}) {
  const cKey = `${name.toLowerCase()}||${setCode || ''}||${number || ''}`;
  if (splashMemCache.has(cKey)) return splashMemCache.get(cKey);
  try {
    // Prefer set.id over set.ptcgoCode — newer SV sets often lack ptcgoCode in the API
    const setFilter = setCode
      ? (PTCGO_TO_SET_ID[setCode.toUpperCase()] ? ` set.id:${PTCGO_TO_SET_ID[setCode.toUpperCase()]}` : ` set.ptcgoCode:${setCode}`)
      : '';
    let q;
    if (setCode && number) {
      // Exact lookup by set + number, no name needed
      q = `number:${number}${setFilter}`;
    } else if (/[^a-zA-Z0-9 ']/.test(name)) {
      // Name contains special chars (& - . etc.) — word-based query, rely on client-side filter
      const words = name.split(/[^a-zA-Z0-9]+/).filter(w => w.length >= 2);
      q = words.map(w => `name:${w}`).join(' ') + setFilter;
    } else {
      // Clean name — quoted phrase gives precise results
      q = `name:"${name.trim()}"${setFilter}`;
    }
    const res = await fetch(
      `${TCG_API}?q=${encodeURIComponent(q)}&pageSize=20&orderBy=number&select=images,name,number,set`,
      { headers: headers() }
    );
    if (res.ok) {
      const d = await res.json();
      // Normalize both sides: strip non-alphanumeric to spaces, collapse whitespace
      const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
      const target = norm(name);
      let card = d.data?.find(c => norm(c.name) === target)
        ?? (number ? d.data?.find(c => c.number === String(number)) : null)
        ?? d.data?.[0];
      const img = card?.images?.large || card?.images?.small || null;
      splashMemCache.set(cKey, img);
      persistSplash();
      return img;
    }
  } catch {}
  // Do NOT cache failures — let them retry on next load rather than permanently storing null
  return null;
}

// Search cards by name with optional format legality filter.
// legalityFormat: 'Standard' | 'Expanded' | null (no filter)
export async function searchByName(query, { legalityFormat } = {}) {
  if (!query?.trim() || query.trim().length < 2) return [];
  try {
    const words = query.trim().split(/[^a-zA-Z0-9']+/).filter(w => w.length >= 1);
    let q = words.map(w => `name:${w}*`).join(' ');
    // Use capital-L values — pokemontcg.io stores legalities as 'Legal'/'Banned', not lowercase
    if (legalityFormat === 'Standard') q += ' legalities.standard:Legal';
    else if (legalityFormat === 'Expanded') q += ' legalities.expanded:Legal';
    const res = await fetch(
      `${TCG_API}?q=${encodeURIComponent(q)}&select=${CARD_SELECT}&pageSize=20&orderBy=-set.releaseDate,number`,
      { headers: headers() }
    );
    if (res.ok) {
      const d = await res.json();
      let cards = (d.data || []).map(c => {
        const parsed = parseCard(c);
        if (parsed.setCode && parsed.number) cache.set(cacheKey(parsed.setCode, parsed.number), parsed);
        return parsed;
      });
      // Client-side filter as safety net — API legality index can occasionally include stale entries
      if (legalityFormat === 'Standard') cards = cards.filter(c => c.legalities?.standard === 'Legal');
      else if (legalityFormat === 'Expanded') cards = cards.filter(c => c.legalities?.expanded === 'Legal');
      persistCache();
      return cards;
    }
  } catch {}
  return [];
}

// Fetch cards for deck builder (by set + optional search)
// ptcgoCode: optional fallback — if setId search returns 0 cards, retry with set.ptcgoCode
export async function searchCards(query, setId, page = 1, ptcgoCode = null) {
  if (USE_TCGDEX) return searchCardsTCGDex(query, setId, page, ptcgoCode);
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
    else if (ptcgoCode) q += (q ? ' ' : '') + `set.ptcgoCode:${ptcgoCode}`;
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

      // On the first page of a full-set browse, fetch all remaining pages in parallel.
      // Only runs for page=1 — the Load more button handles subsequent pages one at a time,
      // so re-running this block on page 2+ would re-fetch already-loaded pages.
      if (setId && !query && page === 1 && totalCount > pageSize) {
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

// ── TCGDex shared constants ───────────────────────────────────────────────────
const TCGDEX_API = 'https://api.tcgdex.net/v2/en';
// Maps our internal set IDs → TCGDex set IDs (only entries that differ).
// Mega Evolution sets (me1-me3, mep) used to live here because pokemontcg.io
// didn't carry them — our Scrydex-backed backend now has complete, correct
// data (including images) for all of them, so they no longer need the TCGDex
// detour. Left empty rather than removed, as a fallback for any future set
// our backend hasn't backfilled yet.
const TCGDEX_ID_MAP = {};
const TCGDEX_ID_MAP_REVERSE = Object.fromEntries(Object.entries(TCGDEX_ID_MAP).map(([k,v])=>[v,k]));
export const TCGDEX_SET_TOTALS = {};
const tcgdexSetCache = new Map();

// Internal helper — fetches a TCGDex set by TCGDex ID and returns cards in our format
async function fetchTCGDexSetById(tcgdexId, setCode, ourSetId) {
  if (tcgdexSetCache.has(tcgdexId)) return tcgdexSetCache.get(tcgdexId);
  try {
    const res = await fetch(`${TCGDEX_API}/sets/${tcgdexId}`);
    if (!res.ok) return [];
    const d = await res.json();
    const cards = (d.cards || []).map(c => ({
      id: c.id || `${(setCode||tcgdexId).toLowerCase()}-${c.localId}`,
      name: c.name || '', supertype: '', subtypes: [],
      setName: d.name || '', setId: ourSetId, setCode: setCode || '',
      number: String(c.localId || ''), rarity: '',
      imageSmall: c.image ? `${c.image}/low.webp`  : CARD_IMAGE_PLACEHOLDER,
      imageLarge: c.image ? `${c.image}/high.webp` : CARD_IMAGE_PLACEHOLDER,
      legalities: {}, regulationMark: '', marketPrice: null,
      reverseHoloPrice: null, stampedPrice: null, rawTcg: null,
      types: [], hp: '', attacks: [], attacksFull: [], abilities: [], weaknesses: [], retreatCost: null,
    }));
    cards.sort((a, b) => (parseInt(a.number) || 0) - (parseInt(b.number) || 0));
    tcgdexSetCache.set(tcgdexId, cards);
    return cards;
  } catch { return []; }
}

// ── TCGDex implementations ────────────────────────────────────────────────────
// These mirror the pokemontcg.io functions above but use api.tcgdex.net.
// Active when USE_TCGDEX = true. Key differences from pokemontcg.io:
//   - No regulationMark field → Standard legality falls back to set-range checks
//   - No legalities field → Standard/Expanded legality marks unavailable
//   - No TCGPlayer prices → collection value tracking unavailable
//   - Image URLs: assets.tcgdex.net/{lang}/{series}/{set}/{localId}/{quality}.webp

function parseTCGDexCard(c, setCode, ourSetId) {
  const sid = ourSetId || PTCGO_TO_SET_ID[(setCode || '').toUpperCase()] || c.set?.id || '';
  const cat = c.category || '';
  const supertype = cat === 'Pokemon' ? 'Pokémon' : (cat || '');
  // TCGDex uses "stage" not "subtypes" for Pokémon; trainers use "trainerType"
  const subtypes = c.subtypes || (c.stage ? [c.stage] : c.trainerType ? [c.trainerType] : []);
  return {
    id:              c.id || '',
    name:            c.name || '',
    supertype,
    subtypes,
    setName:         c.set?.name || '',
    setId:           sid,
    setCode:         setCode || SET_ID_TO_CODE[sid] || '',
    number:          String(c.localId || ''),
    rarity:          c.rarity || '',
    imageSmall:      c.image ? `${c.image}/low.webp`  : CARD_IMAGE_PLACEHOLDER,
    imageLarge:      c.image ? `${c.image}/high.webp` : CARD_IMAGE_PLACEHOLDER,
    legalities:      {},
    regulationMark:  '',
    tcgplayerUrl:    '',
    marketPrice:     null,
    reverseHoloPrice: null,
    stampedPrice:    null,
    rawTcg:          null,
    types:           c.types || [],
    hp:              String(c.hp || ''),
    attacks:         (c.attacks || []).map(a => a.name),
    attacksFull:     (c.attacks || []).map(a => ({ name: a.name, damage: a.damage || '', cost: a.cost || [], effect: a.effect || '' })),
    abilities:       (c.abilities || []).map(a => ({ name: a.name, effect: a.effect || '' })),
    weaknesses:      c.weaknesses || [],
    retreatCost:     c.retreat ?? null,
    rules:           c.effect ? [c.effect] : [],
  };
}

async function lookupCardTCGDex(setCode, num, cardName) {
  if (!setCode || !num) return null;
  const key = cacheKey(setCode, num);
  if (cache.has(key) && cache.get(key) !== null) return cache.get(key);

  try {
    const ourSetId = PTCGO_TO_SET_ID[setCode.toUpperCase()] || '';
    const tcgdexId = TCGDEX_ID_MAP[ourSetId] || ourSetId;
    if (!tcgdexId) { cache.set(key, null); persistCache(); return null; }

    // Strip letter prefix from promo numbers (XY126→126, BW100→100)
    const numVariants = [...new Set([num, num.replace(/^[A-Za-z]+/, ''), num.replace(/^[A-Za-z]+/, '').replace(/^0+/, '') || '0'])].filter(Boolean);

    for (const n of numVariants) {
      try {
        const res = await fetch(`${TCGDEX_API}/cards/${tcgdexId}-${n}`);
        if (res.ok) {
          const d = await res.json();
          if (d?.id) {
            const parsed = parseTCGDexCard(d, setCode, ourSetId);
            cache.set(key, parsed); persistCache();
            return parsed;
          }
        }
      } catch {}
    }

    // Fallback: search by name within the set
    if (cardName) {
      const safeName = expandEnergySymbols(cardName).replace(/[^a-zA-Z0-9 ']/g, '').trim();
      const res = await fetch(`${TCGDEX_API}/cards?name=${encodeURIComponent(safeName)}&set.id=eq:${tcgdexId}&pagination:itemsPerPage=10`);
      if (res.ok) {
        const d = await res.json();
        const cards = Array.isArray(d) ? d : (d.cards || []);
        if (cards.length) {
          const full = await fetch(`${TCGDEX_API}/cards/${cards[0].id}`);
          if (full.ok) {
            const fc = await full.json();
            const parsed = parseTCGDexCard(fc, setCode, ourSetId);
            cache.set(key, parsed); persistCache();
            return parsed;
          }
        }
      }
    }
  } catch {}

  cache.set(key, null); persistCache();
  return null;
}

async function searchCardsTCGDex(query, setId, page = 1, ptcgoCode = null) {
  try {
    const tcgdexId = setId ? (TCGDEX_ID_MAP[setId] || setId) : null;

    if (tcgdexId && !query) {
      // Set browsing: use fetchTCGDexSet which already handles this
      const cards = await fetchTCGDexSetById(tcgdexId, SET_ID_TO_CODE[setId] || '', setId);
      return { cards, totalCount: cards.length };
    }

    if (query) {
      const words = query.trim().split(/\s+/).filter(Boolean);
      const nameQ = words.map(w => encodeURIComponent(w)).join('+');
      const setFilter = tcgdexId ? `&set.id=eq:${tcgdexId}` : '';
      const offset = (page - 1) * 20;
      const res = await fetch(`${TCGDEX_API}/cards?name=${nameQ}${setFilter}&pagination:page=${page}&pagination:itemsPerPage=20`);
      if (res.ok) {
        const d = await res.json();
        const items = Array.isArray(d) ? d : (d.cards || []);
        // Items from list endpoint are compact; fetch full data for first page only
        const cards = items.map(c => ({
          id: c.id || '',
          name: c.name || '',
          supertype: '',
          subtypes: [],
          setName: '',
          setId: setId || '',
          setCode: SET_ID_TO_CODE[setId] || '',
          number: String(c.localId || ''),
          rarity: '',
          imageSmall: c.image ? `${c.image}/low.webp` : '',
          imageLarge: c.image ? `${c.image}/high.webp` : '',
          legalities: {}, regulationMark: '', marketPrice: null,
          reverseHoloPrice: null, stampedPrice: null, rawTcg: null,
          types: [], hp: '', attacks: [], attacksFull: [], abilities: [], weaknesses: [], retreatCost: null,
        }));
        return { cards, totalCount: cards.length };
      }
    }
  } catch {}
  return { cards: [], totalCount: 0 };
}

async function fetchSetsMetadataTCGDex() {
  try {
    const res = await fetch(`${TCGDEX_API}/sets`);
    if (res.ok) {
      const d = await res.json();
      const data = {};
      for (const s of (Array.isArray(d) ? d : [])) {
        // Map TCGDex set ID back to our internal ID via TCGDEX_ID_MAP reverse
        const ourId = TCGDEX_ID_MAP_REVERSE[s.id] || s.id;
        data[ourId] = {
          id: ourId,
          name: s.name || '',
          logo:   s.logo   ? `${s.logo}/logo.webp`   : '',
          symbol: s.symbol ? `${s.symbol}/symbol.webp` : '',
          total:  s.cardCount?.total || s.cardCount?.official || 0,
          releaseDate: s.releaseDate || '',
          ptcgoCode: SET_ID_TO_CODE[ourId] || '',
        };
      }
      return data;
    }
  } catch {}
  return {};
}

// ── TCGDex universal fallback for sets not in pokemontcg.io ──────────────────
export async function fetchTCGDexSet(ourSetId, setCode, setName) {
  const tcgdexId = TCGDEX_ID_MAP[ourSetId] || ourSetId;
  if (!tcgdexId) return [];
  const cards = await fetchTCGDexSetById(tcgdexId, setCode || SET_ID_TO_CODE[ourSetId] || '', ourSetId);
  if (setName) cards.forEach(c => { c.setName = setName; });
  return cards;
}
