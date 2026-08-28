import { ALL_SETS, PTCGO_TO_SET_ID } from '../data/sets';
import { expandEnergySymbols } from './api';
import { ERA_FORMATS } from '../data/eras';
import { isBannedIn } from '../data/bans';

// Maps TCG Live virtual energy slot numbers to [setCode, cardNumber].
// SUM slots (18-26) → sm1 card numbers (strategy 1 direct hit on pokemontcg.io).
// SMTE/SSHE/BRSE slots → local DB energy sets (not in pokemontcg.io).
// Slots not listed here default to SVE.
const ENERGY_SLOT_MAP = {
  // SUM era (sm1 Sun & Moon base): actual card numbers
  18:['SUM','164'], 19:['SUM','165'], 20:['SUM','166'],
  21:['SUM','167'], 22:['SUM','168'], 23:['SUM','169'],
  24:['SUM','170'], 25:['SUM','171'], 26:['SUM','172'],
  // Team Up era art (SMTE local DB, SM Energy 010-018)
  27:['SMTE','10'], 28:['SMTE','11'], 29:['SMTE','12'],
  30:['SMTE','13'], 31:['SMTE','14'], 32:['SMTE','15'],
  33:['SMTE','16'], 34:['SMTE','17'], 35:['SMTE','18'],
  // Sword & Shield base era art (SSHE local DB, SWSH Energy 001-008)
  36:['SSHE','1'],  37:['SSHE','2'],  38:['SSHE','3'],
  39:['SSHE','4'],  40:['SSHE','5'],  41:['SSHE','6'],
  42:['SSHE','7'],  43:['SSHE','8'],  44:['SSHE','9'],
  // Brilliant Stars era art (BRSE local DB, SWSH Energy 010-017)
  45:['BRSE','10'], 46:['BRSE','11'], 47:['BRSE','12'],
  48:['BRSE','13'], 49:['BRSE','14'], 50:['BRSE','15'],
  51:['BRSE','16'], 52:['BRSE','17'],
};

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
    // TCG Live exports basic energies with "Energy N" as a virtual global slot number.
    // Map each slot to the correct physical set + card number so lookupCard can find it.
    // SUM (18-26) → sm1 actual numbers; SMTE/SSHE/BRSE → local DB energy sets.
    line = line.replace(/\s+Energy\s+(\d+[a-z]?)$/, (_, slotStr) => {
      const slot = parseInt(slotStr);
      const mapped = ENERGY_SLOT_MAP[slot];
      return mapped ? ` ${mapped[0]} ${mapped[1]}` : ` SVE ${slotStr}`;
    });
    let match = line.match(/^(\d+)\s+(.+?)(?:\s+([A-Z][A-Z0-9]{1,5}(?:-[A-Z]{2,3})?)\s+([A-Za-z0-9]+))?$/);
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
    const m = line.match(/^(\d+)\s+(.+?)(?:\s+[A-Z][A-Z0-9]{1,5}(?:-[A-Z]{2,3})?\s+[A-Za-z0-9]+)?$/);
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

// PTCG Live exports some promo sets under different codes than pokemontcg.io / ALL_SETS.
// Normalize these before era index lookups so XYP/BWP are found correctly.
export const PROMO_CODE_ALIASES = {
  'XYP':   'PR-XY',
  'BWP':   'PR-BLW',
  'SMP':   'PR-SM',
  'SWP':   'PR-SW',
  'SVP':   'PR-SV',
  'DPP':   'PR-DPP',
  'HSP':   'PR-HS',
};

// Era name in notes → ALL_SETS promo set code
const NOTES_ERA_TO_PROMO = {
  'WotC': 'PR', 'Nintendo': 'PR-NP',
  'DP': 'PR-DPP', 'HGSS': 'PR-HS',
  'BW': 'PR-BLW', 'XY': 'PR-XY',
  'SM': 'PR-SM', 'SWSH': 'PR-SW', 'SV': 'PR-SV',
};

