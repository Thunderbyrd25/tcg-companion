import { useStore } from '../hooks/useStore';
import { cardKey, getSection } from '../utils/cards';
import { checkLegality } from '../utils/cards';

export default function DeckCard({ deck, onClick, onEdit }) {
  const { state, getApiData, getDeckOwned, deckCost } = useStore();

  // Cover: first pokemon with image
  let coverApi = null;
  for (const rc of deck.rawCards) {
    const sec = rc.section || getSection(rc.name, deck.sectionMap, {});
    if (sec !== 'Pokemon' && sec !== 'Other') continue;
    const a = getApiData(rc);
    if (a?.imageSmall) { coverApi = a; break; }
  }

  // Owned fraction
  let totalCards = 0, ownedCards = 0;
  for (const rc of deck.rawCards) {
    totalCards += rc.qty;
    ownedCards += getDeckOwned(deck, rc);
  }

  // Legality issues
  const issues = deck.rawCards.filter(rc => {
    const api = getApiData(rc);
    return !checkLegality(rc, deck, api, state.apiCache).legal;
  }).length;

  const cost = deckCost(deck);
  const remaining = deckCost(deck, true);
  const fmt = deck.format || 'Standard';
  const fmtLabel = fmt === 'Era' ? (deck.eraLabel || 'Retro') : fmt;

  const isComplete = totalCards > 0 && ownedCards >= totalCards;
  const dotColor = isComplete ? 'var(--green)' : ownedCards > 0 ? 'var(--yellow)' : 'var(--muted)';

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--card-bg)', border: '1px solid var(--card-border)',
        borderRadius: 14, overflow: 'hidden', cursor: 'pointer',
        transition: 'all .2s', position: 'relative',
        display: 'flex', minHeight: 120,
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,.4)'; e.currentTarget.style.borderColor = 'var(--yellow)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = 'var(--card-border)'; }}
    >
      {/* Left cover strip */}
      <div style={{
        width: 80, flexShrink: 0, background: 'var(--pill)',
        overflow: 'hidden', position: 'relative',
      }}>
        {coverApi?.imageSmall
          ? <img src={coverApi.imageSmall} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
          : <div style={{ width: '100%', height: '100%', background: 'var(--card-border)', opacity: .4 }} />
        }
      </div>

      {/* Right content */}
      <div style={{ flex: 1, padding: '12px 13px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5, minWidth: 0 }}>
        {/* Name row */}
        <div style={{ fontWeight: 800, fontSize: 14, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 5 }}>
          {deck.name}
          {deck.isBuyList && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', letterSpacing: .5, textTransform: 'uppercase' }}>buy list</span>}
        </div>

        {/* Badges row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className={`fmt-badge fmt-${fmt}`}>{fmtLabel}</span>
          {issues > 0 && (
            <span style={{ fontSize: 10, color: '#ff6b4a', background: 'rgba(227,53,13,.12)', border: '1px solid rgba(227,53,13,.25)', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
              ! {issues} illegal
            </span>
          )}
        </div>

        {/* Fraction + cost row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0, boxShadow: isComplete ? `0 0 6px var(--green)` : 'none' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: isComplete ? 'var(--green)' : 'var(--text)' }}>
              {ownedCards}/{totalCards}
            </span>
          </span>
          {cost > 0 && <span style={{ fontSize: 11, color: 'var(--muted)' }}>${cost.toFixed(2)}</span>}
          {remaining > 0 && <span style={{ fontSize: 11, color: 'var(--orange)' }}>·&nbsp;${remaining.toFixed(2)} needed</span>}
        </div>
      </div>

      {/* Edit button */}
      <button
        className="btn btn-xs btn-ghost"
        onClick={e => { e.stopPropagation(); onEdit?.(); }}
        style={{ position: 'absolute', top: 7, right: 7, width: 24, height: 24, padding: 0, justifyContent: 'center', borderRadius: '50%', background: 'rgba(0,0,0,.55)', border: 'none', fontSize: 11 }}
      >···</button>
    </div>
  );
}
