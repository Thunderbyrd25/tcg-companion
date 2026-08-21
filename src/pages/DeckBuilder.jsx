import { useState, useEffect, useRef, useMemo } from 'react';
import { useStore } from '../hooks/useStore';
import { ALL_SETS } from '../data/sets';
import { searchCards, fetchSetsMetadata } from '../utils/api';
import { checkEraLegality, cardKey, parseRawLines, buildSectionMap, getSection, supertypeToSection } from '../utils/cards';
import { RECOMMENDED_DECKS } from '../data/recommendedDecks';
import { useToast } from '../components/Toast';
import { ERA_FORMATS, ERA_GROUPS } from '../data/eras';
import { isBannedIn } from '../data/bans';

const FORMATS = ['Standard', 'Expanded', 'GLC', 'Eternal', 'Era', 'Custom'];

// Oldest set = 0, newer sets = higher values (ALL_SETS is newest-first, so reverse for chrono order)
const SET_ORDER_MAP = (() => {
  const m = {};
  [...ALL_SETS].reverse().forEach((s, i) => { m[s.code] = i; });
  return m;
})();

const STANDARD_SET_CODES = new Set(['POR','ASC','PFL','MEG','MEE','MEP','WHT','BLK','DRI','JTG','PRE','SSP','SCR','SFA','TWM','TEF']);
const EXPANDED_ERAS = new Set(['ME','SV','SWSH','SM','XY','BW']);
// GLC bans rule box Pokémon. The API uses mixed casing across eras.
const GLC_RULE_BOX = new Set(['ex','EX','GX','V','VMAX','VSTAR','Radiant','ACE SPEC','VUNION','MEGA','Tag Team','SP']);

function getSetsForFormat(format, eraCode) {
  if (format === 'Standard') return ALL_SETS.filter(s => STANDARD_SET_CODES.has(s.code));
  if (format === 'Expanded' || format === 'GLC') return ALL_SETS.filter(s => EXPANDED_ERAS.has(s.era));
  if (format === 'Eternal') return ALL_SETS;
  if (format === 'Era' && eraCode) {
    const parts = eraCode.split('-');
    const fromCode = parts[0].trim().toUpperCase();
    const toCode = (parts[1] || parts[0]).trim().toUpperCase();
    const allCodes = ALL_SETS.map(s => s.code);
    const fromIdx = allCodes.indexOf(fromCode);
    const toIdx = allCodes.indexOf(toCode);
    if (fromIdx !== -1 && toIdx !== -1) {
      const min = Math.min(fromIdx, toIdx);
      const max = Math.max(fromIdx, toIdx);
      return ALL_SETS.filter((_, i) => i >= min && i <= max);
    }
  }
  return ALL_SETS;
}

