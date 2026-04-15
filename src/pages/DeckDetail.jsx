import { useState } from 'react';
import { useStore } from '../hooks/useStore';
import { useEnrich } from '../hooks/useEnrich';
import { cardKey, getSection, checkLegality } from '../utils/cards';
import CardRow from '../components/CardRow';
import DeckModal from '../components/DeckModal';
import CardInfoModal from '../components/CardInfoModal';
import { useToast } from '../components/Toast';

const SECTIONS = ['Pokemon', 'Trainer', 'Energy', 'Other'];
const FILTERS = ['all', 'missing', 'partial', 'owned', 'illegal'];

// Local helper — mirrors useStore getBlingArray without importing internals
function getBlingArr(deck, rc) {
  const stored = deck.blingSel?.[cardKey(rc)];
  const qty = rc.qty;
  if (!stored) return new Array(qty).fill(null);
  if (!Array.isArray(stored)) return new Array(qty).fill(stored);
  const arr = [...stored];
  while (arr.length < qty) arr.push(null);
  return arr.slice(0, qty);
}

// Build a formatted deck code string, grouping identical prints together
function generateDeckCode(deck) {
  const sections = { 'Pokémon': new Map(), 'Trainer': new Map(), 'Energy': new Map() };
  for (const rc of deck.rawCards) {
    const arr = getBlingArr(deck, rc);
    const sec = getSection(rc.name, deck.sectionMap, {});
    const secKey = sec === 'Pokemon' ? 'Pokémon' : sec === 'Energy' ? 'Energy' : 'Trainer';
    for (let i = 0; i < rc.qty; i++) {
      const b = arr[i];
      const setCode = b?.setCode || rc.setCode || '';
      const num = b?.number || rc.num || '';
      const lineKey = `${rc.name}||${setCode}||${num}`;
      sections[secKey].set(lineKey, (sections[secKey].get(lineKey) || 0) + 1);
    }
  }
  const lines = [];
  for (const [sec, map] of Object.entries(sections)) {
    if (!map.size) continue;
    const total = [...map.values()].reduce((s, v) => s + v, 0);
    lines.push(`${sec}: ${total}`);
    for (const [lineKey, qty] of map) {
      const [name, setCode, num] = lineKey.split('||');
      lines.push(`${qty} ${name}${setCode ? ` ${setCode} ${num}` : ''}`);
    }
    lines.push('');
  }
  lines.push(`Total Cards: ${deck.rawCards.reduce((s, rc) => s + rc.qty, 0)}`);
  return lines.join('\n').trim();
}

