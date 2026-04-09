import { useState, useEffect } from 'react';
import { fetchAllPrints, getBasicEnergyType } from '../utils/api';

const ENERGY_COLOR = {
  Fire: '#e8460a', Water: '#4a90d9', Grass: '#3a9a3a', Lightning: '#e8c200',
  Psychic: '#9b59b6', Fighting: '#b87333', Darkness: '#555', Metal: '#8e9dad',
  Dragon: '#7b68ee', Fairy: '#e91e8c', Colorless: '#aaa',
};

function EnergyCost({ cost }) {
  if (!cost?.length) return null;
  return (
    <span style={{ display: 'inline-flex', gap: 2, verticalAlign: 'middle', marginRight: 4 }}>
      {cost.map((type, i) => (
        <span key={i} style={{
          display: 'inline-block', width: 14, height: 14, borderRadius: '50%',
          background: ENERGY_COLOR[type] || '#aaa', border: '1px solid rgba(255,255,255,.2)',
          fontSize: 7, color: '#fff', textAlign: 'center', lineHeight: '14px', fontWeight: 800,
        }} title={type}>{type[0]}</span>
      ))}
    </span>
  );
}

export default function CardInfoModal({ card: initialCard, onClose }) {
  const [card, setCard] = useState(initialCard);
  const [altPrints, setAltPrints] = useState([]);
  const [loadingAlts, setLoadingAlts] = useState(false);

  // Sync if parent swaps the card prop entirely
  useEffect(() => { setCard(initialCard); }, [initialCard?.id]);

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
      setAltPrints(prints.filter(p => p.id !== card.id));
      setLoadingAlts(false);
    });
  }, [card?.id]);

  if (!card) return null;
  const img = card.imageLarge || card.imageSmall;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 720, display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Image */}
        {img && (
          <img
            src={img}
            alt={card.name}
            style={{ width: 200, borderRadius: 10, flexShrink: 0, border: '2px solid var(--card-border)' }}
          />
        )}

        {/* Info */}
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

          {/* Weakness / Retreat */}
          {(card.weaknesses?.length > 0 || card.retreatCost != null) && (
            <div style={{ display: 'flex', gap: 16, marginTop: 4, marginBottom: 12, fontSize: 11, color: 'var(--muted)' }}>
              {card.weaknesses?.map((w, i) => (
                <span key={i}>Weakness: <strong style={{ color: 'var(--text)' }}>{w.type} {w.value}</strong></span>
              ))}
              {card.retreatCost != null && (
                <span>Retreat: <strong style={{ color: 'var(--text)' }}>{card.retreatCost === 0 ? 'Free' : `×${card.retreatCost}`}</strong></span>
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

          {/* Alternate prints */}
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
                    onClick={() => setCard(p)}
                  >
                    {p.setName} #{p.number}
                    {p.marketPrice != null ? ` · $${p.marketPrice.toFixed(2)}` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions" style={{ width: '100%' }}>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          {card.tcgplayerUrl && (
            <a href={card.tcgplayerUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
              TCGPlayer ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
