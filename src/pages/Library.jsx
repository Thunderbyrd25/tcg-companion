import { useState } from 'react';
import { useStore } from '../hooks/useStore';
import DeckCard from '../components/DeckCard';
import DeckModal from '../components/DeckModal';

const FORMAT_OPTIONS = ['All', 'Standard', 'Expanded', 'GLC', 'Era', 'Custom'];
const FORMAT_LABELS = { Era: 'Retro' };

export default function Library({ onOpenDeck }) {
  const { state } = useStore();
  const [newOpen, setNewOpen] = useState(false);
  const [editDeck, setEditDeck] = useState(null);
  const [formatFilter, setFormatFilter] = useState('All');

  const regular = state.decks.filter(d => {
    if (d.isBuyList) return false;
    if (formatFilter === 'All') return true;
    return (d.format || 'Standard') === formatFilter;
  });
  const buyLists = state.decks.filter(d => d.isBuyList);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 24, fontWeight: 800, letterSpacing: .4, color: 'var(--yellow)' }}>My Decks</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FORMAT_OPTIONS.map(f => (
            <button key={f} className={`chip ${formatFilter === f ? 'on' : ''}`} onClick={() => setFormatFilter(f)}
              style={{ fontSize: 11 }}>{FORMAT_LABELS[f] || f}</button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn btn-yellow btn-sm" onClick={() => setNewOpen(true)}>+ New Deck</button>
        </div>
      </div>

      {state.decks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>No decks yet</div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>Add your first deck to get started</div>
          <button className="btn btn-yellow" onClick={() => setNewOpen(true)}>+ New Deck</button>
        </div>
      ) : (
        <>
          {regular.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 16, marginBottom: buyLists.length ? 24 : 0 }}>
              {regular.map(deck => (
                <DeckCard key={deck.id} deck={deck} onClick={() => onOpenDeck(deck.id)} onEdit={() => setEditDeck(deck)} />
              ))}
              {formatFilter === 'All' && <AddCard onClick={() => setNewOpen(true)} />}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>No {formatFilter} decks yet</div>
            </div>
          )}

          {buyLists.length > 0 && formatFilter === 'All' && (
            <>
              <div className="sec-div"><div className="lbl">Buy Lists</div><div className="line" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 16 }}>
                {buyLists.map(deck => (
                  <DeckCard key={deck.id} deck={deck} onClick={() => onOpenDeck(deck.id)} onEdit={() => setEditDeck(deck)} />
                ))}
              </div>
            </>
          )}

          {regular.length === 0 && formatFilter === 'All' && <AddCard onClick={() => setNewOpen(true)} />}
        </>
      )}

      {newOpen && <DeckModal onClose={() => setNewOpen(false)} onSaved={() => {}} />}
      {editDeck && <DeckModal deck={editDeck} onClose={() => setEditDeck(null)} onSaved={() => {}} />}
    </div>
  );
}

function AddCard({ onClick }) {
  return (
    <div onClick={onClick}
      style={{
        border: '2px dashed var(--card-border)', background: 'transparent',
        borderRadius: 16, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 10,
        minHeight: 170, cursor: 'pointer', transition: 'all .2s',
        color: 'var(--muted)', fontWeight: 800,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--yellow)'; e.currentTarget.style.color = 'var(--yellow)'; e.currentTarget.style.background = 'rgba(255,203,5,.04)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--card-border)'; e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ fontSize: 32 }}>+</div>
      <div style={{ fontSize: 13 }}>New Deck</div>
    </div>
  );
}
