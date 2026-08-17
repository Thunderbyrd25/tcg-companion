import { useState, useEffect, useRef } from 'react';
import { useStore } from '../hooks/useStore';
import { parseRawLines, buildSectionMap, cardKey, checkEraLegality, effectiveRegMark, STANDARD_MIN_MARK } from '../utils/cards';
import { useToast } from './Toast';
import { ERA_FORMATS, ERA_GROUPS } from '../data/eras';
import { lookupCard, searchByName } from '../utils/api';

const FORMATS = ['Standard', 'Expanded', 'GLC', 'Era', 'Eternal', 'Custom'];
const FORMAT_LABELS = { Era: 'Retro' };

// Update or remove a card's qty in the raw deck list string.
function updateQtyInRaw(raw, rc, newQty) {
  const lines = raw.split('\n');
  const updated = [];
  for (const line of lines) {
    const t = line.trim();
    const m = t.match(/^(\d+)\s+(.+?)(?:\s+([A-Z][A-Z0-9]{1,5}(?:-[A-Z]{2,3})?)\s+([A-Za-z0-9]+))?$/);
    if (m) {
      const name = m[2].trim();
      const setCode = m[3] || '';
      const num = m[4] || '';
      if (name === rc.name && setCode === rc.setCode && num === rc.num) {
        if (newQty > 0) updated.push(`${newQty} ${name}${setCode ? ' ' + setCode + ' ' + num : ''}`);
        continue;
      }
    }
    updated.push(line);
  }
  return updated.join('\n');
}

// Append a new card line into the correct section of the raw deck string.
function appendCardLineToRaw(raw, card) {
  const section =
    card.supertype === 'Pokémon' || card.supertype === 'Pokemon' ? 'Pokemon'
    : card.supertype === 'Trainer' ? 'Trainer'
    : card.supertype === 'Energy' ? 'Energy'
    : 'Trainer';

  const cardLine = `1 ${card.name} ${card.setCode} ${card.number}`;
  const lines = raw.split('\n');

  let curSection = null;
  let lastCardInSection = -1;
  let sectionHeaderIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (/^(Pokemon|Pokémon):/i.test(t)) curSection = 'Pokemon';
    else if (/^Trainer:/i.test(t)) curSection = 'Trainer';
    else if (/^Energy:/i.test(t)) curSection = 'Energy';

    if (curSection === section) {
      if (sectionHeaderIdx === -1) sectionHeaderIdx = i;
      if (/^\d+/.test(t)) lastCardInSection = i;
    }
  }

  if (sectionHeaderIdx !== -1) {
    const insertAt = lastCardInSection !== -1 ? lastCardInSection + 1 : sectionHeaderIdx + 1;
    lines.splice(insertAt, 0, cardLine);
  } else {
    if (lines[lines.length - 1]?.trim()) lines.push('');
    lines.push(`${section}: 1`);
    lines.push(cardLine);
  }

  return lines.join('\n');
}