// Parse "BW Promos 51–101, XY Promos 1–55, 91 legal" → Map<canonicalSetCode, Set<number>>
function parseEraPromoNotes(notes) {
  if (!notes) return new Map();
  const result = new Map();
  const re = /(\w+)\s+Promos?\s+([\d,\s–\-]+?)(?=(?:\s*,\s*\w+\s+Promos?|\s*legal|\s*$))/gi;
  let m;
  while ((m = re.exec(notes)) !== null) {
    const code = NOTES_ERA_TO_PROMO[m[1]];
    if (!code) continue;
    const nums = new Set();
    for (const part of m[2].split(',')) {
      const t = part.trim();
      const range = t.match(/(\d+)\s*[–\-]\s*(\d+)/);
      if (range) {
        for (let i = +range[1]; i <= +range[2]; i++) nums.add(i);
      } else {
        const n = parseInt(t);
        if (!isNaN(n)) nums.add(n);
      }
    }
    if (nums.size) {
      const existing = result.get(code);
      if (existing) for (const n of nums) existing.add(n);
      else result.set(code, nums);
    }
  }
  return result;
}

// Cache parsed promo notes per era code so we don't re-parse on every legality check
const _promoNotesCache = new Map();
export function getEraPromoAllowances(eraLabel) {
  if (_promoNotesCache.has(eraLabel)) return _promoNotesCache.get(eraLabel);
  const ef = ERA_FORMATS.find(f => f.code === eraLabel);
  const parsed = parseEraPromoNotes(ef?.notes);
  _promoNotesCache.set(eraLabel, parsed);
  return parsed;
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

  // Normalize the card's set code: PTCG Live promo codes → ALL_SETS codes
  const rawCode = rc.setCode.toUpperCase();
  const canonicalCode = PROMO_CODE_ALIASES[rawCode] || rawCode;
  const cardIdx = allCodes.indexOf(canonicalCode);

  if (fromIdx === -1 || toIdx === -1) return { legal: true };
  const min = Math.min(fromIdx, toIdx);
  const max = Math.max(fromIdx, toIdx);

  if (cardIdx !== -1 && cardIdx >= min && cardIdx <= max) return { legal: true };

  // Not found in the main range — check era notes for explicit promo allowances
  // e.g. "BW Promos 51–101" allows PR-BLW #100 (N) in BCR-ROS
  const promoAllowances = getEraPromoAllowances(eraLabel);
  if (promoAllowances.size) {
    // Try both the raw code and the canonical code to handle XYP/BWP stored cards
    for (const tryCode of [canonicalCode, rawCode]) {
      const allowed = promoAllowances.get(tryCode);
      if (allowed) {
        // Strip letter prefix (e.g. "BW100" → 100, "XY126" → 126) before range check
        const cardNum = parseInt((rc.num || '').replace(/^[A-Za-z]+/, ''));
        if (!isNaN(cardNum) && allowed.has(cardNum)) return { legal: true };
      }
    }
  }

  if (cardIdx === -1) return { legal: false, reason: `${rc.setCode} not in known sets` };
  return { legal: false, reason: `${rc.setCode} outside era ${eraLabel}` };
}

const PRE_EXPANDED = new Set(['base1','base2','base3','base4','base5','base6','gym1','gym2','neo1','neo2','neo3','neo4','ecard1','ecard2','ecard3','ex1','ex2','ex3','ex4','ex5','ex6','ex7','ex8','ex9','ex10','ex11','ex12','ex13','ex14','ex15','ex16','dp1','dp2','dp3','dp4','dp5','dp6','dp7','pl1','pl2','pl3','pl4','hgss1','hgss2','hgss3','hgss4','col1']);

// The regulation mark first used on NEW cards in each SWSH/SV set.
// Per-card marks may differ (reprints keep original marks), but each set's
// fresh originals carry this mark. Used to compute the minimum legal mark
// for an era format. Pre-SWSH sets are absent because they have no reg marks.
export const SET_MIN_MARK = {
  'SSH':'A','RCL':'A','PR-SW':'A',
  'DAA':'B','CPA':'B','SHF':'B',
  'VIV':'C','BST':'C','CRE':'C',
  'EVS':'D','CEL':'D',
  'FST':'E',
  'BRS':'F','BRSTG':'F','ASR':'F','ASRTG':'F','PGO':'F','LOR':'F','LORTG':'F',
  'SIT':'G','SITTG':'G','CRZ':'G','CRZGG':'G',
  'SVI':'G','SVE':'G','PR-SV':'G','PAL':'G','TEF':'G',
  'OBF':'H','MEW':'H','PAR':'H','PAF':'H','TWM':'H','SFA':'H','SCR':'H','SSP':'H','PRE':'H',
  'JTG':'I','DRI':'I','BLK':'I','WHT':'I',
  'ASC':'I','PFL':'I','POR':'I','MEG':'I','MEP':'I','MEE':'I',
};

