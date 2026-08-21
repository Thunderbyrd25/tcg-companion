// Converts a raw Scrydex Pokemon card/expansion object into the same shape
// pokemontcg.io's v2 API returned, so src/utils/api.js's parseCard() (frontend)
// needs zero changes — it was written against pokemontcg.io's shape and stays that way.

export function normalizeSet(exp) {
  return {
    id: exp.id,
    name: exp.name,
    series: exp.series,
    total: exp.total,
    printedTotal: exp.printed_total,
    releaseDate: exp.release_date,
    ptcgoCode: exp.code || '',
    images: { logo: exp.logo || '', symbol: exp.symbol || '' },
  };
}

const NM_CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DM'];

function priceForVariant(variant) {
  const prices = variant.prices || [];
  const byCondition = NM_CONDITIONS.map(c => prices.find(p => p.condition === c)).find(Boolean) || prices[0];
  return byCondition?.market != null ? { market: byCondition.market } : null;
}

function buildTcgplayer(card) {
  const variants = card.variants || [];
  const prices = {};
  for (const v of variants) {
    const p = priceForVariant(v);
    if (p) prices[v.name] = p;
  }
  const withUrl = variants.find(v => (v.marketplaces || []).some(m => m.name === 'tcgplayer'));
  const url = withUrl?.marketplaces.find(m => m.name === 'tcgplayer')?.purchase_url || '';
  return { url, prices };
}

function legalitiesObject(card) {
  const out = {};
  for (const l of card.legalities || []) {
    if (l.format === 'Standard') out.standard = l.status === 'Legal' ? 'Legal' : undefined;
    if (l.format === 'Expanded') out.expanded = l.status === 'Legal' ? 'Legal' : undefined;
  }
  return out;
}

// Scrydex inconsistently names basic energy cards "Basic X Energy" (pokemontcg.io
// always used "X Energy", no prefix) -- the frontend's whole basic-energy lookup
// path (expandEnergySymbols, the SVE-fallback in lookupCard, etc.) assumes the
// pokemontcg.io convention, so normalize to it here rather than touching every
// caller.
function normalizeEnergyName(card) {
  if (card.supertype === 'Energy' && (card.subtypes || []).includes('Basic')) {
    return card.name.replace(/^Basic /, '');
  }
  return card.name;
}

export function normalizeCard(card) {
  const front = (card.images || []).find(i => i.type === 'front') || card.images?.[0] || {};
  return {
    id: card.id,
    name: normalizeEnergyName(card),
    supertype: card.supertype,
    subtypes: card.subtypes || [],
    types: card.types || [],
    hp: card.hp || '',
    set: { id: card.expansion?.id || '', name: card.expansion?.name || '', ptcgoCode: card.expansion?.code || '' },
    number: card.number || '',
    rarity: card.rarity || '',
    images: { small: front.small || '', large: front.large || '' },
    legalities: legalitiesObject(card),
    regulationMark: card.regulation_mark || '',
    tcgplayer: buildTcgplayer(card),
    attacks: card.attacks || [],
    abilities: card.abilities || [],
    weaknesses: card.weaknesses || [],
    retreatCost: card.retreat_cost || [],
    rules: card.rules || [],
    nationalPokedexNumbers: card.national_pokedex_numbers || [],
  };
}

// Row shape for the `cards` table — the indexed/filterable columns plus the
// full normalized `data` blob that gets served as-is.
export function cardToRow(card) {
  const normalized = normalizeCard(card);
  return {
    id: card.id,
    scrydex_id: card.id,
    name: normalized.name,
    set_id: card.expansion?.id || null,
    ptcgo_code: card.expansion?.code || null,
    number: card.number || null,
    release_date: card.expansion?.release_date ? card.expansion.release_date.replaceAll('/', '-') : null,
    national_pokedex_numbers: card.national_pokedex_numbers || [],
    legalities_standard: normalized.legalities.standard || null,
    legalities_expanded: normalized.legalities.expanded || null,
    regulation_mark: card.regulation_mark || null,
    data: normalized,
    raw_scrydex: card,
  };
}

export function setToRow(exp) {
  return {
    id: exp.id,
    scrydex_id: exp.id,
    name: exp.name,
    ptcgo_code: exp.code || null,
    series: exp.series || null,
    total: exp.total ?? null,
    printed_total: exp.printed_total ?? null,
    release_date: exp.release_date ? exp.release_date.replaceAll('/', '-') : null,
    data: normalizeSet(exp),
  };
}
