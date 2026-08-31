import { useState, useEffect } from 'react';
import { useStore } from '../hooks/useStore';
import { cardKey } from '../utils/cards';
import { ERA_FORMATS } from '../data/eras';
import { SPLASH_DEFS } from '../data/splashDefs';
import { RECOMMENDED_DECKS } from '../data/recommendedDecks';
import { fetchSplashImage } from '../utils/api';
import DeckCard from '../components/DeckCard';
import DeckModal from '../components/DeckModal';
import { lookupCard } from '../utils/api';
import { parseRawLines, buildSectionMap } from '../utils/cards';

const URL_RE = /(https?:\/\/[^\s]+)/g;
function RichText({ text, style }) {
  if (!text) return null;
  return (
    <span style={style}>
      {text.split('\n').map((line, li) => (
        <span key={li}>
          {li > 0 && <br />}
          {line.split(URL_RE).map((part, pi) =>
            URL_RE.test(part)
              ? <a key={pi} href={part} target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--yellow)', textDecoration: 'underline', wordBreak: 'break-all' }}
                  onClick={e => e.stopPropagation()}>{part}</a>
              : part
          )}
        </span>
      ))}
    </span>
  );
}

const FORMAT_COLOR = {
  All:      '#FFCB05',
  Standard: '#6C8EBF',
  Expanded: '#9b59b6',
  GLC:      '#e67e22',
  Era:      '#C47BDE',
  Custom:   '#7A7590',
};

// Pull up to `limit` card images from a list of decks via apiCache (fallback when no splash defined)
function getSplashImgs(decks, apiCache, limit = 5) {
  const imgs = [];
  for (const deck of decks) {
    for (const rc of deck.rawCards) {
      if (imgs.length >= limit) return imgs;
      const data = apiCache[cardKey(rc)];
      const src = data?.imageLarge || data?.imageSmall;
      if (src && !imgs.includes(src)) imgs.push(src);
    }
  }
  return imgs;
}

// Sum total owned cards across all decks in a format group
function sumGroupOwned(decks) {
  let total = 0;
  for (const deck of decks) {
    for (const rc of deck.rawCards) {
      const val = deck.ownedMap?.[cardKey(rc)];
      if (Array.isArray(val)) total += val.slice(0, rc.qty).reduce((s, v) => s + (v || 0), 0);
      else total += Math.min(rc.qty, Math.max(0, val || 0));
    }
  }
  return total;
}

function FormatContainer({ label, subLabel, color, decks, ownedCount, apiCache, splashImages, isSelected, onClick }) {
  // Prefer pre-fetched splash images; fall back to cards from user's own decks
  const imgs = splashImages?.length ? splashImages : getSplashImgs(decks, apiCache);
  const deckCount = decks.filter(d => !d.isBuyList).length;
  const labelFontSize = label.length > 38 ? 11 : label.length > 26 ? 13 : label.length > 14 ? 17 : 22;

  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 14,
        border: `2px solid ${isSelected ? color : 'var(--card-border)'}`,
        background: isSelected ? `color-mix(in srgb, ${color} 10%, var(--darker))` : 'var(--darker)',
        cursor: 'pointer',
        height: 200,
        transition: 'border-color .15s, background .15s',
        userSelect: 'none',
        flexShrink: 0,
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = color + '88'; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--card-border)'; }}
    >
      {/* Card fan */}
      {imgs.map((src, i) => (
        <img key={i} src={src} alt="" style={{
          position: 'absolute',
          right: -14 + (imgs.length - 1 - i) * 42,
          top: '50%',
          transform: `translateY(-50%) rotate(${(i - (imgs.length - 1) / 2) * 6}deg)`,
          height: 175,
          width: 'auto',
          borderRadius: 6,
          boxShadow: '0 4px 16px rgba(0,0,0,.7)',
          zIndex: i,
          pointerEvents: 'none',
        }} />
      ))}

      {/* Gradient overlay so text is readable */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(to right, var(--darker) 45%, transparent 85%)',
        zIndex: imgs.length,
      }} />

      {/* Text */}
      <div style={{
        position: 'relative',
        zIndex: imgs.length + 1,
        padding: '14px 18px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 2,
      }}>
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: labelFontSize,
          fontWeight: 800,
          letterSpacing: .5,
          color: isSelected ? color : 'var(--text)',
          lineHeight: 1.2,
        }}>{label}</span>
        {subLabel && (
          <span style={{ fontSize: 10, color, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{subLabel}</span>
        )}
        <span style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
          {deckCount} deck{deckCount !== 1 ? 's' : ''}
          {ownedCount > 0 && <span style={{ marginLeft: 6 }}>· {ownedCount} owned</span>}
        </span>
      </div>
    </div>
  );
}

