import { useState } from 'react';
import ImageLightbox from './ImageLightbox';

// Card art shown in detail views: hover grays it out with a "+" hint,
// click opens the full-size image in a lightbox.
export default function ZoomableCardImage({ src, alt }) {
  const [hover, setHover] = useState(false);
  const [open, setOpen] = useState(false);
  if (!src) return null;
  return (
    <>
      <div
        style={{
          position: 'relative', width: 200, flexShrink: 0, borderRadius: 10, overflow: 'hidden',
          cursor: 'pointer', border: '2px solid var(--card-border)',
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => setOpen(true)}
      >
        <img
          src={src}
          alt={alt}
          style={{ width: '100%', display: 'block', filter: hover ? 'grayscale(1) brightness(.55)' : 'none', transition: 'filter .15s' }}
        />
        {hover && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 40, fontWeight: 300, color: '#fff', pointerEvents: 'none',
          }}>+</div>
        )}
      </div>
      {open && <ImageLightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}