// Returns the minimum regulation mark for an era format (the mark of the oldest
// set in the era range), or null for pre-SWSH eras that have no reg marks.
export function getEraMinMark(eraLabel) {
  if (!eraLabel) return null;
  const parts = eraLabel.split('-');
  const fromCode = parts[0].trim().toUpperCase();
  const toCode = (parts[1] || parts[0]).trim().toUpperCase();
  const allCodes = ALL_SETS.map(s => s.code);
  const fromIdx = allCodes.indexOf(fromCode);
  const toIdx = allCodes.indexOf(toCode);
  if (fromIdx === -1 || toIdx === -1) return null;
  // ALL_SETS is newest-first, so higher index = older set
  const oldestCode = allCodes[Math.max(fromIdx, toIdx)];
  return SET_MIN_MARK[oldestCode] || null;
}
const GLC_RULE_BOX = new Set(['ex','EX','GX','V','VMAX','VSTAR','Radiant','ACE SPEC','VUNION','MEGA','Tag Team','SP']);

// Current Standard minimum regulation mark. Update when the annual rotation happens.
// H = current (Standard starts at Twilight Masquerade / sv6, August 2025 rotation)
// Next update: change to 'I' when sv6–sv8 rotate out.
export const STANDARD_MIN_MARK = 'H';

// Returns the regulation mark for a card directly from the API.
// Regulation marks are per-card, not per-set — a reprint in a newer set may carry
// the same mark as the original printing (e.g. Prof's Research reprinted in PRE kept G).
// Falls back to SET_MIN_MARK for sets where the API omits the mark (e.g. Japanese sets).
export function effectiveRegMark(setCode, apiRegMark) {
  return apiRegMark || SET_MIN_MARK[setCode?.toUpperCase()] || '';
}

// Returns true if apiCache has any print of `name` that is Standard-legal.
// Standard-legal means: H+ regulation mark (or no reg mark for pre-reg-mark cards)
// AND the API marks it as Legal.
// srcSubtypes: the subtypes of the card being checked (from apiData), used to ensure
// the found reprint is the same card variant (e.g. Basic ≠ Special for same-named energies).
// srcHp / srcAttacks: for Pokémon, require the reprint to share the same HP and at least
// one attack name so that a different-design Charmander (different moves) doesn't validate
// an old Charmander. Trainers/Energy don't need this — same name = same card.
function hasLegalStdReprint(name, apiCache, srcSubtypes, srcHp, srcAttacks) {
  if (!apiCache) return false;
  // A card is a Pokémon if it has HP (only Pokémon have HP).
  // Using HP rather than subtypes because Basic-stage Pokémon also have subtype 'Basic',
  // which would incorrectly exclude them from the HP+attacks check.
  const isPokemon = srcHp != null && srcHp !== '';
  for (const data of Object.values(apiCache)) {
    if (!data || data.name !== name) continue;
    if (data.legalities?.standard !== 'Legal') continue;
    // Only an explicit STANDARD_MIN_MARK+ regulation mark counts as a valid legal reprint.
    // Every card in a current Standard-legal set has a regulation mark; if rm is empty
    // or below the threshold the entry is either a rotated print or old enough to lack
    // a mark entirely — neither qualifies as a legal reprint for this check.
    const rm = effectiveRegMark(data.setCode, data.regulationMark);
    if (!rm || rm < STANDARD_MIN_MARK) continue;
    // If we know the source card's subtypes, require the reprint to share at least one subtype.
    // This prevents old special Darkness/Metal Energy from matching basic Darkness/Metal Energy.
    if (srcSubtypes?.length) {
      const hasMatchingSubtype = srcSubtypes.some(st => data.subtypes?.includes(st));
      if (!hasMatchingSubtype) continue;
    }
    // For Pokémon: require matching HP and at least one matching attack so a newer
    // Charmander with different moves doesn't validate an old Charmander print.
    if (isPokemon && srcHp && srcAttacks?.length) {
      if (data.hp !== srcHp) continue;
      const reprAttacks = (data.attacks || []).map(a => a.toLowerCase()).sort();
      const srcSorted = [...srcAttacks].map(a => a.toLowerCase()).sort();
      if (reprAttacks.length !== srcSorted.length) continue;
      if (!srcSorted.every((a, i) => a === reprAttacks[i])) continue;
    }
    return true;
  }
  return false;
}

