import { useState, useEffect } from 'react';
import { fetchAllPrints, fetchAllAppearances, lookupCard, getBasicEnergyType } from '../utils/api';

const ENERGY_COLOR = {
  Fire: '#e8460a', Water: '#4a90d9', Grass: '#3a9a3a', Lightning: '#e8c200',
  Psychic: '#9b59b6', Fighting: '#b87333', Darkness: '#555', Metal: '#8e9dad',
  Dragon: '#7b68ee', Fairy: '#e91e8c', Colorless: '#aaa',
};

function TypeIcon({ type }) {
  return (
    <span style={{
      display: 'inline-block', width: 14, height: 14, borderRadius: '50%',
      background: ENERGY_COLOR[type] || '#aaa', border: '1px solid rgba(255,255,255,.2)',
      fontSize: 7, color: '#fff', textAlign: 'center', lineHeight: '14px', fontWeight: 800,
    }} title={type}>{type[0]}</span>
  );
}

function EnergyCost({ cost }) {
  if (!cost?.length) return null;
  return (
    <span style={{ display: 'inline-flex', gap: 2, verticalAlign: 'middle', marginRight: 4 }}>
      {cost.map((type, i) => <TypeIcon key={i} type={type} />)}
    </span>
  );
}

// Full card detail: name/HP, type line, rules/abilities/attacks, weakness/resistance/retreat,
// set info + price, Other Prints, Other Appearances. Used by CardInfoModal and every
// per-card popup that wants this content inline instead of behind a "Card Info" button.
// `onCardChange` is called whenever the user switches to a different print/appearance,
// or when this component patches missing fields onto `card` from a richer same-slot print.
export default function CardDetailContent({ card, onCardChange }) {
  const [altPrints, setAltPrints] = useState([]);
  const [loadingAlts, setLoadingAlts] = useState(false);
  const [appearances, setAppearances] = useState([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [loadingAppCard, setLoadingAppCard] = useState(null); // id of appearance being loaded

  useEffect(() => {
    if (!card) return;
    setAltPrints([]);
    setLoadingAlts(true);
    // For basic energies, normalise the name so all variants share a cache entry
    const energyType = getBasicEnergyType(card.name);
    const lookupName = energyType ? `${energyType} Energy` : card.name;
    fetchAllPrints(lookupName, {
      supertype: card.supertype,
      hp: card.hp,
      attackNames: card.attacks,
      attacksFull: card.attacksFull,
    }).then(prints => {
      const normNum = n => String(n || '').replace(/^0+/, '') || '0';
      const sameSetAs = (a, b) =>
        (a.setId && b.setId && a.setId === b.setId) ||
        (a.setCode && b.setCode && a.setCode === b.setCode) ||
        (a.setName && b.setName && a.setName === b.setName);
      const isSameSlot = p =>
        p.id !== card.id &&
        normNum(p.number) === normNum(card.number) &&
        sameSetAs(p, card);

      const scoreCard = c => (c.rules?.length || 0) + (c.abilities?.length || 0) +
        (c.attacksFull?.length || 0) + (c.nationalPokedexNumbers?.length || 0) +
        (c.marketPrice != null ? 1 : 0);

      // Find same-slot or self in prints to patch missing fields onto card
      const freshSelf = prints.find(p => p.id === card.id);
      const sameSlot  = prints.find(isSameSlot);
      const donor = (sameSlot && scoreCard(sameSlot) >= scoreCard(freshSelf || card))
        ? sameSlot : (freshSelf || sameSlot);
      if (donor) {
        onCardChange({
          ...card,
          rules:               donor.rules?.length               ? donor.rules               : (card.rules || []),
          abilities:           donor.abilities?.length            ? donor.abilities            : (card.abilities || []),
          attacksFull:         donor.attacksFull?.length          ? donor.attacksFull          : (card.attacksFull || []),
          attacks:             donor.attacks?.length              ? donor.attacks              : (card.attacks || []),
          nationalPokedexNumbers: donor.nationalPokedexNumbers?.length ? donor.nationalPokedexNumbers : (card.nationalPokedexNumbers || []),
        });
      }

      // Deduplicate altPrints: exclude self, same-slot, and duplicates within list
      const altMap = new Map();
      for (const p of prints) {
        if (p.id === card.id || isSameSlot(p)) continue;
        const key = `${normNum(p.number)}||${p.setId || p.setCode || p.setName}`;
        const ex = altMap.get(key);
        if (!ex || scoreCard(p) > scoreCard(ex)) altMap.set(key, p);
      }
      setAltPrints([...altMap.values()]);
      setLoadingAlts(false);
    });
  }, [card?.id]);

  // All {Pokémon} cards: every card featuring the same Pokédex number, including this one.
  useEffect(() => {
    if (!card?.nationalPokedexNumbers?.length) { setAppearances([]); return; }
    setLoadingApps(true);
    fetchAllAppearances(card.nationalPokedexNumbers).then(results => {
      setAppearances(results);
      setLoadingApps(false);
    });
  }, [card?.id, card?.nationalPokedexNumbers?.[0]]);

  if (!card) return null;

  return (
    <div style={{ flex: 1, minWidth: 220 }}>
      {/* Name + HP */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, letterSpacing: .5, color: 'var(--yellow)' }}>{card.name}</span>
        {card.hp && <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>HP {card.hp}</span>}
      </div>

      {/* Type line */}
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>
        {card.supertype}{card.subtypes?.length ? ` — ${card.subtypes.join(', ')}` : ''}
      </div>

      {/* Rules / card text (trainer effects, energy text, rule boxes) */}
      {card.rules?.length > 0 && card.rules.map((rule, i) => {
        const isRuleBox = /rule:/i.test(rule) || /you must/i.test(rule);
        return (
          <div key={i} style={{
            marginBottom: 10, padding: '8px 10px',
            background: isRuleBox ? 'rgba(245,166,35,.06)' : 'rgba(108,142,191,.06)',
            border: `1px solid ${isRuleBox ? 'rgba(245,166,35,.2)' : 'rgba(108,142,191,.2)'}`,
            borderRadius: 8,
          }}>
            {isRuleBox && (
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--yellow)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: .5 }}>
                Rule Box
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.6 }}>{rule}</div>
          </div>
        );
      })}

      {/* Abilities */}
      {card.abilities?.map((ab, i) => (
        <div key={i} style={{ marginBottom: 10, padding: '8px 10px', background: 'rgba(255,203,5,.06)', border: '1px solid rgba(255,203,5,.2)', borderRadius: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--yellow)', marginBottom: 3 }}>
            {ab.type}: {ab.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.5 }}>{ab.text}</div>
        </div>
      ))}

      {/* Attacks */}
      {card.attacksFull?.map((atk, i) => (
        <div key={i} style={{ marginBottom: 10, padding: '8px 10px', background: 'var(--pill)', border: '1px solid var(--card-border)', borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
            <EnergyCost cost={atk.cost} />
            <span style={{ fontWeight: 800, fontSize: 12 }}>{atk.name}</span>
            {atk.damage && <span style={{ marginLeft: 'auto', fontWeight: 800, fontSize: 13, color: 'var(--text)' }}>{atk.damage}</span>}
          </div>
          {atk.text && <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>{atk.text}</div>}
        </div>
      ))}

      {/* Weakness / Resistance / Retreat */}
      {(card.weaknesses?.length > 0 || card.resistances?.length > 0 || card.retreatCost != null) && (
        <div style={{ display: 'flex', gap: 16, marginTop: 4, marginBottom: 12, fontSize: 11, color: 'var(--muted)', flexWrap: 'wrap' }}>
          {card.weaknesses?.map((w, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              Weakness: <TypeIcon type={w.type} /> <strong style={{ color: 'var(--text)' }}>{w.value}</strong>
            </span>
          ))}
          {card.resistances?.map((r, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              Resistance: <TypeIcon type={r.type} /> <strong style={{ color: 'var(--text)' }}>{r.value}</strong>
            </span>
          ))}
          {card.retreatCost != null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              Retreat: {card.retreatCost === 0
                ? <strong style={{ color: 'var(--text)' }}>Free</strong>
                : Array.from({ length: card.retreatCost }, (_, i) => <TypeIcon key={i} type="Colorless" />)}
            </span>
          )}
        </div>
      )}

      {/* Set info */}
      <div style={{ fontSize: 10, color: 'var(--muted)', borderTop: '1px solid var(--card-border)', paddingTop: 8, marginTop: 4 }}>
        <div>{card.setName}{card.number ? ` · #${card.number}` : ''}{card.rarity ? ` · ${card.rarity}` : ''}</div>
        {card.regulationMark && <div style={{ marginTop: 2 }}>Regulation Mark: {card.regulationMark}</div>}
        {card.marketPrice != null && (
          <div style={{ marginTop: 4 }}>
            <span style={{ color: 'var(--green)', fontWeight: 700 }}>${card.marketPrice.toFixed(2)}</span>
            {card.reverseHoloPrice != null && (
              <span style={{ color: 'var(--muted)', marginLeft: 10 }}>Rev. Holo: ${card.reverseHoloPrice.toFixed(2)}</span>
            )}
          </div>
        )}
      </div>

      {/* Other Prints — same card design, different set/art */}
      {(loadingAlts || altPrints.length > 0) && (
        <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--card-border)' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            Other Prints{loadingAlts && ' …'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {altPrints.map(p => (
              <button
                key={p.id}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 10, padding: '3px 8px', fontWeight: p.id === card.id ? 800 : 400 }}
                onClick={() => onCardChange(p)}
              >
                {p.setName} #{p.number}
                {p.marketPrice != null ? ` · $${p.marketPrice.toFixed(2)}` : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* All {Pokémon} cards — every card featuring the same Pokédex number, including this one */}
      {(loadingApps || appearances.length > 0) && (
        <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--card-border)' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            All {card.name} cards{loadingApps && ' …'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {appearances.map(p => (
              <button
                key={p.id}
                title={`${p.name}\n${p.setName} #${p.number}`}
                style={{
                  background: 'none', borderRadius: 6,
                  border: `2px solid ${p.id === card.id ? 'var(--orange)' : 'transparent'}`,
                  padding: 0, cursor: loadingAppCard === p.id ? 'wait' : 'pointer',
                  opacity: loadingAppCard && loadingAppCard !== p.id ? 0.5 : 1,
                  transition: 'border-color .15s',
                }}
                onMouseEnter={e => { if (!loadingAppCard && p.id !== card.id) e.currentTarget.style.borderColor = 'var(--yellow)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = p.id === card.id ? 'var(--orange)' : 'transparent'; }}
                onClick={async () => {
                  if (loadingAppCard) return;
                  setLoadingAppCard(p.id);
                  const full = await lookupCard(p.setCode, p.number, p.name);
                  setLoadingAppCard(null);
                  if (full) onCardChange(full);
                }}
              >
                {p.imageSmall
                  ? <img src={p.imageSmall} alt={p.name} style={{ width: 56, borderRadius: 4, display: 'block' }} loading="lazy" />
                  : <div style={{ width: 56, height: 78, background: 'var(--pill)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: 'var(--muted)' }}>{p.name}</div>
                }
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
