import { useState } from 'react';
import { StoreProvider } from './hooks/useStore';
import { ToastProvider } from './components/Toast';
import { useEnrich } from './hooks/useEnrich';
import Library from './pages/Library';
import DeckDetail from './pages/DeckDetail';
import Collection from './pages/Collection';
import BuyList from './pages/BuyList';
import DeckBuilder from './pages/DeckBuilder';
import SaveRestoreModal from './components/SaveRestoreModal';
import './index.css';

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </StoreProvider>
  );
}

function AppInner() {
  useEnrich(null); // enrich all decks on mount so images load everywhere
  const [navPage, setNavPage] = useState('Decks');
  const [detailDeckId, setDetailDeckId] = useState(null);
  const [libraryEntered, setLibraryEntered] = useState(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);

  function openDeck(id) { setDetailDeckId(id); setNavPage('Decks'); }
  function closeDetail() { setDetailDeckId(null); }

  const showDetail = navPage === 'Decks' && detailDeckId !== null;

  return (
    <>
      <header style={{ background:'var(--dark)',borderBottom:'3px solid var(--yellow)',padding:'12px 20px',display:'flex',alignItems:'center',gap:12,boxShadow:'0 4px 24px rgba(0,0,0,.5)',position:'sticky',top:0,zIndex:100,flexWrap:'wrap' }}>
        <div className="pokeball" />
        <h1 style={{ fontFamily:"'Barlow Condensed',sans-serif",fontSize:26,fontWeight:800,letterSpacing:1,color:'var(--yellow)' }}>TCG Companion</h1>
        <nav style={{ display:'flex',gap:4,marginLeft:'auto' }}>
          {['Decks','Collection','Buy List'].map(n => (
            <button key={n} onClick={() => { setNavPage(n); setDetailDeckId(null); setBuilderOpen(false); if (n !== 'Decks') setLibraryEntered(null); }}
              style={{ padding:'7px 14px',border:'none',borderRadius:8,fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:12,cursor:'pointer',transition:'all .2s',background:navPage===n&&!builderOpen?'var(--yellow)':'transparent',color:navPage===n&&!builderOpen?'var(--dark)':'var(--muted)' }}>
              {n}
            </button>
          ))}
          <a href="https://limitlesstcg.com/tournaments" target="_blank" rel="noopener noreferrer"
            style={{ padding:'7px 14px',border:'none',borderRadius:8,fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:12,cursor:'pointer',color:'var(--muted)',textDecoration:'none',display:'flex',alignItems:'center' }}>
            Tournaments
          </a>
        </nav>
        <button className="btn btn-ghost btn-sm" onClick={() => { setBuilderOpen(true); setDetailDeckId(null); }}
          style={{ borderColor:builderOpen?'var(--yellow)':undefined,color:builderOpen?'var(--yellow)':undefined }}>
          Builder
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setSaveOpen(true)}>Save</button>
      </header>
      <main>
        {builderOpen && <DeckBuilder onBack={() => setBuilderOpen(false)} />}
        {!builderOpen && navPage==='Decks' && !showDetail && <Library onOpenDeck={openDeck} entered={libraryEntered} onEnteredChange={setLibraryEntered} />}
        {!builderOpen && showDetail && <DeckDetail deckId={detailDeckId} onBack={closeDetail} />}
        {!builderOpen && navPage==='Collection' && <Collection onOpenDeck={openDeck} />}
        {!builderOpen && navPage==='Buy List' && <BuyList />}
      </main>
      {saveOpen && <SaveRestoreModal onClose={() => setSaveOpen(false)} />}
    </>
  );
}
