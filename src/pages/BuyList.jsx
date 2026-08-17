import { useState, useMemo } from 'react';
import { useStore } from '../hooks/useStore';
import { cardKey } from '../utils/cards';
import { parseRawLines } from '../utils/cards';
import { useToast } from '../components/Toast';

export default function BuyList() {
  const { state, dispatch, getApiData, getDeckOwned } = useStore();
  const [importOpen, setImportOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [consolidated, setConsolidated] = useState(false);
  const [expanded, setExpanded] = useState(new Set());
  const toast = useToast();

  const byDeck = useMemo(() => {
    const map = {};
    for (const deck of state.decks) {
      for (const rc of deck.rawCards) {
        const need = Math.max(0, rc.qty - getDeckOwned(deck, rc));
        if (need <= 0) continue;
        if (!map[deck.id]) map[deck.id] = { deck, items: [] };
        map[deck.id].items.push({ rc, need });
      }
    }
    return Object.values(map);
  }, [state, getDeckOwned]);

  // Consolidated view: group by card name, then collect per-print breakdown
  const byCard = useMemo(() => {
    const map = {};
    for (const { deck, items } of byDeck) {
      for (const { rc, need } of items) {
        const name = rc.name;
        if (!map[name]) map[name] = { name, totalNeed: 0, prints: {} };
        map[name].totalNeed += need;
        const pk = cardKey(rc);
        if (!map[name].prints[pk]) map[name].prints[pk] = { rc, need: 0, decks: [] };
        map[name].prints[pk].need += need;
        if (!map[name].prints[pk].decks.includes(deck.name))
          map[name].prints[pk].decks.push(deck.name);
      }
    }
    return Object.values(map)
      .map(e => ({ ...e, prints: Object.values(e.prints) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [byDeck]);

  const totalItems = consolidated
    ? byCard.length
    : byDeck.reduce((s, d) => s + d.items.length, 0);
  const totalCost = consolidated
    ? byCard.reduce((s, { prints }) =>
        s + prints.reduce((ss, { rc, need }) => {
          const api = getApiData(rc);
          return ss + (api?.marketPrice ? api.marketPrice * need : 0);
        }, 0), 0)
    : byDeck.reduce((s, { items }) =>
        s + items.reduce((ss, { rc, need }) => {
          const api = getApiData(rc);
          return ss + (api?.marketPrice ? api.marketPrice * need : 0);
        }, 0), 0
      );

  function buildText() {
    const lines = ['# TCG Companion Buy List', `# ${new Date().toLocaleDateString()}`, ''];
    if (consolidated) {
      for (const { name, totalNeed } of byCard) {
        lines.push(`${totalNeed} ${name}`);
      }
    } else {
      for (const { deck, items } of byDeck) {
        lines.push(`# ${deck.name}`);
        for (const { rc, need } of items) {
          lines.push(`${need} ${rc.name}${rc.setCode ? ' ' + rc.setCode + ' ' + rc.num : ''}`);
        }
        lines.push('');
      }
    }
    return lines.join('\n');
  }

  function copyList() {
    navigator.clipboard.writeText(buildText()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function downloadList() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buildText()], { type: 'text/plain' }));
    a.download = 'buy-list.txt';
    a.click();
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 24, fontWeight: 800, letterSpacing: .4, color: 'var(--yellow)' }}>Buy List</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {totalCost > 0 && (
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--orange)' }}>
              ~${totalCost.toFixed(2)} total
            </span>
          )}
          <button
            className={`btn btn-sm ${consolidated ? 'btn-yellow' : 'btn-ghost'}`}
            onClick={() => setConsolidated(v => !v)}
            title="Merge the same card across multiple decks into one entry"
          >Consolidate</button>
          <button className="btn btn-yellow btn-sm" onClick={copyList}>{copied ? 'Copied!' : 'Copy'}</button>
          <button className="btn btn-ghost btn-sm" onClick={downloadList}>Download</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setImportOpen(true)}>Import Buy List</button>
        </div>
      </div>

      {byDeck.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 56, color: 'var(--muted)' }}>
          <p style={{ fontSize: 14 }}>You own everything across all your decks.</p>
        </div>
      ) : consolidated ? (
        // ── Consolidated view ──────────────────────────────────────────────────
        byCard.map(({ name, totalNeed, prints }) => {
          const firstApi = getApiData(prints[0].rc);
          const isOpen = expanded.has(name);
          const multiPrint = prints.length > 1;
          const totalPrice = prints.reduce((s, { rc, need }) => {
            const api = getApiData(rc);
            return s + (api?.marketPrice ? api.marketPrice * need : 0);
          }, 0);
          const allDecks = [...new Set(prints.flatMap(p => p.decks))];
          return (
            <div key={name} style={{ marginBottom: 4 }}>
              {/* Parent row */}
              <div
                onClick={multiPrint ? () => setExpanded(prev => { const s = new Set(prev); s.has(name) ? s.delete(name) : s.add(name); return s; }) : undefined}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', borderRadius: isOpen ? '8px 8px 0 0' : 8, background: 'var(--darker)', gap: 12, cursor: multiPrint ? 'pointer' : 'default' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {firstApi?.imageSmall && (
                    <img src={firstApi.imageSmall} alt="" style={{ width: 32, height: 44, objectFit: 'cover', borderRadius: 3 }} />
                  )}
                  <div>
                    <span style={{ fontWeight: 800 }}>{name}</span>
                    {!multiPrint && prints[0].rc.setCode && (
                      <span style={{ color: 'var(--muted)', fontSize: 11, marginLeft: 8 }}>
                        {firstApi?.setName || prints[0].rc.setCode} · {prints[0].rc.num}
                      </span>
                    )}
                    {multiPrint && (
                      <span style={{ color: 'var(--muted)', fontSize: 11, marginLeft: 8 }}>{prints.length} prints</span>
                    )}
                    <div style={{ color: 'var(--muted)', fontSize: 10, marginTop: 2 }}>{allDecks.join(' · ')}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {totalPrice > 0 && <span style={{ fontSize: 12, color: 'var(--orange)', fontWeight: 800 }}>${totalPrice.toFixed(2)}</span>}
                  <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: 11, fontWeight: 700, background: 'var(--red)', color: '#fff', padding: '2px 7px', borderRadius: 4 }}>Need ×{totalNeed}</span>
                  {multiPrint && <span style={{ color: 'var(--muted)', fontSize: 12 }}>{isOpen ? '▲' : '▼'}</span>}
                </div>
              </div>
              {/* Expanded prints */}
              {multiPrint && isOpen && (
                <div style={{ borderRadius: '0 0 8px 8px', overflow: 'hidden', border: '1px solid var(--card-border)', borderTop: 'none' }}>
                  {prints.map(({ rc, need, decks }) => {
                    const api = getApiData(rc);
                    const price = api?.marketPrice;
                    return (
                      <div key={cardKey(rc)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 12px 7px 54px', background: 'var(--card-bg)', gap: 12, borderTop: '1px solid var(--card-border)' }}>
                        <div>
                          <span style={{ color: 'var(--fg)', fontSize: 13 }}>{api?.setName || rc.setCode}</span>
                          {rc.num && <span style={{ color: 'var(--muted)', fontSize: 11, marginLeft: 6 }}>· {rc.num}</span>}
                          {price && <span style={{ color: 'var(--muted)', fontSize: 11, marginLeft: 6 }}>${price.toFixed(2)} each</span>}
                          <span style={{ color: 'var(--muted)', fontSize: 10, marginLeft: 8 }}>{decks.join(' · ')}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {price && <span style={{ fontSize: 12, color: 'var(--orange)', fontWeight: 800 }}>${(price * need).toFixed(2)}</span>}
                          <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: 11, fontWeight: 700, background: 'var(--red)', color: '#fff', padding: '2px 7px', borderRadius: 4 }}>×{need}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      ) : (
        // ── Per-deck view ──────────────────────────────────────────────────────
        byDeck.map(({ deck, items }) => {
          const deckCost = items.reduce((s, { rc, need }) => {
            const api = getApiData(rc);
            return s + (api?.marketPrice ? api.marketPrice * need : 0);
          }, 0);
          return (
            <div key={deck.id}>
              <div className="sec-div">
                <div className="lbl">{deck.name}</div>
                <div className="line" />
                {deckCost > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--orange)', fontWeight: 800, whiteSpace: 'nowrap' }}>
                    ~${deckCost.toFixed(2)}
                  </span>
                )}
              </div>
              {items.map(({ rc, need }) => {
                const api = getApiData(rc);
                const price = api?.marketPrice;
                return (
                  <div key={cardKey(rc) + deck.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', borderRadius: 8, marginBottom: 4, background: 'var(--darker)', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {api?.imageSmall && (
                        <img src={api.imageSmall} alt="" style={{ width: 32, height: 44, objectFit: 'cover', borderRadius: 3 }} />
                      )}
                      <div>
                        <span style={{ fontWeight: 800 }}>{rc.name}</span>
                        {rc.setCode && <span style={{ color: 'var(--muted)', fontSize: 11, marginLeft: 8 }}>{api?.setName || rc.setCode} · {rc.num}</span>}
                        {price && <span style={{ color: 'var(--muted)', fontSize: 11, marginLeft: 8 }}>${price.toFixed(2)} each</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {price && <span style={{ fontSize: 12, color: 'var(--orange)', fontWeight: 800 }}>${(price * need).toFixed(2)}</span>}
                      <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: 11, fontWeight: 700, background: 'var(--red)', color: '#fff', padding: '2px 7px', borderRadius: 4 }}>Need ×{need}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })
      )}

      {/* Export text area */}
      {byDeck.length > 0 && (
        <textarea
          readOnly value={buildText()}
          style={{ width: '100%', height: 160, marginTop: 16, background: 'var(--darker)', color: 'var(--green)', border: '1px solid var(--card-border)', borderRadius: 9, padding: 12, fontFamily: "'Courier New'", fontSize: 11, resize: 'vertical', outline: 'none' }}
        />
      )}

      {importOpen && <ImportBuyListModal onClose={() => setImportOpen(false)} toast={toast} dispatch={dispatch} state={state} />}
    </div>
  );
}

function ImportBuyListModal({ onClose, toast, dispatch, state }) {
  const [raw, setRaw] = useState('');
  function load() {
    const stripped = raw.split('\n').filter(l => !l.trim().startsWith('#')).join('\n');
    const parsed = parseRawLines(stripped);
    if (!parsed.length) { toast('Could not parse any cards', 'red'); return; }
    const n = state.decks.filter(d => d.isBuyList).length;
    const name = n > 0 ? `Buy List ${n + 1}` : 'Buy List';
    const { buildSectionMap } = require('../utils/cards');
    dispatch({
      type: 'SAVE_DECK', deck: {
        id: Date.now(), name, format: 'Standard', eraLabel: '', notes: '',
        rawCards: parsed, raw: stripped, sectionMap: buildSectionMap(stripped),
        ownedMap: {}, blingSel: {}, isBuyList: true,
      }
    });
    toast(`${name} loaded — ${parsed.length} card types`, 'blue');
    onClose();
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Import Buy List</h3>
        <p className="modal-hint">Paste a previously exported buy list. Loaded as a separate deck group to track what you need to pick up.</p>
        <textarea className="fi" value={raw} onChange={e => setRaw(e.target.value)}
          placeholder={"4 Charizard ex OBF 125\n2 Boss's Orders PAL 172\n# Lines starting with # are ignored"} />
        <div className="modal-actions">
          <button className="btn btn-yellow" onClick={load}>⚡ Load</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