export default function DeckBuilder({ onBack }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [setsMeta, setSetsMeta] = useState({});

  const [builderFormat, setBuilderFormat] = useState('Standard');
  const [eraCode, setEraCode] = useState(ERA_FORMATS[0].code);
  const [deckName, setDeckName] = useState('New Deck');
  const [builtCards, setBuiltCards] = useState([]);

  const [selectedSet, setSelectedSet] = useState(null); // set object or null
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const searchTimer = useRef(null);
  const [browseMode, setBrowseMode] = useState('collection'); // 'collection' | 'sets'
  const [showUnowned, setShowUnowned] = useState(false);

  useEffect(() => { fetchSetsMetadata().then(setSetsMeta); }, []);

  // Auto-load set when selected
  useEffect(() => {
    if (!selectedSet) { setResults([]); return; }
    runSearch(1, selectedSet.id, '');
  }, [selectedSet]);

  // Search when query changes (global or within set)
  useEffect(() => {
    if (selectedSet) return;
    if (!query) { setResults([]); setTotalCount(0); return; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => runSearch(1, null, query), 400);
    return () => clearTimeout(searchTimer.current);
  }, [query]);

  // Re-run active search when format/era changes
  useEffect(() => {
    if (selectedSet) runSearch(1, selectedSet.id, '');
    else if (query) runSearch(1, null, query);
  }, [builderFormat, eraCode]);

  async function runSearch(p = 1, setId = null, q = query) {
    if (!setId && !q) return;
    setLoading(true);
    let currentPage = p;
    let newCards = [];
    let lastTotal = 0;
    let morePages = false;
    // For filtered formats: fetch every page so hasMore only shows when there truly are more results.
    // For Custom (unfiltered): stop after first page and let Load more handle the rest.
    while (true) {
      const { cards, totalCount } = await searchCards(q, setId, currentPage);
      lastTotal = totalCount;
      const sorted = [...cards].sort((a, b) => {
        const lDiff = (isCardLegal(a) ? 0 : 1) - (isCardLegal(b) ? 0 : 1);
        if (lDiff !== 0) return lDiff;
        const sDiff = (SET_ORDER_MAP[b.setCode] ?? 0) - (SET_ORDER_MAP[a.setCode] ?? 0);
        if (sDiff !== 0) return sDiff;
        return (parseInt(a.number) || 0) - (parseInt(b.number) || 0);
      });
      const filtered = builderFormat === 'Custom' ? sorted : sorted.filter(c => isCardLegal(c) || isCardBanned(c));
      newCards = [...newCards, ...filtered];
      if (cards.length === 0 || currentPage * 20 >= lastTotal) { morePages = false; break; }
      if (builderFormat === 'Custom') { morePages = currentPage * 20 < lastTotal; break; }
      currentPage++;
    }
    setResults(p === 1 ? newCards : prev => [...prev, ...newCards]);
    setTotalCount(lastTotal);
    setPage(currentPage);
    setHasMore(morePages);
    setLoading(false);
  }

  // Derive the GLC type from Pokémon already in the deck
  const glcType = useMemo(() => {
    if (builderFormat !== 'GLC') return null;
    for (const c of builtCards) {
      if (c.section === 'Pokemon' && c.types?.length) return c.types[0];
    }
    return null;
  }, [builderFormat, builtCards]);

  function addCard(card) {
    const section = supertypeToSection(card.supertype) || 'Trainer';
    const isPokemon = card.supertype === 'Pokémon' || card.supertype === 'Pokemon';
    const isBasicEnergy = card.supertype === 'Energy' && card.subtypes?.includes('Basic');
    const isAceSpec    = !!(card.subtypes?.includes('ACE SPEC'));
    const isRadiant    = !!(card.subtypes?.includes('Radiant'));
    const isGoldStar   = !!(card.name?.includes('★'));
    const isShining    = !!(card.subtypes?.includes('Shining') || card.name?.startsWith('Shining '));
    // Cards with "as many of this card in your deck as you like" rule (e.g. Arceus AR)
    const isUnlimited  = !!(card.rules?.some(r => /as many of this card/i.test(r)));

    // Format legality check (for global search results outside the filtered set grid)
    if (builderFormat !== 'Custom' && builderFormat !== 'Eternal') {
      if (builderFormat === 'Era') {
        if (!checkEraLegality({ setCode: card.setCode, num: card.number }, eraCode).legal) {
          toast(`${card.setName || card.setCode} is not legal in this era`, 'red'); return;
        }
        const ef = ERA_FORMATS.find(f => f.code === eraCode);
        if (ef?.banned?.length) {
          const normStr = s => (s || '').toLowerCase().replace(/['']/g, "'");
          const normNum = n => String(n || '').replace(/^0+/, '') || '0';
          for (const ban of ef.banned) {
            if (normStr(card.name) !== normStr(ban.name)) continue;
            if (ban.number !== undefined && normNum(card.number) !== normNum(ban.number)) continue;
            toast(`${ban.name} is banned in this era`, 'red'); return;
          }
        }
      } else {
        const legalIds = new Set(legalSets.map(s => s.id));
        if (card.setId && !legalIds.has(card.setId)) {
          toast(`${card.setName} is not legal in ${builderFormat}`, 'red'); return;
        }
      }
    }
    if (isBannedIn(card.name, builderFormat, card.setCode)) {
      toast(`${card.name} is banned in ${builderFormat}`, 'red'); return;
    }

    if (builderFormat === 'GLC') {
      if (isPokemon) {
        // No rule box
        const ruleBox = card.subtypes?.find(st => GLC_RULE_BOX.has(st));
        if (ruleBox) { toast(`${ruleBox} cards are banned in GLC`, 'red'); return; }
        // Single type — block different type Pokémon
        const cardType = card.types?.[0];
        if (glcType && cardType && cardType !== glcType) {
          toast(`GLC: deck is ${glcType} type — can't add ${cardType} Pokémon`, 'red'); return;
        }
      }
      // Max 1 copy by name (different prints of the same card count as the same card)
      if (!isBasicEnergy) {
        const sameName = builtCards.find(c => c.name.toLowerCase() === card.name.toLowerCase());
        if (sameName) { toast(`GLC: only 1 copy of ${card.name} allowed (different prints still count as the same card)`, 'red'); return; }
      }
    }

    if (builderFormat !== 'Custom') {
      // ACE SPEC: only 1 per deck
      if (isAceSpec && builtCards.some(c => c.isAceSpec)) {
        toast('Only 1 ACE SPEC card allowed per deck', 'red'); return;
      }
      // Radiant Pokémon: only 1 per deck
      if (isRadiant && builtCards.some(c => c.isRadiant)) {
        toast('Only 1 Radiant Pokémon allowed per deck', 'red'); return;
      }
      // Gold Star (★): only 1 per deck
      if (isGoldStar && builtCards.some(c => c.isGoldStar)) {
        toast('Only 1 Pokémon ★ allowed per deck', 'red'); return;
      }
      // Shining Pokémon: only 1 per deck
      if (isShining && builtCards.some(c => c.isShining)) {
        toast('Only 1 Shining Pokémon allowed per deck', 'red'); return;
      }
      // 4-copy rule (skip for basic energy, unlimited cards, and GLC which has its own rule)
      if (!isBasicEnergy && !isUnlimited && builderFormat !== 'GLC') {
        const totalByName = builtCards.filter(c => c.name.toLowerCase() === card.name.toLowerCase()).reduce((s, c) => s + c.qty, 0);
        if (totalByName >= 4) { toast(`Max 4 copies of ${card.name} allowed`, 'red'); return; }
      }
    }

    setBuiltCards(prev => {
      const existing = prev.find(c => c.name === card.name && c.setCode === card.setCode && c.num === card.number);
      if (existing) return prev.map(c => c === existing ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { name: card.name, setCode: card.setCode || '', num: card.number || '', qty: 1, section, types: card.types || [], isBasicEnergy, isAceSpec, isRadiant, isGoldStar, isShining, isUnlimited }];
    });
  }

  function removeCard(idx) {
    setBuiltCards(prev => {
      const c = prev[idx];
      if (c.qty > 1) return prev.map((x, i) => i === idx ? { ...x, qty: x.qty - 1 } : x);
      return prev.filter((_, i) => i !== idx);
    });
  }

  function setCardQty(idx, qty) {
    const q = parseInt(qty) || 0;
    const card = builtCards[idx];
    const isBasicEnergy = card?.isBasicEnergy ?? false;
    let max = 999;
    if (builderFormat !== 'Custom') {
      if (builderFormat === 'GLC' && !isBasicEnergy) {
        max = 1;
      } else if (!isBasicEnergy) {
        if (card?.isAceSpec) {
          max = 1;
        } else {
          const otherQty = builtCards.filter((c, i) => i !== idx && c.name.toLowerCase() === (card?.name || '').toLowerCase()).reduce((s, c) => s + c.qty, 0);
          max = Math.max(0, 4 - otherQty);
        }
      }
    }
    if (q <= 0) setBuiltCards(prev => prev.filter((_, i) => i !== idx));
    else setBuiltCards(prev => prev.map((x, i) => i === idx ? { ...x, qty: Math.min(q, max) } : x));
  }

  const recKey = builderFormat === 'Era' ? `era-${eraCode}` : builderFormat.toLowerCase();
  const templates = (RECOMMENDED_DECKS[recKey] || []).filter(r => r.name && r.raw);

  function loadTemplate(rec) {
    if (builtCards.length > 0 && !window.confirm(`Load "${rec.name}"?\nThis will replace your current deck.`)) return;
    const rawCards = parseRawLines(rec.raw);
    const sectionMap = buildSectionMap(rec.raw);
    setBuiltCards(rawCards.map(rc => ({
      name: rc.name, setCode: rc.setCode || '', num: rc.num || '', qty: rc.qty,
      section: getSection(rc.name, sectionMap, {}),
    })));
    setDeckName(rec.name);
  }

  function saveDeck() {
    if (!builtCards.length) { toast('Add some cards first!', 'red'); return; }
    const raw = buildRawText(builtCards);
    dispatch({
      type: 'SAVE_DECK', deck: {
        id: Date.now(), name: deckName.trim() || 'New Deck',
        format: builderFormat, eraLabel: builderFormat === 'Era' ? eraCode : '', notes: '',
        rawCards: builtCards.map(({ name, setCode, num, qty }) => ({ name, setCode, num, qty })),
        raw, sectionMap: buildSectionMap(raw),
        ownedMap: {}, blingSel: {}, isBuyList: false,
      }
    });
    toast(`${deckName} saved!`, 'green');
    onBack();
  }

  // Collection qty for a card
  function getOwned(card) {
    const ck = cardKey({ name: card.name, setCode: card.setCode, num: card.number });
    let total = state.collection[ck] || 0;
    for (const deck of state.decks) {
      const rc = deck.rawCards.find(r => cardKey(r) === ck);
      if (rc) total += Math.min(rc.qty, deck.ownedMap?.[ck] ?? 0);
    }
    return total;
  }

  const totals = { Pokemon: 0, Trainer: 0, Energy: 0, Other: 0 };
  for (const c of builtCards) totals[c.section || 'Other'] = (totals[c.section || 'Other'] || 0) + c.qty;
  const totalBuilt = builtCards.reduce((s, c) => s + c.qty, 0);

  const legalSets = getSetsForFormat(builderFormat, eraCode);
  const legalSetIds = useMemo(() => new Set(legalSets.map(s => s.id)), [legalSets]);

  function isCardBanned(card) {
    if (!card.name) return false;
    if (builderFormat === 'GLC' || builderFormat === 'Expanded' || builderFormat === 'Eternal') {
      return isBannedIn(card.name, builderFormat, card.setCode);
    }
    if (builderFormat !== 'Era') return false;
    const ef = ERA_FORMATS.find(f => f.code === eraCode);
    if (!ef?.banned?.length) return false;
    const normStr = s => (s || '').toLowerCase().replace(/['']/g, "'");
    const normNum = n => String(n || '').replace(/^0+/, '') || '0';
    for (const ban of ef.banned) {
      if (normStr(card.name) !== normStr(ban.name)) continue;
      if (ban.number !== undefined && normNum(card.number) !== normNum(ban.number)) continue;
      return true;
    }
    return false;
  }

  function isEraLegal(card) {
    if (!checkEraLegality({ setCode: card.setCode, num: card.number }, eraCode).legal) return false;
    const ef = ERA_FORMATS.find(f => f.code === eraCode);
    if (!ef?.banned?.length) return true;
    const normStr = s => (s || '').toLowerCase().replace(/['']/g, "'");
    const normNum = n => String(n || '').replace(/^0+/, '') || '0';
    for (const ban of ef.banned) {
      if (normStr(card.name) !== normStr(ban.name)) continue;
      if (ban.number !== undefined && normNum(card.number) !== normNum(ban.number)) continue;
      return false;
    }
    return true;
  }

  function isCardLegal(card) {
    if (builderFormat === 'Custom' || builderFormat === 'Eternal') return true;
    if (builderFormat === 'Era') return isEraLegal(card);
    return !card.setId || legalSetIds.has(card.setId);
  }

  // Collection view: cards the user owns, filtered by current format, not-in-deck first
  const collectionCards = useMemo(() => {
    const deckCardKeys = new Set();
    for (const deck of state.decks) {
      for (const rc of (deck.rawCards || [])) {
        if ((rc.qty || 0) > 0) deckCardKeys.add(cardKey(rc));
      }
    }
    const cards = [];
    for (const [ck, raw] of Object.entries(state.collection)) {
      const owned = typeof raw === 'number' ? raw : (raw ? Object.values(raw).reduce((s, v) => s + (v || 0), 0) : 0);
      if (owned <= 0) continue;
      const apiData = state.apiCache[ck];
      const parts = ck.split('||');
      const name = parts[0] || ck;
      const setCode = parts[1] || '';
      const number = parts[2] || '';
      const setId = apiData?.setId || ALL_SETS.find(s => s.code === setCode)?.id || null;
      const card = { id: apiData?.id || ck, name, setCode, number, setId, imageSmall: apiData?.imageSmall, marketPrice: apiData?.marketPrice, setName: apiData?.setName, supertype: apiData?.supertype, types: apiData?.types || [], subtypes: apiData?.subtypes || [], legalities: apiData?.legalities };
      if (builderFormat !== 'Custom') {
        const legal = builderFormat === 'Era' ? isEraLegal(card) : (!setId || legalSetIds.has(setId));
        if (!legal) continue;
      }
      cards.push({ ...card, owned, inDeck: deckCardKeys.has(ck) });
    }
    cards.sort((a, b) => {
      if (a.inDeck !== b.inDeck) return a.inDeck ? 1 : -1;
      const sDiff = (SET_ORDER_MAP[b.setCode] ?? 0) - (SET_ORDER_MAP[a.setCode] ?? 0);
      if (sDiff !== 0) return sDiff;
      return (parseInt(a.number) || 0) - (parseInt(b.number) || 0);
    });
    return cards;
  }, [state.collection, state.apiCache, state.decks, builderFormat, legalSetIds, eraCode]);

  const isInSet = selectedSet != null;
  const isSearching = !isInSet && !!query;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => {
          if (isInSet) { setSelectedSet(null); setResults([]); }
          else if (isSearching) { setQuery(''); setResults([]); }
          else onBack();
        }}>← Back</button>
        <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 24, fontWeight: 800, letterSpacing: .4, color: 'var(--yellow)' }}>
          {isInSet ? selectedSet.name : 'Deck Builder'}
        </span>
        {isInSet && <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>{loading ? 'Loading…' : `${results.length} cards`}</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>

        {/* LEFT */}
        <div>
          {/* Format picker */}
          {(() => {
            const fmtColor = { Standard: 'var(--std)', Expanded: 'var(--exp)', GLC: 'var(--glc)', Eternal: 'var(--muted)', Custom: 'var(--cst)', Era: 'var(--era)' };
            const isEra = builderFormat === 'Era';
            const activeColor = fmtColor[builderFormat] || 'var(--muted)';
            const selectValue = isEra ? `era:${eraCode}` : `fmt:${builderFormat}`;
            const activeEra = isEra ? ERA_FORMATS.find(ef => ef.code === eraCode) : null;
            return (
              <div style={{ marginBottom: 14 }}>
                <select value={selectValue} onChange={e => {
                  const v = e.target.value;
                  setSelectedSet(null); setResults([]);
                  if (v.startsWith('era:')) { setBuilderFormat('Era'); setEraCode(v.slice(4)); }
                  else { setBuilderFormat(v.slice(4)); }
                }} style={{
                  padding: '5px 12px', fontSize: 12, borderRadius: 8, cursor: 'pointer',
                  border: `2px solid ${activeColor}`,
                  background: `color-mix(in srgb, ${activeColor} 12%, transparent)`,
                  color: activeColor,
                  fontFamily: "'Outfit',sans-serif", fontWeight: 700, marginBottom: builderFormat === 'GLC' ? 4 : 0,
                }}>
                  <optgroup label="Formats">
                    {['Standard', 'Expanded', 'GLC', 'Eternal', 'Custom'].map(f => (
                      <option key={f} value={`fmt:${f}`}>{f}</option>
                    ))}
                  </optgroup>
                  <optgroup label="─────────────" disabled />
                  {Object.entries(ERA_GROUPS).map(([group, formats]) => (
                    <optgroup key={group} label={group}>
                      {formats.map(f => <option key={f.code} value={`era:${f.code}`}>{f.label}{f.worlds ? ' ⭐' : ''}</option>)}
                    </optgroup>
                  ))}
                </select>
                {builderFormat === 'GLC' && (
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
                    1 copy per card · no Rule Box · {glcType ? <span style={{ color: 'var(--yellow)', fontWeight: 800 }}>{glcType} type</span> : 'single Pokémon type'}
                  </div>
                )}
                {activeEra?.notes && (
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Note: {activeEra.notes}</div>
                )}
              </div>
            );
          })()}

          {/* Collection / Sets toggle */}
          {!isInSet && !isSearching && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {[['collection', 'My Collection'], ['sets', 'Browse Sets']].map(([mode, label]) => (
                <button key={mode} className={`btn btn-sm ${browseMode === mode ? 'btn-yellow' : 'btn-ghost'}`}
                  onClick={() => { setBrowseMode(mode); if (mode === 'collection') { setQuery(''); setResults([]); setSelectedSet(null); } }}>{label}</button>
              ))}
            </div>
          )}

          {/* Templates */}
          {!isInSet && !query && browseMode === 'sets' && templates.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Templates</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
                {templates.map((rec, i) => (
                  <div key={i} onClick={() => loadTemplate(rec)}
                    style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', transition: 'border-color .15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--yellow)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--card-border)'; }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 11, lineHeight: 1.3, marginBottom: 4 }}>{rec.name}</div>
                    {rec.notes && (
                      <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                        {rec.notes.split('\n')[0]}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search bar (global or within set header) */}
          {!isInSet && browseMode === 'sets' && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search card name across all sets…"
                style={{ flex: 1, padding: '9px 14px' }} />
              {query && <button className="btn btn-ghost btn-sm" onClick={() => { setQuery(''); setResults([]); }}>✕</button>}
            </div>
          )}

          {/* Set grid */}
          {!isInSet && !query && browseMode === 'sets' && (
            <div>
              {Object.entries(groupByEra(legalSets)).map(([era, sets]) => (
                <div key={era} style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--yellow)', marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase', borderBottom: '2px solid var(--card-border)', paddingBottom: 6 }}>{era}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                    {sets.map(s => {
                      const meta = setsMeta[s.id] || {};
                      return (
                        <div key={s.code} onClick={() => setSelectedSet(s)}
                          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', transition: 'all .15s' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--yellow)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--card-border)'; e.currentTarget.style.transform = ''; }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: meta.logo ? 8 : 0 }}>
                            <div style={{ background: '#111', borderRadius: 5, padding: '3px 5px', minWidth: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {meta.symbol
                                ? <img src={meta.symbol} alt="" style={{ height: 18, objectFit: 'contain' }} />
                                : <span style={{ fontSize: 8, color: 'var(--muted)', fontWeight: 800 }}>{s.code}</span>
                              }
                            </div>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 11 }}>{s.name}</div>
                              <div style={{ fontSize: 9, color: 'var(--muted)' }}>{s.code}{meta.releaseDate ? ` · ${meta.releaseDate.slice(0,7)}` : ''}</div>
                            </div>
                          </div>
                          {meta.logo && (
                            <div style={{ background: '#0a0a18', borderRadius: 6, padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 40 }}>
                              <img src={meta.logo} alt={s.name} style={{ maxHeight: 36, maxWidth: '100%', objectFit: 'contain' }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Collection view */}
          {!isInSet && !isSearching && browseMode === 'collection' && (
            collectionCards.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 12 }}>
                No owned cards for this format. Add cards to your collection or switch to Browse Sets.
              </div>
            ) : (
              <>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>
                  {collectionCards.filter(c => !c.inDeck).length} available · {collectionCards.filter(c => c.inDeck).length} in decks
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                  {collectionCards.map(card => (
                    <ResultCard key={card.id} card={card} owned={card.owned} legal={isCardLegal(card)} banned={isCardBanned(card)} onAdd={() => addCard(card)} setsMeta={setsMeta} />
                  ))}
                </div>
              </>
            )
          )}

          {/* Results grid */}
          {(isInSet || isSearching) && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                {isSearching ? (
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {loading ? 'Searching…' : `${results.length} result${results.length !== 1 ? 's' : ''}`}
                  </div>
                ) : <div />}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={showUnowned} onChange={e => setShowUnowned(e.target.checked)}
                    style={{ width: 14, height: 14, accentColor: 'var(--yellow)', cursor: 'pointer' }} />
                  Show unowned
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                {results.filter(card => showUnowned || getOwned(card) > 0).map(card => (
                  <ResultCard key={card.id} card={card} owned={getOwned(card)} legal={isCardLegal(card)} banned={isCardBanned(card)} onAdd={() => addCard(card)} setsMeta={setsMeta} />
                ))}
              </div>
              {!isInSet && hasMore && (
                <button className="btn btn-ghost" style={{ width: '100%', marginTop: 12 }} onClick={() => runSearch(page + 1, null, query)}>
                  Load more
                </button>
              )}
            </>
          )}
        </div>

        {/* RIGHT: Deck panel */}
        <div style={{ position: 'sticky', top: 80 }}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <input value={deckName} onChange={e => setDeckName(e.target.value)}
                style={{ flex: 1, padding: '7px 10px', fontWeight: 800, fontSize: 13 }} />
              <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, whiteSpace: 'nowrap' }}>{totalBuilt}/60</span>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {Object.entries(totals).filter(([, v]) => v > 0).map(([sec, cnt]) => (
                <span key={sec} style={{ fontSize: 11, background: 'var(--pill)', padding: '3px 9px', borderRadius: 10, fontWeight: 700, color: 'var(--muted)' }}>
                  {sec}: {cnt}
                </span>
              ))}
            </div>

            <div className="prog-track" style={{ marginBottom: 14 }}>
              <div className="prog-fill" style={{ width: `${Math.min(100, (totalBuilt / 60) * 100)}%`, background: totalBuilt === 60 ? 'var(--green)' : totalBuilt > 60 ? 'var(--red)' : undefined }} />
            </div>

            {builtCards.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)', fontSize: 12 }}>
                Browse a set or search above to add cards
              </div>
            ) : (
              <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                {['Pokemon', 'Trainer', 'Energy', 'Other'].map(sec => {
                  const cards = builtCards.filter(c => (c.section || 'Other') === sec);
                  if (!cards.length) return null;
                  return (
                    <div key={sec}>
                      <div style={{ fontSize: 13, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: .8, color: 'var(--yellow)', marginBottom: 6, marginTop: 10 }}>{sec}</div>
                      {cards.map((c, i) => {
                        const realIdx = builtCards.indexOf(c);
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <input type="number" min={0} max={4} value={c.qty}
                              onChange={e => setCardQty(realIdx, e.target.value)}
                              style={{ width: 36, padding: '2px 4px', textAlign: 'center', fontSize: 12 }} />
                            <span style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>{c.name}</span>
                            <span style={{ fontSize: 10, color: 'var(--muted)' }}>{c.setCode} {c.num}</span>
                            <button className="btn btn-xs btn-red" onClick={() => removeCard(realIdx)} style={{ padding: '2px 6px', fontSize: 11 }}>−</button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button className="btn btn-yellow" style={{ flex: 1, justifyContent: 'center' }} onClick={saveDeck}>Save Deck</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setBuiltCards([])}>Clear</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultCard({ card, owned, legal, banned, onAdd, setsMeta = {} }) {
  const meta = setsMeta[card.setId] || {};
  const blocked = banned || !legal;
  const badgeColor = banned ? 'rgba(139,0,0,.9)' : 'rgba(227,53,13,.85)';
  return (
    <div onClick={onAdd}
      title={banned ? `${card.name} is banned in this format` : !legal ? `Not legal in this format (${card.setName})` : undefined}
      style={{
        background: 'var(--card-bg)',
        border: `2px solid ${blocked ? 'rgba(227,53,13,.4)' : owned > 0 ? 'var(--green)' : 'var(--card-border)'}`,
        borderRadius: 10, overflow: 'hidden', cursor: 'pointer', transition: 'all .15s', position: 'relative',
        opacity: blocked ? 0.5 : 1,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = blocked ? 'rgba(227,53,13,.8)' : 'var(--yellow)'; e.currentTarget.style.transform = 'scale(1.03)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = blocked ? 'rgba(227,53,13,.4)' : owned > 0 ? 'var(--green)' : 'var(--card-border)'; e.currentTarget.style.transform = ''; }}
    >
      {card.imageSmall
        ? <img src={card.imageSmall} alt={card.name} style={{ width: '100%', display: 'block' }} loading="lazy" />
        : <div style={{ height: 80, background: 'var(--pill)' }} />
      }
      {owned > 0 && (
        <div style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(74,222,128,.9)', color: '#000', fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 11, padding: '1px 5px', borderRadius: 4 }}>×{owned}</div>
      )}
      {blocked && (
        <div style={{ position: 'absolute', top: 4, left: 4, background: badgeColor, color: '#fff', fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 10, padding: '1px 5px', borderRadius: 4 }}>
          {banned ? 'Banned' : 'Not legal'}
        </div>
      )}
      <div style={{ padding: '6px 8px' }}>
        <div style={{ fontWeight: 800, fontSize: 10, lineHeight: 1.3 }}>{card.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
          {meta.symbol && <img src={meta.symbol} alt="" style={{ height: 14, width: 'auto', flexShrink: 0 }} />}
          <span style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.3, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {card.setName || card.setCode} #{card.number}
          </span>
        </div>
        {card.marketPrice && <div style={{ fontSize: 9, color: 'var(--green)', fontWeight: 700 }}>${card.marketPrice.toFixed(2)}</div>}
        <div style={{ marginTop: 4, fontSize: 9, color: blocked ? 'var(--muted)' : 'var(--yellow)', fontWeight: 800, textAlign: 'center' }}>+ Add</div>
      </div>
    </div>
  );
}

function groupByEra(sets) {
  const map = {};
  for (const s of sets) {
    if (!map[s.era]) map[s.era] = [];
    map[s.era].push(s);
  }
  return map;
}

function buildRawText(cards) {
  const sections = {};
  for (const c of cards) {
    const sec = c.section || 'Trainer';
    if (!sections[sec]) sections[sec] = [];
    sections[sec].push(c);
  }
  const lines = [];
  for (const [sec, items] of Object.entries(sections)) {
    if (!items.length) continue;
    lines.push(`${sec}: ${items.reduce((s, c) => s + c.qty, 0)}`);
    for (const c of items) lines.push(`${c.qty} ${c.name}${c.setCode ? ' ' + c.setCode + ' ' + c.num : ''}`);
    lines.push('');
  }
  return lines.join('\n').trim();
}