// Chronological order: Standard=0, Expanded=1, GLC=2, Era formats 3…N (ERA_FORMATS order), Custom=last
const ERA_CHRONO_START = 3;
const CUSTOM_CHRONO = ERA_CHRONO_START + ERA_FORMATS.length;

function buildAllGroups(regular) {
  return [
    {
      key: 'all', format: 'All', eraLabel: null, label: 'All Decks', subLabel: null,
      decks: regular, chronoOrder: -1,
    },
    {
      key: 'standard', format: 'Standard', eraLabel: null, label: 'Standard', subLabel: null,
      decks: regular.filter(d => (d.format || 'Standard') === 'Standard'), chronoOrder: 0,
    },
    {
      key: 'expanded', format: 'Expanded', eraLabel: null, label: 'Expanded', subLabel: null,
      decks: regular.filter(d => d.format === 'Expanded'), chronoOrder: 1,
    },
    {
      key: 'glc', format: 'GLC', eraLabel: null, label: 'GLC', subLabel: null,
      decks: regular.filter(d => d.format === 'GLC'), chronoOrder: 2,
    },
    ...ERA_FORMATS.map((ef, i) => ({
      key: `era-${ef.code}`,
      format: 'Era',
      eraLabel: ef.code,
      label: ef.label,
      subLabel: 'Retro',
      decks: regular.filter(d => d.format === 'Era' && (d.eraLabel || '') === ef.code),
      chronoOrder: ERA_CHRONO_START + i,
    })),
    {
      key: 'custom', format: 'Custom', eraLabel: null, label: 'Custom', subLabel: null,
      decks: regular.filter(d => d.format === 'Custom'), chronoOrder: CUSTOM_CHRONO,
    },
  ].map(g => ({ ...g, ownedCount: sumGroupOwned(g.decks) }));
}

const SECTION_ORDER = ['Pokemon', 'Trainer', 'Energy', 'Other'];

const REC_DECK_COLS = 10;

