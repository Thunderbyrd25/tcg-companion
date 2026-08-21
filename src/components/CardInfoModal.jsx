import { useState, useEffect } from 'react';
import ZoomableCardImage from './ZoomableCardImage';
import CardDetailContent from './CardDetailContent';

export default function CardInfoModal({ card: initialCard, onClose }) {
  const [card, setCard] = useState(initialCard);

  // Sync if parent swaps the card prop entirely
  useEffect(() => { setCard(initialCard); }, [initialCard?.id]);

  if (!card) return null;
  const img = card.imageLarge || card.imageSmall;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 720, display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}
        onClick={e => e.stopPropagation()}
      >
        <ZoomableCardImage src={img} alt={card.name} />
        <CardDetailContent card={card} onCardChange={setCard} />

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
