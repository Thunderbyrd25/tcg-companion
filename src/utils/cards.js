import { ALL_SETS, PTCGO_TO_SET_ID } from '../data/sets';
import { expandEnergySymbols } from './api';
import { ERA_FORMATS } from '../data/eras';

export function cardKey(c) {
  return c.setCode && c.num
    ? `${c.name}||${c.setCode}||${c.num}`
    : c.name;
}

export function parseRawLines(raw) {
  const cards = [];
  for (let line of raw.split('\n')) {
    line = line.trim();
    if (!line || /^(Pokemon|Pokémon|Trainer|Energy|Stadium|Total|##|\/\/):/i.test(line)) continue;
    // TCG Live exports basic energies with "Energy N" as the set+number.
    // The number encodes which physical set the energy is from:
    line = line.replace(/\s+Energy\s+(\d+[a-z]?)$/, (_, num) => {
      const n = parseInt(num);
      let set = 'SVE'; // default for unrecognized numbers
      if (n >= 18 && n <= 26) set = 'SUM';
      else if (n >= 27 && n <= 35) set = 'TEU';
      else if (n >= 36 && n <= 43) set = 'SSH';
      else if (n >= 45 && n <= 52) set = 'BRS';
      return ` ${set} ${num}`;
    });
    let match = line.match(/^(\d+)\s+(.+?)(?:\s+([A-Z]{2,4}(?:-[A-Z]{2})?)\s+(\d+[a-z]?))?$/);
    if (!match) {
      const m2 = line.match(/^(.+?)\s+[xX](\d+)$/);
      if (m2) match = [null, m2[2], m2[1]];
    }
    if (match) {
      cards.push({
        qty: parseInt(match[1]) || 1,
        name: expandEnergySymbols(match[2].trim()),
        setCode: match[3] || '',
        num: match[4] || '',
      });
    }
  }
  return cards;
}

export function buildSectionMap(raw) {
  const map = {};
  let cur = 'Pokemon';
  for (let line of raw.split('\n')) {
    line = line.trim();
    if (/^(Pokemon|Pokémon):/i.test(line)) { cur = 'Pokemon'; continue; }
    if (/^Trainer:/i.test(line)) { cur = 'Trainer'; continue; }
    if (/^Energy:/i.test(line)) { cur = 'Energy'; continue; }
    const m = line.match(/^(\d+)\s+(.+?)(?:\s+[A-Z]{2,4}(?:-[A-Z]{2})?\s+\d+[a-z]?)?$/);
    if (m) map[m[2].trim()] = cur;
  }
  return map;
}

export function inferSection(name) {
  const n = name.toLowerCase();
  if (/\benergy\b/.test(n)) return 'Energy';
  if (/\b(ball|research|order|boss|judge|iono|arven|switch|rope|potion|reset|escape|elesa|cram|vip pass|tablet|vacuum|stamp|marnie|raihan|melony|piers|diantha|poppy|penny|miriam|geeta|nemona|briar|rotom|stadium|gym|tower|city|path|forest|lab|cave|ruins|school|temple|shrine|hotel|studio|market|shop|store|center|zone|park|pier|port|beach|bridge|road|gate|supporter|item)\b/.test(n)) return 'Trainer';
  return null;
}

export function getSection(name, sectionMap, globalMap) {
  return sectionMap?.[name] || globalMap?.[name] || inferSection(name) || 'Other';
}

export function supertypeToSection(s) {
  if (!s) return null;
  const l = s.toLowerCase();
  if (l === 'pokémon' || l === 'pokemon') return 'Pokemon';
  if (l === 'trainer') return 'Trainer';
  if (l === 'energy') return 'Energy';
  return null;
}

export function formatDeckList(rawCards) {
  const sections = { Pokemon: [], Trainer: [], Energy: [] };
  for (const rc of rawCards) {
    const sec = rc.section || 'Trainer';
    if (!sections[sec]) sections[sec] = [];
    sections[sec].push(rc);
  }
  const lines = [];
  for (const [sec, cards] of Object.entries(sections)) {
    if (!cards.length) continue;
    lines.push(`${sec}: ${cards.reduce((s, c) => s + c.qty, 0)}`);
    for (const c of cards) {
      lines.push(`${c.qty} ${c.name}${c.setCode ? ' ' + c.setCode + ' ' + c.num : ''}`);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

// Era legality check
export function checkEraLegality(rc, eraLabel) {
  if (!eraLabel || !rc.setCode) return { legal: true };
  const parts = eraLabel.split('-');
  // Single-code era (e.g. "BS"): card must be exactly that set
  // Multi-part era (e.g. "BLW-PLF" or "BS-G2-PROP"): use first two parts as range, ignore extras
  const fromCode = parts[0].trim().toUpperCase();
  const toCode = (parts[1] || parts[0]).trim().toUpperCase();
  const allCodes = ALL_SETS.map(s => s.code);
  const fromIdx = allCodes.indexOf(fromCode);
  const toIdx = allCodes.indexOf(toCode);
  const cardIdx = allCodes.indexOf(rc.setCode.toUpperCase());
  if (fromIdx === -1 || toIdx === -1) return { legal: true };
  if (cardIdx === -1) return { legal: false, reason: `${rc.setCode} not in known sets` };
  const min = Math.min(fromIdx, toIdx);
  const max = Math.max(fromIdx, toIdx);
  if (cardIdx < min || cardIdx > max) {
    return { legal: false, reason: `${rc.setCode} outside era ${eraLabel}` };
  }
  return { legal: true };
}

const PRE_EXPANDED = new Set(['base1','base2','base3','base4','base5','base6','gym1','gym2','neo1','neo2','neo3','neo4','ecard1','ecard2','ecard3','ex1','ex2','ex3','ex4','ex5','ex6','ex7','ex8','ex9','ex10','ex11','ex12','ex13','ex14','ex15','ex16','dp1','dp2','dp3','dp4','dp5','dp6','dp7','pl1','pl2','pl3','pl4','hgss1','hgss2','hgss3','hgss4','col1']);
const GLC_RULE_BOX = new Set(['ex','EX','GX','V','VMAX','VSTAR','Radiant','ACE SPEC','VUNION','MEGA','Tag Team','SP']);

// Returns true if apiCache has any print of `name` the API considers Standard-legal
function hasLegalStdReprint(name, apiCache) {
  if (!apiCache) return false;
  for (const data of Object.values(apiCache)) {
    if (!data || data.name !== name) continue;
    if (data.legalities?.standard === 'Legal') return true;
  }
  return false;
}

export function checkLegality(rc, deck, apiData, apiCache = null) {
  const fmt = deck.format || 'Standard';
  if (fmt === 'Custom') return { legal: true };
  if (fmt === 'Era') return checkEraLegality(rc, deck.eraLabel || '');

  const setId = (PTCGO_TO_SET_ID[rc.setCode?.toUpperCase()] || '').toLowerCase();

  if (fmt === 'Standard') {
    // Trust the API's own legality for this specific print first
    if (apiData?.legalities?.standard === 'Banned') return { legal: false, reason: 'Banned in Standard' };
    if (apiData?.legalities?.standard === 'Legal') return { legal: true };
    // Fall back to era range check
    const eraResult = checkEraLegality(rc, ERA_FORMATS[0].code);
    if (eraResult.legal) return { legal: true };
    // Outside era range — check if any cached print of this card is API-legal (reprint)
    if (hasLegalStdReprint(rc.name, apiCache)) {
      return { legal: true, warn: true, reason: `Old print (${rc.setCode}) — legal reprint exists` };
    }
    return eraResult;
  }

  if (fmt === 'Expanded') {
    if (apiData?.legalities?.expanded === 'Banned') return { legal: false, reason: 'Banned in Expanded' };
    if (PRE_EXPANDED.has(setId)) return { legal: false, reason: `${rc.setCode} is pre-BW, not Expanded legal` };
    return { legal: true };
  }

  if (fmt === 'GLC') {
    if (PRE_EXPANDED.has(setId)) return { legal: false, reason: `${rc.setCode} not Expanded legal` };
    if (apiData?.subtypes?.some(st => GLC_RULE_BOX.has(st))) {
      const illegal = apiData.subtypes.find(st => GLC_RULE_BOX.has(st));
      return { legal: false, reason: `${illegal} cards banned in GLC` };
    }
    const isBasicEnergy = apiData?.supertype === 'Energy' && apiData?.subtypes?.includes('Basic');
    if (!isBasicEnergy && rc.qty > 1) return { legal: false, reason: `GLC: max 1 copy (found ${rc.qty})` };
    return { legal: true };
  }

  return { legal: true };
}