export default function DeckDetail({ deckId, onBack }) {
  const { state, dispatch, getApiData, getDeckOwned, deckPct, deckCost } = useStore();
  const apiCache = state.apiCache;
  const deck = state.decks.find(d => d.id === deckId);
  const toast = useToast();
  const [filter, setFilter] = useState('all');
  const [editOpen, setEditOpen] = useState(false);
  const [zoom, setZoom] = useState(null);
  const [view, setView] = useState('list'); // 'list' | 'gallery'
  const [codeOpen, setCodeOpen] = useState(false);

  useEnrich(deck);

  if (!deck) return null;

  const fmt = deck.format === 'Era' ? (deck.eraLabel || 'Retro') : (deck.format || 'Standard');

  // Stats
  let tot = 0, ownTot = 0, full = 0, part = 0, miss = 0;
  const issues = [];
  for (const rc of deck.rawCards) {
    const qty = rc.qty;
    const own = getDeckOwned(deck, rc);
    tot += qty; ownTot += own;
    if (own >= qty) full += qty;
    else if (own > 0) part += (qty - own);
    else miss += qty;
    const api = getApiData(rc);
    const leg = checkLegality(rc, deck, api, apiCache);
    if (!leg.legal) issues.push({ rc, reason: leg.reason });
  }
  const pct = tot > 0 ? Math.round((ownTot / tot) * 100) : 0;
  const totalCost = deckCost(deck);
  const needCost = deckCost(deck, true);

  // Group cards by section with filter applied
  const grouped = {};
  for (const rc of deck.rawCards) {
    const sec = getSection(rc.name, deck.sectionMap, {});
    const own = getDeckOwned(deck, rc);
    const qty = rc.qty;
    const api = getApiData(rc);
    const leg = checkLegality(rc, deck, api, apiCache);
    const pass =
      filter === 'all' ||
      (filter === 'missing' && own === 0) ||
      (filter === 'partial' && own > 0 && own < qty) ||
      (filter === 'owned' && own >= qty) ||
      (filter === 'illegal' && !leg.legal);
    if (!pass) continue;
    if (!grouped[sec]) grouped[sec] = [];
    grouped[sec].push(rc);
  }

  function addMissingToBuyList() {
    const missing = deck.rawCards.filter(rc => getDeckOwned(deck, rc) < rc.qty);
    if (!missing.length) { toast('No missing cards!', 'blue'); return; }
    const raw = missing.map(rc => `${rc.qty - getDeckOwned(deck, rc)} ${rc.name}${rc.setCode ? ' ' + rc.setCode + ' ' + rc.num : ''}`).join('\n');
    const n = state.decks.filter(d => d.isBuyList).length;
    dispatch({
      type: 'SAVE_DECK', deck: {
        id: Date.now(), name: n > 0 ? `Buy List ${n + 1}` : 'Buy List',
        format: 'Standard', eraLabel: '', notes: `From ${deck.name}`,
        rawCards: missing.map(rc => ({ ...rc, qty: rc.qty - getDeckOwned(deck, rc) })),
        raw, sectionMap: {}, ownedMap: {}, blingSel: {}, isBuyList: true,
      }
    });
    toast('Missing cards added to Buy List', 'green');
  }

  function openDeckImage() {
    // Collect unique print entries per section
    const secData = [];
    for (const sec of SECTIONS) {
      const secCards = deck.rawCards.filter(rc => getSection(rc.name, deck.sectionMap, {}) === sec);
      if (!secCards.length) continue;
      const entries = [];
      for (const rc of secCards) {
        const arr = getBlingArr(deck, rc);
        const api = getApiData(rc);
        const printCounts = new Map();
        for (let i = 0; i < rc.qty; i++) {
          const b = arr[i];
          const key = b?.id || 'default';
          if (printCounts.has(key)) printCounts.get(key).count++;
          else printCounts.set(key, { displayApi: b || api, count: 1, name: rc.name });
        }
        entries.push(...printCounts.values());
      }
      secData.push({
        sec,
        total: entries.reduce((s, e) => s + e.count, 0),
        entries: entries.map(e => ({ imageUrl: e.displayApi?.imageSmall || null, name: e.name, count: e.count })),
      });
    }

    // The new tab fetches each image as a blob (same-origin, no canvas taint),
    // waits for ALL of them, then draws to canvas and shows a single <img>.
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${deck.name.replace(/</g,'&lt;')}</title>
<style>body{margin:0;background:#1a1a2e;display:flex;flex-direction:column;align-items:center}
#msg{color:#aaa;font-family:system-ui;font-size:14px;padding:24px}img{max-width:100%;display:block}</style></head>
<body><div id="msg">Loading card images…</div><script>
const SD=${JSON.stringify(secData)};
const TITLE=${JSON.stringify(deck.name)};
const META=${JSON.stringify(`${tot} cards \u00b7 ${fmt}`)};
const COLS=8,CW=130,CH=182,GAP=8,PAD=20,BR=16,TH=56,SH=30;
let H=TH;
for(const s of SD)H+=SH+Math.ceil(s.entries.length/COLS)*(CH+GAP)+PAD;
const W=COLS*(CW+GAP)-GAP+PAD*2;

function draw(imgs){
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;
  const c=cv.getContext('2d');
  c.fillStyle='#1a1a2e';c.fillRect(0,0,W,H);
  c.fillStyle='#ffcc00';c.font='bold 24px system-ui';c.fillText(TITLE,PAD,PAD+28);
  c.fillStyle='#888';c.font='14px system-ui';c.fillText(META,PAD,PAD+50);
  let y=TH;
  for(const {sec,entries,total} of SD){
    c.fillStyle='#aaa';c.font='bold 13px system-ui';
    c.fillText(sec.toUpperCase()+' ('+total+')',PAD,y+20);
    y+=SH;let col=0;
    for(const {imageUrl,count,name} of entries){
      const x=PAD+col*(CW+GAP);
      c.save();c.beginPath();const r=8;
      c.moveTo(x+r,y);c.lineTo(x+CW-r,y);c.quadraticCurveTo(x+CW,y,x+CW,y+r);
      c.lineTo(x+CW,y+CH-r);c.quadraticCurveTo(x+CW,y+CH,x+CW-r,y+CH);
      c.lineTo(x+r,y+CH);c.quadraticCurveTo(x,y+CH,x,y+CH-r);
      c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();c.clip();
      if(imageUrl&&imgs[imageUrl])c.drawImage(imgs[imageUrl],x,y,CW,CH);
      else{c.fillStyle='#2a2a40';c.fill();}
      c.restore();
      const bx=x+CW-BR-4,by=y+CH-BR-4;
      c.fillStyle='#e3350d';c.beginPath();c.arc(bx,by,BR,0,Math.PI*2);c.fill();
      c.fillStyle='#fff';c.font='bold '+(count>=10?12:14)+'px system-ui';
      c.textAlign='center';c.textBaseline='middle';c.fillText(count,bx,by+1);
      c.textAlign='left';c.textBaseline='alphabetic';
      col++;if(col>=COLS){col=0;y+=CH+GAP;}
    }
    if(col>0)y+=CH+GAP;y+=PAD;
  }
  document.getElementById('msg').remove();
  const el=document.createElement('img');
  el.src=cv.toDataURL('image/png');
  document.body.appendChild(el);
}

(async()=>{
  const urls=[...new Set(SD.flatMap(s=>s.entries.map(e=>e.imageUrl)).filter(Boolean))];
  const imgs={};
  const msg=document.getElementById('msg');
  let loaded=0;
  await Promise.all(urls.map(async url=>{
    try{
      const res=await fetch(url,{cache:'no-store'});
      const blob=await res.blob();
      const blobUrl=URL.createObjectURL(blob);
      await new Promise(resolve=>{
        const img=new Image();
        img.onload=()=>{imgs[url]=img;URL.revokeObjectURL(blobUrl);resolve();};
        img.onerror=()=>{URL.revokeObjectURL(blobUrl);resolve();};
        img.src=blobUrl;
      });
    }catch{/* skip failed images */}
    msg.textContent='Loading card images… '+(++loaded)+'/'+urls.length;
  }));
  draw(imgs);
})();
</script></body></html>`;

    const tab = window.open('', '_blank');
    tab.document.write(html);
    tab.document.close();
  }

  const deckCode = codeOpen ? generateDeckCode(deck) : '';

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 26, fontWeight: 800, letterSpacing: .4, color: 'var(--yellow)' }}>{deck.name}</span>
            <span className={`fmt-badge fmt-${deck.format || 'Standard'}`}>{fmt}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditOpen(true)}>Edit</button>
          </div>
          {deck.notes && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{deck.notes}</div>}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', border: '1px solid var(--card-border)', borderRadius: 8, overflow: 'hidden' }}>
            <button
              onClick={() => setView('list')}
              style={{ padding: '5px 10px', fontSize: 12, border: 'none', cursor: 'pointer', background: view === 'list' ? 'var(--yellow)' : 'transparent', color: view === 'list' ? 'var(--dark)' : 'var(--muted)', fontWeight: 700 }}
              title="List view"
            >☰ List</button>
            <button
              onClick={() => setView('gallery')}
              style={{ padding: '5px 10px', fontSize: 12, border: 'none', cursor: 'pointer', background: view === 'gallery' ? 'var(--yellow)' : 'transparent', color: view === 'gallery' ? 'var(--dark)' : 'var(--muted)', fontWeight: 700 }}
              title="Gallery view"
            >⊞ Gallery</button>
          </div>
          {/* Export buttons */}
          <button className="btn btn-ghost btn-sm" onClick={() => setCodeOpen(true)} title="Export deck code">{'</>'} Code</button>
          <button className="btn btn-ghost btn-sm" onClick={openDeckImage}>Image</button>
          <button className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: 'MARK_DECK_OWNED', deckId: deck.id, own: true })}>Own All</button>
          <button className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: 'MARK_DECK_OWNED', deckId: deck.id, own: false })}>Clear</button>
          <button className="btn btn-ghost btn-sm" onClick={addMissingToBuyList}>Missing → Buy List</button>
        </div>
      </div>

      {/* Legality banner */}
      {issues.length > 0 && (
        <div style={{ padding: '10px 14px', background: 'rgba(227,53,13,.08)', border: '1px solid rgba(227,53,13,.3)', borderRadius: 9, fontSize: 12, marginBottom: 12 }}>
          <div
            onClick={() => setFilter(filter === 'illegal' ? 'all' : 'illegal')}
            style={{ color: '#ff6b4a', fontWeight: 700, cursor: 'pointer', marginBottom: 6 }}
          >
            {issues.reduce((s, { rc }) => s + rc.qty, 0)} card{issues.reduce((s, { rc }) => s + rc.qty, 0) !== 1 ? 's' : ''} may be illegal in {fmt} — click to {filter === 'illegal' ? 'clear filter' : 'filter'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
            {issues.map(({ rc, reason }, i) => (
              <span key={i} style={{ color: 'var(--muted)', fontSize: 11 }}>
                <span style={{ color: '#ff6b4a', fontWeight: 600 }}>{rc.name}</span>
                {rc.setCode && <span> {rc.setCode} {rc.num}</span>}
                <span style={{ color: 'rgba(255,107,74,.6)' }}> — {reason}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          [null, `${deck.rawCards.length} unique · ${tot} total`, 'var(--pill)', 'var(--text)'],
          [null, `${full} complete`, 'rgba(74,222,128,.15)', 'var(--green)'],
          [null, `${part} partial`, 'rgba(251,146,60,.15)', 'var(--orange)'],
          [null, `${miss} missing`, 'rgba(227,53,13,.15)', '#ff6b4a'],
          ...(totalCost > 0 ? [[null, `$${totalCost.toFixed(2)} total`, 'rgba(74,222,128,.1)', 'var(--green)']] : []),
          ...(needCost > 0 ? [[null, `$${needCost.toFixed(2)} to complete`, 'rgba(251,146,60,.1)', 'var(--orange)']] : []),
        ].map(([icon, label, bg, color], i) => (
          <div key={i} style={{ padding: '7px 14px', borderRadius: 20, fontWeight: 800, fontSize: 12, background: bg, color, display: 'flex', alignItems: 'center', gap: 5 }}>
            {label}
          </div>
        ))}
        <div style={{ marginLeft: 'auto', padding: '7px 14px', borderRadius: 20, fontWeight: 800, fontSize: 12, background: 'var(--pill)', color: 'var(--text)' }}>
          {pct}% ready
        </div>
      </div>

      {/* Progress */}
      <div className="prog-track" style={{ marginBottom: 16 }}>
        <div className="prog-fill" style={{ width: `${pct}%` }} />
      </div>

      {/* Filters (list view only) */}
      {view === 'list' && (
        <div style={{ display: 'flex', gap: 7, marginBottom: 14, flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button key={f} className={`chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}
              style={f === 'illegal' ? { borderColor: filter === f ? '#ff6b4a' : 'rgba(227,53,13,.3)', color: filter === f ? '#ff6b4a' : 'rgba(227,53,13,.6)' } : {}}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {view === 'list' && (
        <>
          {SECTIONS.map(sec => {
            if (!grouped[sec]?.length) return null;
            return (
              <div key={sec}>
                <div className="sec-hdr" style={{ marginBottom: 8 }}>
                  <span className="sec-hdr-title">{sec}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{grouped[sec].length} cards</span>
                </div>
                {grouped[sec].flatMap(rc => {
                  const blingArr = getBlingArr(deck, rc);
                  const api = getApiData(rc);
                  // Group copies by their specific print
                  // Use api?.id as fallback so unassigned copies group with their default print
                  const groups = new Map(); // key -> { api, firstCopyIndex, qty, hasExplicitBling }
                  for (let i = 0; i < rc.qty; i++) {
                    const b = blingArr[i];
                    const key = `${b?.id ?? api?.id ?? 'default'}||${b?.variant ?? ''}`;
                    if (!groups.has(key)) groups.set(key, { api: b || api, firstCopyIndex: i, qty: 0, hasExplicitBling: false });
                    const g = groups.get(key);
                    g.qty++;
                    // Only flag as alternate print if it differs from what's listed in the deck
                    if (b != null && (b.number !== rc.num || b.setCode !== rc.setCode)) g.hasExplicitBling = true;
                  }
                  return [...groups.values()].map((group, gi) => (
                    <CardRow key={`${cardKey(rc)}-g${gi}`} deck={deck} rc={rc} onZoom={setZoom} printGroup={groups.size === 1 ? undefined : group} />
                  ));
                })}
              </div>
            );
          })}
          {Object.keys(grouped).length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>🎉 No cards match this filter!</div>
          )}
        </>
      )}

      {/* ── GALLERY VIEW ── */}
      {view === 'gallery' && (
        <>
          {SECTIONS.map(sec => {
            const secCards = deck.rawCards.filter(rc => getSection(rc.name, deck.sectionMap, {}) === sec);
            if (!secCards.length) return null;
            const copies = secCards.flatMap(rc => {
              const arr = getBlingArr(deck, rc);
              const api = getApiData(rc);
              return Array.from({ length: rc.qty }, (_, i) => ({
                rc, api, bling: arr[i], copyIdx: i,
              }));
            });
            return (
              <div key={sec} style={{ marginBottom: 24 }}>
                <div className="sec-hdr" style={{ marginBottom: 10 }}>
                  <span className="sec-hdr-title">{sec}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{copies.length} cards</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {copies.map(({ rc, api, bling, copyIdx }, i) => {
                    const displayApi = bling || api;
                    const img = displayApi?.imageLarge || displayApi?.imageSmall;
                    const owned = getDeckOwned(deck, rc);
                    const thisOwned = owned > copyIdx;
                    return (
                      <div
                        key={`${cardKey(rc)}-${copyIdx}-${i}`}
                        onClick={() => displayApi && setZoom(displayApi)}
                        title={`${rc.name}${displayApi?.setName ? ` · ${displayApi.setName} #${displayApi.number}` : ''}`}
                        style={{
                          cursor: img ? 'pointer' : 'default', position: 'relative',
                          opacity: thisOwned ? 1 : 0.45,
                          transition: 'opacity .15s, transform .15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        {displayApi?.imageSmall
                          ? <img src={displayApi.imageSmall} alt={rc.name} style={{ width: 100, borderRadius: 7, display: 'block', border: `2px solid ${bling ? 'var(--yellow)' : 'var(--card-border)'}` }} />
                          : <div style={{ width: 100, height: 140, borderRadius: 7, background: 'var(--pill)', border: '2px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--muted)', padding: 4, textAlign: 'center' }}>{rc.name}</div>
                        }
                        {!thisOwned && (
                          <div style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,.7)', borderRadius: 4, fontSize: 10, padding: '1px 4px', color: '#fff' }}>✗</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>
      )}

      {editOpen && <DeckModal deck={deck} onClose={() => setEditOpen(false)} onSaved={() => {}} />}

      {zoom && <CardInfoModal card={zoom} onClose={() => setZoom(null)} />}

      {/* Deck code modal */}
      {codeOpen && (
        <div className="modal-overlay" onClick={() => setCodeOpen(false)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <h3>Deck Code — {deck.name}</h3>
            <p className="modal-hint">Copy this into PTCGL, Limitless, or any deck builder. Prints reflect your current selections.</p>
            <textarea
              readOnly
              value={deckCode}
              style={{ width: '100%', height: 320, fontFamily: 'monospace', fontSize: 12, resize: 'vertical', background: 'var(--pill)', border: '1px solid var(--card-border)', borderRadius: 8, padding: 10, color: 'var(--text)', boxSizing: 'border-box' }}
              onFocus={e => e.target.select()}
            />
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setCodeOpen(false)}>Close</button>
              <button className="btn btn-yellow" onClick={() => { navigator.clipboard.writeText(deckCode); toast('Copied!', 'green'); }}>Copy</button>
              <button className="btn btn-ghost" onClick={() => {
                const blob = new Blob([deckCode], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `${deck.name.replace(/[^a-z0-9]/gi, '_')}.txt`; a.click();
                URL.revokeObjectURL(url);
              }}>Download .txt</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