export function checkLegality(rc, deck, apiData, apiCache = null) {
  const fmt = deck.format || 'Standard';
  if (fmt === 'Custom') return { legal: true };
  if (fmt === 'Eternal') {
    if (rc.name && isBannedIn(rc.name, 'Eternal', rc.setCode)) return { legal: false, reason: `${rc.name} is banned in Eternal` };
    return { legal: true };
  }
  // Basic energies are always legal in every format — check by apiData first, then by name
  // (name fallback handles cards loaded from TCGDex which may lack supertype/subtypes)
  const isBasicEnergy = (apiData?.supertype === 'Energy' && apiData?.subtypes?.includes('Basic'))
    || (/^(?:Basic )?(?:Grass|Fire|Water|Lightning|Psychic|Fighting|Darkness|Metal|Fairy|Dragon|Colorless) Energy$/.test(rc.name) && apiData?.subtypes?.includes?.('Special') !== true);
  if (isBasicEnergy) return { legal: true };
  if (fmt === 'Era') {
    const eraLabel = deck.eraLabel || '';

    // Ban check — runs before any range/reprint logic so a banned card can't
    // be snuck in via an alternate print.
    const ef = ERA_FORMATS.find(f => f.code === eraLabel);
    if (ef?.banned?.length && rc.name) {
      const normStr = s => (s || '').toLowerCase().replace(/['']/g, "'");
      const normNum = n => String(n || '').replace(/^0+/, '') || '0';
      for (const ban of ef.banned) {
        if (normStr(rc.name) !== normStr(ban.name)) continue;
        if (ban.number !== undefined && normNum(rc.num) !== normNum(ban.number)) continue;
        return { legal: false, reason: `${ban.name} is banned in this era` };
      }
    }

    const isPokemon = apiData?.supertype === 'Pokémon' || apiData?.supertype === 'Pokemon';
    const eraMinMark = getEraMinMark(eraLabel);

    if (eraMinMark) {
      // ── Reg-mark era (SWSH / SV and newer) ──────────────────────────────────
      // A card is directly legal if its set is in the era range AND its regulation
      // mark is >= the era's minimum mark. TG reprints that carry an old mark from
      // their original printing (e.g. E-mark TG in a BRS set) are excluded.
      const setInRange = checkEraLegality(rc, eraLabel).legal;
      const cardMark = apiData?.regulationMark;
      if (setInRange && cardMark && cardMark >= eraMinMark) return { legal: true };

      // Non-Pokémon (Trainers / non-basic Energy): any print is legal if any
      // in-range copy of the same card has a legal mark for this era.
      // Pokémon must use a directly-legal print — no "any print" shortcut.
      if (!isPokemon && apiCache) {
        for (const data of Object.values(apiCache)) {
          if (!data?.name || data.name !== rc.name || !data.setCode) continue;
          if (apiData?.subtypes?.length && !apiData.subtypes.some(st => data.subtypes?.includes(st))) continue;
          if (!checkEraLegality({ setCode: data.setCode, num: data.number }, eraLabel).legal) continue;
          if (data.regulationMark && data.regulationMark >= eraMinMark) {
            return { legal: true, warn: true, reason: `Old print — era-legal reprint exists` };
          }
        }
      }
      return { legal: false, reason: `Not legal in ${eraLabel} era` };
    }

    // ── Pre-reg-mark era (SM / XY / BW / older) ─────────────────────────────
    // A card is legal if its set is within the era range.
    // Non-Pokémon: any print is legal if any copy with the same name appears in the range.
    // Pokémon: must be the same card design (HP + attacks match) to count as a reprint.
    const eraResult = checkEraLegality(rc, eraLabel);
    if (eraResult.legal) return { legal: true };

    if (apiCache) {
      for (const data of Object.values(apiCache)) {
        if (!data?.name || data.name !== rc.name || !data.setCode) continue;
        if (apiData?.subtypes?.length && !apiData.subtypes.some(st => data.subtypes?.includes(st))) continue;
        if (!checkEraLegality({ setCode: data.setCode, num: data.number }, eraLabel).legal) continue;
        if (!isPokemon) {
          return { legal: true, warn: true, reason: `Old print — era-legal reprint exists` };
        }
        // Pokémon: require same HP and attack list (same card design, different art)
        if (apiData?.hp && apiData?.attacks?.length) {
          if (data.hp !== apiData.hp) continue;
          const dataAtks = (data.attacks || []).map(a => a.toLowerCase()).sort();
          const srcAtks = [...apiData.attacks].map(a => a.toLowerCase()).sort();
          if (dataAtks.length !== srcAtks.length || !srcAtks.every((a, i) => a === dataAtks[i])) continue;
          return { legal: true, warn: true, reason: `Print ${rc.setCode} outside era — era reprint exists` };
        }
      }
    }
    return eraResult;
  }

  const setId = (PTCGO_TO_SET_ID[rc.setCode?.toUpperCase()] || '').toLowerCase();

  if (fmt === 'Standard') {
    if (apiData?.legalities?.standard === 'Banned') return { legal: false, reason: 'Banned in Standard' };

    const regMark = effectiveRegMark(rc.setCode, apiData?.regulationMark);
    const isPokemon = apiData?.supertype === 'Pokémon' || apiData?.supertype === 'Pokemon';

    if (regMark) {
      // Regulation mark is the ground truth for Standard legality.
      // STANDARD_MIN_MARK and later = current Standard; earlier = rotated out.
      if (regMark >= STANDARD_MIN_MARK) return { legal: true };
      // Rotated mark — Pokémon must use the specific print with a current-era mark.
      // Non-Pokémon (Trainers, Energy) are playable via any same-named current reprint.
      if (!isPokemon && hasLegalStdReprint(rc.name, apiCache, apiData?.subtypes, apiData?.hp, apiData?.attacks)) {
        return { legal: true, warn: true, reason: `Old print (${rc.setCode}, mark ${regMark}) — legal reprint exists` };
      }
      return { legal: false, reason: `Regulation mark ${regMark} not Standard legal` };
    }

    // No regulation mark: pre-SWSH card. Pokémon require a current-era mark directly.
    // Non-Pokémon are legal if any H+ reprint of the same card name exists in cache.
    // Do NOT trust apiData?.legalities?.standard here — pokemontcg.io marks ALL
    // prints of a card as 'Legal' when any print is in the current legal pool.
    if (!isPokemon && hasLegalStdReprint(rc.name, apiCache, apiData?.subtypes, apiData?.hp, apiData?.attacks)) {
      return { legal: true, warn: true, reason: `Old print (${rc.setCode}) — legal reprint exists` };
    }
    return { legal: false, reason: isPokemon ? `Regulation mark ${regMark || '(none)'} not Standard legal` : 'No regulation mark — not Standard legal' };
  }

  if (fmt === 'Expanded') {
    if (rc.name && isBannedIn(rc.name, 'Expanded')) return { legal: false, reason: `${rc.name} is banned in Expanded` };
    if (apiData?.legalities?.expanded === 'Banned') return { legal: false, reason: 'Banned in Expanded' };
    if (PRE_EXPANDED.has(setId)) return { legal: false, reason: `${rc.setCode} is pre-BW, not Expanded legal` };
    return { legal: true };
  }

  if (fmt === 'GLC') {
    if (rc.name && isBannedIn(rc.name, 'GLC')) return { legal: false, reason: `${rc.name} is banned in GLC` };
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