export default function DeckModal({
  deck, defaultFormat, defaultEraLabel, defaultName, defaultRaw, defaultNotes, onClose, onSaved,
}) {
  const { state, dispatch } = useStore();
  const toast = useToast();

  const [name, setName] = useState(deck?.name || defaultName || '');
  const [format, setFormat] = useState(deck?.format || defaultFormat || 'Standard');
  const [eraCode, setEraCode] = useState(
    (deck?.format === 'Era' || defaultFormat === 'Era')
      ? (deck?.eraLabel || defaultEraLabel || '') : ''
  );
  const [notes, setNotes] = useState(deck?.notes || defaultNotes || '');
  const [deckList, setDeckList] = useState(deck?.raw || defaultRaw || '');
  const [viewMode, setViewMode] = useState('text'); // 'text' | 'visual'
  const [pendingCollectionAdds, setPendingCollectionAdds] = useState({});

  // Visual mode image cache
  const [cardImgs, setCardImgs] = useState({});
  const fetchedRef = useRef(new Set());

  // Card search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const selectedEra = ERA_FORMATS.find(f => f.code === eraCode);
  const rawCards = parseRawLines(deckList);
  const totalQty = rawCards.reduce((s, rc) => s + rc.qty, 0);

  // Close search when leaving visual mode
  useEffect(() => {
    if (viewMode !== 'visual') {
      setSearchOpen(false);
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [viewMode]);

  // Fetch images for visual mode; skips already-fetched keys
  useEffect(() => {
    if (viewMode !== 'visual') return;
    let cancelled = false;
    const toFetch = rawCards.filter(rc => !fetchedRef.current.has(cardKey(rc)));
    if (!toFetch.length) return;
    (async () => {
      for (const rc of toFetch) {
        if (cancelled) return;
        const ck = cardKey(rc);
        fetchedRef.current.add(ck);
        const data = await lookupCard(rc.setCode, rc.num, rc.name);
        if (cancelled) return;
        const img = data?.imageLarge || data?.imageSmall || null;
        setCardImgs(prev => ({ ...prev, [ck]: img }));
      }
    })();
    return () => { cancelled = true; };
  }, [viewMode, deckList]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  useEffect(() => {
    if (!searchOpen || searchQuery.length < 2) { setSearchResults([]); return; }
    const legalityFormat = format === 'Standard' ? 'Standard' : format === 'Expanded' ? 'Expanded' : null;
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        let cards = await searchByName(searchQuery, { legalityFormat });
        // Secondary filter: the API sometimes marks rotated prints as Legal.
        // Use regulation mark as ground truth for Standard: H+ = legal, G and earlier = rotated.
        if (format === 'Standard') {
          cards = cards.filter(c => {
            if (c.supertype === 'Energy' && c.subtypes?.includes('Basic')) return true;
            if (!c.setCode) return true;
            const rm = effectiveRegMark(c.setCode, c.regulationMark);
            if (rm) return rm >= STANDARD_MIN_MARK;
            // No reg mark — fall back to era range
            return checkEraLegality({ setCode: c.setCode, num: c.number }, ERA_FORMATS[0].code).legal;
          });
        }
        setSearchResults(cards);
      } finally {
        setSearchLoading(false);
      }
    }, 350);
    return () => { clearTimeout(timer); setSearchLoading(false); };
  }, [searchQuery, searchOpen, format]);

  function changeQty(rc, delta) {
    const newQty = rc.qty + delta;
    if (newQty < 0) return;
    if (delta > 0 && totalQty >= 60) return;

    if (newQty === 0 && deck) {
      const ck = cardKey(rc);
      const ownedVal = deck.ownedMap?.[ck];
      const ownedCount = Array.isArray(ownedVal)
        ? ownedVal.reduce((s, v) => s + (v || 0), 0)
        : Math.min(rc.qty, Math.max(0, ownedVal || 0));
      if (ownedCount > 0) {
        const keep = confirm(`You own ${ownedCount} cop${ownedCount > 1 ? 'ies' : 'y'} of ${rc.name}. Keep them in your collection?`);
        if (keep) setPendingCollectionAdds(prev => ({ ...prev, [ck]: (prev[ck] || 0) + ownedCount }));
      }
    }

    setDeckList(prev => updateQtyInRaw(prev, rc, newQty));
  }

  function addCardFromSearch(card) {
    if (totalQty >= 60) return;
    const ck = cardKey({ name: card.name, setCode: card.setCode, num: card.number });
    const existing = rawCards.find(r => cardKey(r) === ck);
    const isBasicEnergy = card.supertype === 'Energy' && card.subtypes?.includes('Basic');
    const maxCopies = isBasicEnergy ? 60 : 4;

    if (existing) {
      if (existing.qty >= maxCopies) return;
      setDeckList(prev => updateQtyInRaw(prev, existing, existing.qty + 1));
    } else {
      // Pre-fill image from search result so it shows immediately
      const img = card.imageLarge || card.imageSmall || null;
      if (img) {
        setCardImgs(prev => ({ ...prev, [ck]: img }));
        fetchedRef.current.add(ck);
      }
      setDeckList(prev => appendCardLineToRaw(prev, card));
    }
  }

  function save() {
    const rawCards = parseRawLines(deckList);
    const sectionMap = buildSectionMap(deckList);
    const finalName = name.trim() || 'Unnamed Deck';

    if (deck) {
      const oldOwnedMap = { ...(deck.ownedMap || {}) };
      const oldBlingSel = { ...(deck.blingSel || {}) };
      const newOwned = {};
      const newBling = {};
      for (const rc of rawCards) {
        const ck = cardKey(rc);
        if (oldOwnedMap[ck] !== undefined) newOwned[ck] = Math.min(rc.qty, oldOwnedMap[ck]);
        if (oldBlingSel[ck]) newBling[ck] = oldBlingSel[ck];
      }
      dispatch({ type: 'SAVE_DECK', deck: {
        ...deck, name: finalName, format, eraLabel: format === 'Era' ? eraCode : '',
        notes, rawCards, raw: deckList, sectionMap, ownedMap: newOwned, blingSel: newBling,
      }});
    } else {
      dispatch({ type: 'SAVE_DECK', deck: {
        id: Date.now(), name: finalName, format,
        eraLabel: format === 'Era' ? eraCode : '',
        notes, rawCards, raw: deckList, sectionMap,
        ownedMap: {}, blingSel: {}, isBuyList: false,
      }});
    }

    if (Object.keys(pendingCollectionAdds).length > 0) {
      const newCollection = { ...state.collection };
      for (const [ck, qty] of Object.entries(pendingCollectionAdds)) {
        newCollection[ck] = (newCollection[ck] || 0) + qty;
      }
      dispatch({ type: 'SET_COLLECTION', collection: newCollection });
    }

    toast(`${finalName} saved!`, 'green');
    onSaved?.();
    onClose();
  }

  function deleteDeck() {
    if (!confirm(`Delete "${deck?.name}"? This cannot be undone.`)) return;
    const ownedMap = deck.ownedMap || {};
    const hasOwned = deck.rawCards?.some(rc => {
      const val = ownedMap[cardKey(rc)];
      if (!val) return false;
      if (Array.isArray(val)) return val.some(v => v);
      return val > 0;
    });
    const addToCollection = hasOwned
      ? confirm('Would you like to add the owned cards back to your collection?')
      : false;
    dispatch({ type: 'DELETE_DECK', id: deck.id, addToCollection, ownedMap, rawCards: deck.rawCards });
    onClose();
  }

  const atCap = totalQty >= 60;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: viewMode === 'visual' ? 960 : 600, transition: 'max-width .2s' }}
        onClick={e => e.stopPropagation()}
      >
        <h3>{deck ? 'Edit Deck' : 'New Deck'}</h3>

        <div className="fg">
          <label>Deck Name</label>
          <input className="fi" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Charizard ex OBF" />
        </div>

        <div className="fg">
          <label>Format</label>
          {(() => {
            const fmtColor = format === 'Standard' ? 'var(--std)' : format === 'Expanded' ? 'var(--exp)' : format === 'GLC' ? 'var(--glc)' : format === 'Era' ? 'var(--era)' : format === 'Eternal' ? 'var(--eternal)' : 'var(--cst)';
            return (
              <select
                value={format}
                onChange={e => setFormat(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8, cursor: 'pointer',
                  border: `2px solid ${fmtColor}`,
                  background: `color-mix(in srgb, ${fmtColor} 10%, var(--darker))`,
                  color: fmtColor,
                  fontFamily: "'Outfit',sans-serif", fontWeight: 700,
                  marginBottom: format === 'Era' ? 10 : 0,
                }}
              >
                {FORMATS.map(f => <option key={f} value={f}>{FORMAT_LABELS[f] || f}</option>)}
              </select>
            );
          })()}

          {format === 'Era' && (
            <div style={{ marginTop: 8, padding: '14px', background: 'var(--darker)', border: '1px solid var(--card-border)', borderRadius: 10 }}>
              <div style={{ position: 'relative' }}>
                <select className="fi" value={eraCode} onChange={e => setEraCode(e.target.value)}
                  style={{ width: '100%', padding: '8px 36px 8px 12px', marginBottom: selectedEra ? 10 : 0, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' }}>
                  <option value="">— Select a format window —</option>
                  {Object.entries(ERA_GROUPS).map(([group, formats]) => (
                    <optgroup key={group} label={group}>
                      {formats.map(f => <option key={f.code} value={f.code}>{f.label}</option>)}
                    </optgroup>
                  ))}
                </select>
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: `translateY(${selectedEra ? '-65%' : '-50%'})`, pointerEvents: 'none', color: 'var(--muted)', fontSize: 12 }}>▾</span>
              </div>
              {selectedEra && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 15, letterSpacing: .4, padding: '3px 10px 3px 9px', borderLeft: '3px solid var(--era)', color: 'var(--era)' }}>
                      {selectedEra.code}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{selectedEra.label}</span>
                  </div>
                  {selectedEra.notes && (
                    <div style={{ fontSize: 11, color: 'var(--muted)', paddingLeft: 12, borderLeft: '2px solid var(--card-border)' }}>
                      {selectedEra.notes}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Deck List */}
        <div className="fg">
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ margin: 0 }}>Deck List</label>
            <span style={{ fontSize: 11, color: atCap ? 'var(--yellow)' : 'var(--muted)', marginLeft: 8, fontWeight: atCap ? 700 : 400 }}>
              {totalQty}/60
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
              {[['text', 'Text'], ['visual', 'Visual']].map(([m, lbl]) => (
                <button key={m} onClick={() => setViewMode(m)} style={{
                  padding: '3px 10px', fontSize: 11, fontWeight: 700, borderRadius: 5, cursor: 'pointer',
                  border: `1px solid ${viewMode === m ? 'var(--yellow)' : 'var(--card-border)'}`,
                  background: viewMode === m ? 'rgba(255,203,5,.1)' : 'transparent',
                  color: viewMode === m ? 'var(--yellow)' : 'var(--muted)',
                  fontFamily: "'Outfit',sans-serif", transition: 'all .15s',
                }}>{lbl}</button>
              ))}
            </div>
          </div>

          {/* TEXT MODE */}
          {viewMode === 'text' && (
            <textarea className="fi" value={deckList} onChange={e => setDeckList(e.target.value)}
              placeholder={"Pokemon: 18\n4 Charizard ex OBF 125\n...\nTrainer: 26\n4 Ultra Ball SVI 196\n...\nEnergy: 6\n6 Fire Energy SVE 2"} />
          )}

          {/* VISUAL MODE */}
          {viewMode === 'visual' && (
            <div>
              {rawCards.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: 13 }}>
                  No cards yet — add them via Search below or paste in Text mode.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: '8px 6px', padding: '4px 0' }}>
                  {rawCards.map((rc, i) => {
                    const ck = cardKey(rc);
                    const img = cardImgs[ck];
                    return (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                          {img
                            ? <img src={img} alt={rc.name} title={rc.name}
                                style={{ width: '100%', height: 'auto', borderRadius: 6, display: 'block', boxShadow: '0 2px 8px rgba(0,0,0,.5)' }} />
                            : <div style={{ aspectRatio: '2.5/3.5', borderRadius: 6, background: 'var(--pill)', border: '1px solid var(--card-border)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                          }
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                          <button onClick={() => changeQty(rc, -1)} style={ctrlBtn(false)}>−</button>
                          <span style={{ fontSize: 12, fontWeight: 800, minWidth: 14, textAlign: 'center', color: 'var(--text)' }}>{rc.qty}</span>
                          <button onClick={() => changeQty(rc, +1)} disabled={atCap} style={ctrlBtn(atCap)}>+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add Card search */}
              <div style={{ marginTop: 12 }}>
                {!searchOpen ? (
                  !atCap && (
                    <button
                      onClick={() => setSearchOpen(true)}
                      style={{
                        width: '100%', padding: '8px', borderRadius: 8, cursor: 'pointer',
                        border: '2px dashed var(--card-border)', background: 'transparent',
                        color: 'var(--muted)', fontWeight: 700, fontSize: 13,
                        fontFamily: "'Outfit',sans-serif", transition: 'all .15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--yellow)'; e.currentTarget.style.color = 'var(--yellow)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--card-border)'; e.currentTarget.style.color = 'var(--muted)'; }}
                    >+ Add Card</button>
                  )
                ) : (
                  <div style={{ border: '1px solid var(--card-border)', borderRadius: 10, padding: '12px', background: 'var(--darker)' }}>
                    {/* Search header */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
                      <input
                        className="fi"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder={`Search ${format === 'Standard' ? 'Standard-legal ' : format === 'Expanded' ? 'Expanded-legal ' : ''}cards…`}
                        style={{ flex: 1, marginBottom: 0 }}
                        autoFocus
                      />
                      <button
                        onClick={() => { setSearchOpen(false); setSearchQuery(''); setSearchResults([]); }}
                        style={{ background: 'none', border: '1px solid var(--card-border)', borderRadius: 6, color: 'var(--muted)', cursor: 'pointer', padding: '5px 9px', fontSize: 14, lineHeight: 1, flexShrink: 0 }}
                      >×</button>
                    </div>

                    {atCap && (
                      <div style={{ textAlign: 'center', padding: '8px 0', color: 'var(--yellow)', fontSize: 12, fontWeight: 700 }}>
                        Deck is full (60/60)
                      </div>
                    )}

                    {!atCap && searchLoading && (
                      <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)', fontSize: 12 }}>Searching…</div>
                    )}

                    {!atCap && !searchLoading && searchResults.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(78px, 1fr))', gap: 6, maxHeight: 250, overflowY: 'auto', padding: '2px' }}>
                        {searchResults.map((card, i) => {
                          const ck = cardKey({ name: card.name, setCode: card.setCode, num: card.number });
                          const existing = rawCards.find(r => cardKey(r) === ck);
                          const isBasicEnergy = card.supertype === 'Energy' && card.subtypes?.includes('Basic');
                          const atMax = existing && existing.qty >= (isBasicEnergy ? 60 : 4);
                          return (
                            <div
                              key={i}
                              onClick={() => !atMax && addCardFromSearch(card)}
                              title={`${card.name} · ${card.setCode} ${card.number}${existing ? ` (×${existing.qty} in deck)` : ''}`}
                              style={{
                                position: 'relative', borderRadius: 6, overflow: 'hidden',
                                border: `1px solid ${atMax ? 'var(--card-border)' : 'transparent'}`,
                                cursor: atMax ? 'default' : 'pointer', opacity: atMax ? .45 : 1,
                                transition: 'all .12s',
                              }}
                              onMouseEnter={e => { if (!atMax) { e.currentTarget.style.borderColor = 'var(--yellow)'; e.currentTarget.style.transform = 'scale(1.06)'; } }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = atMax ? 'var(--card-border)' : 'transparent'; e.currentTarget.style.transform = ''; }}
                            >
                              {card.imageSmall
                                ? <img src={card.imageSmall} alt={card.name} style={{ width: '100%', height: 'auto', display: 'block' }} />
                                : <div style={{ aspectRatio: '2.5/3.5', background: 'var(--pill)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4 }}>
                                    <span style={{ fontSize: 9, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.3 }}>{card.name}</span>
                                  </div>
                              }
                              {existing && (
                                <span style={{ position: 'absolute', top: 3, right: 3, background: 'rgba(0,0,0,.85)', color: 'var(--yellow)', fontSize: 9, fontWeight: 800, borderRadius: 3, padding: '1px 4px', lineHeight: 1.4 }}>
                                  ×{existing.qty}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {!atCap && !searchLoading && searchQuery.length >= 2 && searchResults.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--muted)', fontSize: 12 }}>No results found</div>
                    )}

                    {!atCap && searchQuery.length < 2 && (
                      <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--muted)', fontSize: 12 }}>Type at least 2 characters to search</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="fg">
          <label>Notes (optional)</label>
          <textarea className="fi fi-sm" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Strategy, tech choices, matchup notes…" />
        </div>

        <div className="modal-actions">
          <button className="btn btn-yellow" onClick={save}>Save Deck</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          {deck && <button className="btn btn-red" style={{ marginLeft: 'auto' }} onClick={deleteDeck}>Delete</button>}
        </div>
      </div>
    </div>
  );
}

// Shared style for +/- control buttons
function ctrlBtn(disabled) {
  return {
    width: 22, height: 22, borderRadius: 4,
    border: '1px solid var(--card-border)', background: 'var(--darker)',
    color: disabled ? 'var(--muted)' : 'var(--text)',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? .45 : 1,
    fontSize: 16, lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 0, flexShrink: 0,
  };
}
