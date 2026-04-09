import { useState } from 'react';
import { useStore } from '../hooks/useStore';
import { parseRawLines, buildSectionMap, cardKey } from '../utils/cards';
import { useToast } from './Toast';
import { ERA_FORMATS, ERA_GROUPS } from '../data/eras';

const FORMATS = ['Standard', 'Expanded', 'GLC', 'Era', 'Custom'];
const FORMAT_LABELS = { Era: 'Retro' };

export default function DeckModal({ deck, onClose, onSaved }) {
  const { dispatch } = useStore();
  const toast = useToast();

  const [name, setName] = useState(deck?.name || '');
  const [format, setFormat] = useState(deck?.format || 'Standard');
  const [eraCode, setEraCode] = useState(deck?.format === 'Era' ? (deck?.eraLabel || '') : '');
  const [notes, setNotes] = useState(deck?.notes || '');
  const [deckList, setDeckList] = useState(deck?.raw || '');

  const selectedEra = ERA_FORMATS.find(f => f.code === eraCode);

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
    toast(`${finalName} saved!`, 'green');
    onSaved?.();
    onClose();
  }

  function deleteDeck() {
    if (!confirm(`Delete "${deck?.name}"? This cannot be undone.`)) return;
    dispatch({ type: 'DELETE_DECK', id: deck.id });
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
        <h3>{deck ? 'Edit Deck' : 'New Deck'}</h3>

        <div className="fg">
          <label>Deck Name</label>
          <input className="fi" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Charizard ex OBF" />
        </div>

        <div className="fg">
          <label>Format</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: format === 'Era' ? 10 : 0 }}>
            {FORMATS.map(f => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                style={{
                  padding: '7px 14px',
                  border: `2px solid ${format === f ? `var(--${f === 'Standard' ? 'std' : f === 'Expanded' ? 'exp' : f === 'GLC' ? 'glc' : f === 'Era' ? 'era' : 'cst'})` : 'var(--card-border)'}`,
                  borderRadius: 8,
                  background: format === f ? `rgba(${f==='Standard'?'108,142,191':f==='Expanded'?'155,89,182':f==='GLC'?'230,126,34':f==='Era'?'196,123,222':'120,120,160'},.12)` : 'transparent',
                  color: format === f ? `var(--${f === 'Standard' ? 'std' : f === 'Expanded' ? 'exp' : f === 'GLC' ? 'glc' : f === 'Era' ? 'era' : 'cst'})` : 'var(--muted)',
                  fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all .15s',
                }}
              >{FORMAT_LABELS[f] || f}</button>
            ))}
          </div>

          {format === 'Era' && (
            <div style={{ marginTop: 8, padding: '14px', background: 'var(--darker)', border: '1px solid var(--card-border)', borderRadius: 10 }}>
              <div style={{ position: 'relative' }}>
                <select
                  className="fi"
                  value={eraCode}
                  onChange={e => setEraCode(e.target.value)}
                  style={{ width: '100%', padding: '8px 36px 8px 12px', marginBottom: selectedEra ? 10 : 0, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' }}
                >
                  <option value="">— Select a format window —</option>
                  {Object.entries(ERA_GROUPS).map(([group, formats]) => (
                    <optgroup key={group} label={group}>
                      {formats.map(f => (
                        <option key={f.code} value={f.code}>{f.label}</option>
                      ))}
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

        <div className="fg">
          <label>Deck List</label>
          <textarea className="fi" value={deckList} onChange={e => setDeckList(e.target.value)}
            placeholder={"Pokemon: 18\n4 Charizard ex OBF 125\n...\nTrainer: 26\n4 Ultra Ball SVI 196\n...\nEnergy: 6\n6 Fire Energy SVE 2"} />
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
