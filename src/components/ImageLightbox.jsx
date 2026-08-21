// Full-size image viewer — click the backdrop (or Close) to dismiss.
export default function ImageLightbox({ src, alt, onClose }) {
  if (!src) return null;
  return (
    <div className="modal-overlay" style={{ zIndex: 400 }} onClick={onClose}>
      <img
        src={src}
        alt={alt}
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,.6)' }}
      />
    </div>
  );
}