function RecDeckViewer({ rec, color, onAdd, onClose }) {
  const rawCards = rec.raw ? parseRawLines(rec.raw) : [];
  const cols = REC_DECK_COLS;

  const [cardImgs, setCardImgs] = useState(() => rawCards.map(rc => ({ rc, img: null })));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setCardImgs(rawCards.map(rc => ({ rc, img: null })));
    setLoading(true);
    if (!rec.raw) { setLoading(false); return; }
    let cancelled = false;
    const sectionMap = buildSectionMap(rec.raw);
    (async () => {
      for (let i = 0; i < rawCards.length; i++) {
        if (cancelled) return;
        const rc = rawCards[i];
        const data = await lookupCard(rc.setCode, rc.num, rc.name);
        if (cancelled) return;
        const img = data?.imageLarge || data?.imageSmall || null;
        setCardImgs(prev => prev.map((item, idx) => idx === i ? { ...item, img } : item));
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [rec]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 1100, width: '92vw' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ color }}>{rec.name}</h3>
        {rec.notes && (
          <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginTop: 0, marginBottom: 16 }}>
            <RichText text={rec.notes} />
          </p>
        )}

        {/* Card grid — always 10 columns wide, regardless of deck size */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8, marginBottom: 20 }}>
          {cardImgs.map(({ rc, img }, i) => (
            <div key={i} style={{ position: 'relative' }}>
              {img
                ? <img src={img} alt={rc.name} title={`${rc.qty}x ${rc.name}`}
                    style={{ width: '100%', height: 'auto', borderRadius: 6, boxShadow: '0 2px 10px rgba(0,0,0,.55)', display: 'block' }} />
                : <div style={{
                    aspectRatio: '2.5/3.5', borderRadius: 6,
                    background: loading ? 'var(--pill)' : 'var(--darker)',
                    border: '1px solid var(--card-border)',
                    animation: loading ? 'pulse 1.5s ease-in-out infinite' : 'none',
                  }} />
              }
              {rc.qty > 1 && (
                <span style={{
                  position: 'absolute', top: 4, right: 4,
                  background: 'rgba(0,0,0,.8)', color: '#fff',
                  fontSize: 11, fontWeight: 800, borderRadius: 4,
                  padding: '1px 5px', lineHeight: 1.4,
                }}>×{rc.qty}</span>
              )}
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button className="btn btn-yellow" onClick={onAdd}>+ Add to My Decks</button>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function Library({ onOpenDeck, entered, onEnteredChange }) {
  const { state } = useStore();
  const [sortBy, setSortBy] = useState('owned');
  const [onlyWithDecks, setOnlyWithDecks] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [editDeck, setEditDeck] = useState(null);
  const setEntered = onEnteredChange;
  const [splashImgs, setSplashImgs] = useState({});
  const [recSplashImgs, setRecSplashImgs] = useState({});
  const [viewRec, setViewRec] = useState(null);

  const regular = state.decks.filter(d => !d.isBuyList);
  const buyLists = state.decks.filter(d => d.isBuyList);

  // Fetch splash card images on mount, one format at a time to avoid API rate limits.
  // Successful results are cached in localStorage; failures are not cached so they retry.
  // State is updated incrementally so images pop in as they load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const [formatKey, cards] of Object.entries(SPLASH_DEFS)) {
        if (cancelled) return;
        const [frontImg, backImg] = await Promise.all([
          fetchSplashImage(cards[0]),
          cards[1] ? fetchSplashImage(cards[1]) : Promise.resolve(null),
        ]);
        // [back, front] — fan renders index 0 at back, last index at front
        const imgs = [backImg, frontImg].filter(Boolean);
        if (!cancelled && imgs.length) {
          setSplashImgs(prev => ({ ...prev, [formatKey]: imgs }));
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Fetch splash images for recommended decks in the currently entered container.
  // splash can be a single def object or an array of up to 2 defs.
  useEffect(() => {
    if (!entered) return;
    const recs = RECOMMENDED_DECKS[entered] || [];
    if (!recs.length) return;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < recs.length; i++) {
        const rec = recs[i];
        if (!rec.splash || cancelled) continue;
        const defs = Array.isArray(rec.splash) ? rec.splash.slice(0, 2) : [rec.splash];
        const imgs = await Promise.all(defs.map(d => fetchSplashImage(d)));
        const filtered = imgs.filter(Boolean);
        if (!cancelled && filtered.length) {
          setRecSplashImgs(prev => ({ ...prev, [`${entered}||${i}`]: filtered }));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [entered]);

  const allGroups = buildAllGroups(regular);

  // Filter
  const visibleGroups = onlyWithDecks
    ? allGroups.filter(g => g.key === 'all' || g.decks.length > 0)
    : allGroups;

  // Sort — "All" always first, then by selected sort
  const sortedGroups = [...visibleGroups].sort((a, b) => {
    if (a.key === 'all') return -1;
    if (b.key === 'all') return 1;
    if (sortBy === 'owned') {
      const diff = b.ownedCount - a.ownedCount;
      if (diff !== 0) return diff;
      const dDiff = b.decks.length - a.decks.length;
      if (dDiff !== 0) return dDiff;
      return a.chronoOrder - b.chronoOrder;
    }
    return a.chronoOrder - b.chronoOrder;
  });

  const entered_group = allGroups.find(g => g.key === entered);
  const newDeckDefault = entered_group && entered_group.format !== 'All'
    ? { defaultFormat: entered_group.format, defaultEraLabel: entered_group.eraLabel || '' }
    : {};

  // ── Container picker ────────────────────────────────────────────────────────
  if (!entered) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 24, fontWeight: 800, letterSpacing: .4, color: 'var(--yellow)' }}>
            My Decks
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-yellow btn-sm" onClick={() => setNewOpen(true)}>+ New Deck</button>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--muted)', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={onlyWithDecks}
                onChange={e => setOnlyWithDecks(e.target.checked)}
                style={{ accentColor: 'var(--yellow)', cursor: 'pointer' }}
              />
              Only formats with decks
            </label>
            <div style={{ display: 'flex', gap: 4 }}>
              {[['owned', 'By Owned'], ['chrono', 'Chronological']].map(([val, lbl]) => (
                <button
                  key={val}
                  onClick={() => setSortBy(val)}
                  style={{
                    padding: '4px 10px', fontSize: 11, fontWeight: 700, borderRadius: 6, cursor: 'pointer',
                    border: `1px solid ${sortBy === val ? 'var(--yellow)' : 'var(--card-border)'}`,
                    background: sortBy === val ? 'rgba(255,203,5,.1)' : 'transparent',
                    color: sortBy === val ? 'var(--yellow)' : 'var(--muted)',
                    transition: 'all .15s',
                    fontFamily: "'Outfit',sans-serif",
                  }}
                >{lbl}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Container grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {sortedGroups.map(g => (
            <FormatContainer
              key={g.key}
              label={g.label}
              subLabel={g.subLabel}
              color={FORMAT_COLOR[g.format] || FORMAT_COLOR.Custom}
              decks={g.decks}
              ownedCount={g.ownedCount}
              apiCache={state.apiCache}
              splashImages={splashImgs[g.key]}
              isSelected={false}
              onClick={() => setEntered(g.key)}
            />
          ))}
        </div>
        {newOpen && <DeckModal onClose={() => setNewOpen(false)} onSaved={() => {}} />}
      </div>
    );
  }

  // ── Inside a container ──────────────────────────────────────────────────────
  const color = FORMAT_COLOR[entered_group.format] || FORMAT_COLOR.Custom;
  const displayDecks = entered_group.decks;
  const recommended = RECOMMENDED_DECKS[entered_group.key] || [];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          onClick={() => setEntered(null)}
          style={{ background: 'none', border: '1px solid var(--card-border)', borderRadius: 8, padding: '5px 12px', color: 'var(--muted)', cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ← Back
        </button>
        <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 800, letterSpacing: .4, color }}>
          {entered_group.label}
        </span>
        {entered_group.subLabel && (
          <span style={{ fontSize: 11, color, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', opacity: .7 }}>
            {entered_group.subLabel}
          </span>
        )}
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn btn-yellow btn-sm" onClick={() => setNewOpen(true)}>+ New Deck</button>
        </div>
      </div>

      {/* My Decks grid */}
      {displayDecks.length > 0 ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 16, marginBottom: buyLists.length && entered_group.format === 'All' ? 24 : 0 }}>
            {displayDecks.map(deck => (
              <DeckCard key={deck.id} deck={deck} onClick={() => onOpenDeck(deck.id)} onEdit={() => setEditDeck(deck)} />
            ))}
          </div>
          {buyLists.length > 0 && entered_group.format === 'All' && (
            <>
              <div className="sec-div"><div className="lbl">Buy Lists</div><div className="line" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 16 }}>
                {buyLists.map(deck => (
                  <DeckCard key={deck.id} deck={deck} onClick={() => onOpenDeck(deck.id)} onEdit={() => setEditDeck(deck)} />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>No {entered_group.label} decks yet</div>
          <button className="btn btn-yellow" onClick={() => setNewOpen(true)}>+ New Deck</button>
        </div>
      )}

      {/* Recommended Decks */}
      {recommended.length > 0 && (
        <>
          <div className="sec-div" style={{ marginTop: displayDecks.length ? 28 : 0 }}>
            <div className="lbl">Recommended Decks</div>
            <div className="line" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 14 }}>
            {recommended.map((rec, i) => {
              const splashImg = recSplashImgs[`${entered}||${i}`];
              return (
                <div
                  key={i}
                  onClick={() => setViewRec(rec)}
                  style={{
                    display: 'flex', overflow: 'hidden',
                    background: 'var(--darker)', border: `1px solid var(--card-border)`,
                    borderRadius: 12, cursor: 'pointer', height: 200,
                    transition: 'border-color .15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = color + '88'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--card-border)'; }}
                >
                  {/* Left: text */}
                  <div style={{
                    flex: 1, minWidth: 0,
                    padding: '16px 20px',
                    display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5,
                  }}>
                    {(() => {
                      const len = rec.name.length;
                      const fs = len > 40 ? 14 : len > 28 ? 16 : len > 18 ? 19 : 22;
                      return (
                        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: fs, fontWeight: 800, letterSpacing: .3, color: 'var(--text)', lineHeight: 1.2 }}>
                          {rec.name}
                        </div>
                      );
                    })()}
                    {rec.notes && (
                      <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4,
                        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        <RichText text={rec.notes.split('\n')[0]} />
                      </div>
                    )}
                  </div>
                  {/* Right: splash image(s) */}
                  {splashImg && (() => {
                    const imgs = Array.isArray(splashImg) ? splashImg : [splashImg];
                    const offsets = imgs.length === 2 ? [28, -4] : [-4];
                    const rotations = imgs.length === 2 ? [-5, 5] : [4];
                    return (
                      <div style={{ position: 'relative', width: 170, flexShrink: 0, overflow: 'hidden' }}>
                        {imgs.map((src, si) => (
                          <img key={si} src={src} alt="" style={{
                            position: 'absolute', right: offsets[si], top: '50%',
                            transform: `translateY(-50%) rotate(${rotations[si]}deg)`,
                            height: 185, width: 'auto', borderRadius: 6,
                            boxShadow: '0 4px 16px rgba(0,0,0,.7)',
                            zIndex: si, pointerEvents: 'none',
                          }} />
                        ))}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Recommended deck detail modal */}
      {viewRec && (
        <RecDeckViewer
          rec={viewRec}
          color={color}
          onAdd={() => { setNewOpen({ rec: viewRec }); setViewRec(null); }}
          onClose={() => setViewRec(null)}
        />
      )}

      {newOpen && (
        <DeckModal
          {...newDeckDefault}
          defaultName={newOpen?.rec?.name}
          defaultRaw={newOpen?.rec?.raw}
          defaultNotes={newOpen?.rec?.notes}
          onClose={() => setNewOpen(false)}
          onSaved={() => {}}
        />
      )}
      {editDeck && <DeckModal deck={editDeck} onClose={() => setEditDeck(null)} onSaved={() => {}} />}
    </div>
  );
}
