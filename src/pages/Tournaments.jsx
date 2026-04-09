import { useState, useEffect, useMemo } from 'react';
import { useStore } from '../hooks/useStore';
import { useToast } from '../components/Toast';
import { cardKey } from '../utils/cards';
import { lookupCard } from '../utils/api';

function collQty(val) {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  return Object.values(val).reduce((s, v) => s + (v || 0), 0);
}

const STATUS_COLORS = {
  green:  '#4ade80',
  orange: '#fb923c',
  blue:   '#60a5fa',
  purple: '#c084fc',
  yellow: '#facc15',
  red:    '#ef4444',
};

const STATUS_LABELS = {
  green:  'Own all · free',
  orange: 'Own some · free',
  blue:   'Own all · in decks',
  purple: 'Own all · mixed',
  yellow: 'Own some · mixed',
  red:    'Don\'t own',
};

function getStatus(needed, standalone, inDecks) {
  const total = standalone + inDecks;
  if (total === 0) return 'red';
  if (standalone >= needed) return 'green';
  if (total >= needed) {
    if (standalone === 0) return 'blue';
    return 'purple';
  }
  if (inDecks === 0) return 'orange';
  return 'yellow';
}

const LIMITLESS = 'https://play.limitlesstcg.com/api';
// Proxied through Vite dev server to avoid CORS
const LABS = '/mew/labs/data/tcg';

const FORMAT_FILTERS = ['STANDARD', 'EXPANDED', 'ALL'];

const EVENT_TYPE_LABELS = {
  'regional': 'Regional',
  'internationals': 'International',
  'worlds': 'Worlds',
  'special': 'Special Event',
  'challenge': 'Challenge',
  'league_cup': 'League Cup',
  'league_challenge': 'League Challenge',
};

const LABS_TYPE_FILTERS = ['ALL', 'regional', 'internationals', 'worlds', 'special'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(val) {
  if (!val) return '';
  // Labs returns human-readable strings like "September 13–15, 2024" — pass through
  if (typeof val === 'string' && !/^\d{4}-/.test(val)) return val;
  const d = new Date(val);
  if (isNaN(d)) return val;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtRecord(r) {
  if (!r) return '';
  return `${r.wins}-${r.losses}${r.ties ? `-${r.ties}` : ''}`;
}

function ordinal(n) {
  const s = ['th','st','nd','rd'], v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
}

// Parse a Limitless decklist into flat array of { name, setCode, num, qty, section }
function parseLimitlessDecklist(decklist) {
  if (!decklist) return [];
  const cards = [];
  // Format A: { pokemon: [...], trainer: [...], energy: [...] }
  if (decklist.pokemon || decklist.trainer || decklist.energy) {
    const sectionMap = { pokemon: 'Pokémon', trainer: 'Trainer', energy: 'Energy' };
    for (const [key, section] of Object.entries(sectionMap)) {
      for (const c of (decklist[key] || [])) {
        cards.push({ name: c.name, setCode: c.set || '', num: String(c.number || c.num || ''), qty: c.count || c.qty || 1, section });
      }
    }
    return cards;
  }
  // Format B: flat array
  if (Array.isArray(decklist)) {
    for (const c of decklist) {
      const section = c.supertype === 'Pokémon' ? 'Pokémon' : c.supertype === 'Energy' ? 'Energy' : 'Trainer';
      cards.push({ name: c.name, setCode: c.set || '', num: String(c.number || c.num || ''), qty: c.count || c.qty || 1, section });
    }
    return cards;
  }
  return [];
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Tournaments({ onOpenDeck }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [source, setSource] = useState('official'); // 'official' | 'community'
  const [view, setView] = useState('list'); // 'list' | 'standings'
  const [formatFilter, setFormatFilter] = useState('STANDARD');
  const [venueFilter, setVenueFilter] = useState('ALL'); // 'ALL' | 'IRL' | 'ONLINE'
  const [tournaments, setTournaments] = useState([]);
  const [detailsMap, setDetailsMap] = useState({}); // id -> details (has isOnline)
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  // Labs (official) state
  const [labsTournaments, setLabsTournaments] = useState([]);
  const [labsLoading, setLabsLoading] = useState(false);
  const [labsError, setLabsError] = useState(null);
  const [selected, setSelected] = useState(null);   // { id, name, format, ... }
  const [details, setDetails] = useState(null);     // tournament details
  const [standings, setStandings] = useState([]);
  const [decklistPlayer, setDecklistPlayer] = useState(null); // player entry with decklist

  useEffect(() => {
    if (source !== 'community') return;
    setTournaments([]);
    setDetailsMap({});
    setPage(1);
    setHasMore(true);
    load(1, true);
  }, [formatFilter, source]);

  useEffect(() => {
    if (source !== 'official') return;
    if (labsTournaments.length > 0) return; // already loaded
    loadLabsTournaments();
  }, [source]);

  async function loadLabsTournaments() {
    setLabsLoading(true);
    setLabsError(null);
    try {
      const res = await fetch(`${LABS}/tournaments`);
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      const list = data.message || data;
      setLabsTournaments(Array.isArray(list) ? list.reverse() : []); // newest first
    } catch (e) {
      setLabsError('Could not load official tournaments. Make sure the app is running via `npm run dev` (the proxy only works in dev mode).');
    }
    setLabsLoading(false);
  }

  async function openLabsTournament(t) {
    setLoading(true);
    try {
      const [detRes, standRes] = await Promise.all([
        fetch(`${LABS}/tournament?id=${t.id}&division=MA`),
        fetch(`${LABS}/standings?tournamentId=${t.id}&division=MA`),
      ]);
      const det = await detRes.json();
      const stand = await standRes.json();
      const detData = det.message || det;
      const standData = stand.message || stand;
      const eventLabel = EVENT_TYPE_LABELS[detData.type] || detData.type || '';
      const eventName = `${eventLabel} — ${detData.city || ''}${detData.country ? ', ' + detData.country : ''}`;
      setDetails({ ...detData, name: eventName, decklists: !!detData.decklists, isLabs: true, labsId: t.id });
      setStandings(Array.isArray(standData) ? standData.map(p => ({
        player: String(p.player_id),
        tpId: p.tp_id,
        name: p.name,
        country: p.country,
        placing: p.placement,
        record: { wins: p.wins, losses: p.losses, ties: p.ties },
        deck: { name: p.deck_name, icons: typeof p.icons === 'string' ? p.icons.split(' ').filter(Boolean) : (p.icons || []) },
        hasDecklist: !!p.decklist,
      })) : []);
      setSelected(t);
      setView('standings');
    } catch { toast('Failed to load tournament', 'red'); }
    setLoading(false);
  }

  async function fetchDetailsForList(list) {
    setLoadingDetails(true);
    // Fetch in batches of 5
    for (let i = 0; i < list.length; i += 5) {
      const batch = list.slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map(t => fetch(`${LIMITLESS}/tournaments/${t.id}/details`).then(r => r.json()))
      );
      const updates = {};
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled') updates[batch[idx].id] = r.value;
      });
      setDetailsMap(prev => ({ ...prev, ...updates }));
    }
    setLoadingDetails(false);
  }

  async function load(p, reset = false) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ game: 'PTCG', limit: 20, page: p });
      if (formatFilter !== 'ALL') params.set('format', formatFilter);
      const res = await fetch(`${LIMITLESS}/tournaments?${params}`);
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.data || []);
      setTournaments(prev => reset ? list : [...prev, ...list]);
      setHasMore(list.length === 20);
      setPage(p);
      fetchDetailsForList(list); // background — don't await
    } catch { toast('Failed to load tournaments', 'red'); }
    setLoading(false);
  }

  async function openTournament(t) {
    setLoading(true);
    try {
      const [detRes, standRes] = await Promise.all([
        fetch(`${LIMITLESS}/tournaments/${t.id}/details`),
        fetch(`${LIMITLESS}/tournaments/${t.id}/standings`),
      ]);
      const det = await detRes.json();
      const stand = await standRes.json();
      setDetails(det);
      setStandings(Array.isArray(stand) ? stand : (stand.data || []));
      setSelected(t);
      setView('standings');
    } catch { toast('Failed to load tournament', 'red'); }
    setLoading(false);
  }

  function importDeck(player, cards) {
    if (!cards.length) { toast('No decklist available', 'red'); return; }
    const deckName = `${player.name || player.player}'s ${details?.name || selected?.name} list`;
    const format = details?.format === 'EXPANDED' ? 'Expanded' : details?.format === 'GLC' ? 'GLC' : 'Standard';
    const rawCards = cards.map(({ name, setCode, num, qty }) => ({ name, setCode, num, qty }));
    const raw = buildRaw(rawCards);
    dispatch({
      type: 'SAVE_DECK', deck: {
        id: Date.now(), name: deckName,
        format, eraLabel: '', notes: `Imported from ${details?.name || ''} — ${player.name || player.player} (${ordinal(player.placing)})`,
        rawCards, raw, sectionMap: {},
        ownedMap: {}, blingSel: {}, isBuyList: false,
      }
    });
    toast(`Added "${deckName}" to your decks!`, 'green');
    setDecklistPlayer(null);
  }

  function buildRaw(cards) {
    const sections = {};
    for (const c of cards) {
      const s = c.section || 'Trainer';
      if (!sections[s]) sections[s] = [];
      sections[s].push(`${c.qty} ${c.name}${c.setCode ? ` ${c.setCode}` : ''}${c.num ? ` ${c.num}` : ''}`);
    }
    return Object.entries(sections).map(([s, lines]) => `${s}:\n${lines.join('\n')}`).join('\n\n');
  }

  const sourceTabs = [
    { key: 'official', label: 'Official (Regionals)' },
    { key: 'community', label: '🌐 Community' },
  ];

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>
      {/* Source tabs — only show on list view */}
      {view === 'list' && (
        <div style={{ display: 'flex', gap: 4, background: 'var(--dark)', borderRadius: 10, padding: 5, marginBottom: 18 }}>
          {sourceTabs.map(t => (
            <button key={t.key} onClick={() => setSource(t.key)} style={{
              flex: 1, padding: 8, border: 'none', borderRadius: 7,
              fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 12, cursor: 'pointer',
              background: source === t.key ? 'var(--yellow)' : 'transparent',
              color: source === t.key ? 'var(--dark)' : 'var(--muted)', transition: 'all .2s',
            }}>{t.label}</button>
          ))}
        </div>
      )}

      {view === 'list' && source === 'official' && (
        <LabsTournamentList
          tournaments={labsTournaments} loading={labsLoading} error={labsError}
          onOpen={openLabsTournament} onRetry={loadLabsTournaments}
        />
      )}
      {view === 'list' && source === 'community' && (
        <TournamentList
          tournaments={tournaments} loading={loading} hasMore={hasMore}
          detailsMap={detailsMap} loadingDetails={loadingDetails}
          formatFilter={formatFilter} setFormatFilter={setFormatFilter}
          venueFilter={venueFilter} setVenueFilter={setVenueFilter}
          onOpen={openTournament} onLoadMore={() => load(page + 1)}
        />
      )}
      {view === 'standings' && (
        <TournamentStandings
          tournament={selected} details={details} standings={standings} loading={loading}
          state={state}
          onBack={() => { setView('list'); setSelected(null); setStandings([]); setDetails(null); }}
          onViewDecklist={setDecklistPlayer}
        />
      )}
      {decklistPlayer && (
        <DecklistModal
          player={decklistPlayer}
          tournament={details || selected}
          state={state}
          onImport={cards => importDeck(decklistPlayer, cards)}
          onClose={() => setDecklistPlayer(null)}
        />
      )}
    </div>
  );
}

// ── Tournament List ───────────────────────────────────────────────────────────

// ── Labs (Official) Tournament List ──────────────────────────────────────────

function LabsTournamentList({ tournaments, loading, error, onOpen, onRetry }) {
  const [typeFilter, setTypeFilter] = useState('ALL');

  const filtered = typeFilter === 'ALL' ? tournaments : tournaments.filter(t => t.type === typeFilter);

  // Group by season
  const bySeason = {};
  for (const t of filtered) {
    const s = t.season || 'Unknown';
    if (!bySeason[s]) bySeason[s] = [];
    bySeason[s].push(t);
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 24, fontWeight: 800, letterSpacing: .4, color: 'var(--yellow)' }}>Official Events</span>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
          {LABS_TYPE_FILTERS.map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`btn btn-sm ${typeFilter === t ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: 10 }}>{t === 'ALL' ? 'All' : (EVENT_TYPE_LABELS[t] || t)}</button>
          ))}
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>Loading official events…</div>}

      {error && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
          <div style={{ fontSize: 13, marginBottom: 12 }}>{error}</div>
          <button className="btn btn-ghost" onClick={onRetry}>Retry</button>
        </div>
      )}

      {!loading && !error && Object.entries(bySeason).sort((a,b) => b[0].localeCompare(a[0])).map(([season, events]) => (
        <div key={season} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--yellow)', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '2px solid var(--card-border)', paddingBottom: 6, marginBottom: 10 }}>
            Season {season}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {events.map(t => (
              <div key={t.id} onClick={() => onOpen(t)}
                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '14px 18px', cursor: 'pointer', transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--yellow)'; e.currentTarget.style.transform = 'translateX(3px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--card-border)'; e.currentTarget.style.transform = ''; }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4 }}>
                    {t.city}{t.country ? `, ${t.country}` : ''}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{t.date}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  {t.type && <span style={{ background: 'var(--pill)', borderRadius: 6, padding: '3px 8px', fontSize: 10, fontWeight: 700 }}>{EVENT_TYPE_LABELS[t.type] || t.type}</span>}
                  {t.players && <span style={{ fontSize: 11, color: 'var(--muted)' }}>👥 {t.players}</span>}
                  {t.decklists && <span style={{ background: 'rgba(74,222,128,.2)', color: 'var(--green)', borderRadius: 6, padding: '3px 8px', fontSize: 10, fontWeight: 700 }}>Decklists</span>}
                  {t.completed && <span style={{ background: 'rgba(99,179,237,.15)', color: '#63b3ed', borderRadius: 6, padding: '3px 8px', fontSize: 10, fontWeight: 700 }}>Completed</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {!loading && !error && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>No events found.</div>
      )}
    </div>
  );
}

function TournamentRow({ t, onOpen }) {
  return (
    <div onClick={() => onOpen(t)}
      style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '14px 18px', cursor: 'pointer', transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--yellow)'; e.currentTarget.style.transform = 'translateX(3px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--card-border)'; e.currentTarget.style.transform = ''; }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{fmtDate(t.date)}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        <span style={{ background: 'var(--pill)', borderRadius: 6, padding: '3px 8px', fontSize: 10, fontWeight: 700 }}>{t.format || 'STANDARD'}</span>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>👥 {t.players}</span>
        {t.decklists && <span style={{ background: 'rgba(74,222,128,.2)', color: 'var(--green)', borderRadius: 6, padding: '3px 8px', fontSize: 10, fontWeight: 700 }}>Decklists</span>}
      </div>
    </div>
  );
}

function SectionHeader({ label, color = 'var(--yellow)' }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: 1, borderBottom: '2px solid var(--card-border)', paddingBottom: 6, marginBottom: 10, marginTop: 20 }}>
      {label}
    </div>
  );
}

function TournamentList({ tournaments, loading, hasMore, detailsMap, loadingDetails, formatFilter, setFormatFilter, venueFilter, setVenueFilter, onOpen, onLoadMore }) {
  // isOnline comes from details (fetched in background); null = still loading
  const classify = t => detailsMap[t.id] ? detailsMap[t.id].isOnline : null;

  const irl = tournaments.filter(t => classify(t) === false);
  const online = tournaments.filter(t => classify(t) === true);
  const pending = tournaments.filter(t => classify(t) === null);

  const showIrl = venueFilter !== 'ONLINE';
  const showOnline = venueFilter !== 'IRL';

  return (
    <div>
      {/* Header + filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 24, fontWeight: 800, letterSpacing: .4, color: 'var(--yellow)' }}>Tournaments</span>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
          {FORMAT_FILTERS.map(f => (
            <button key={f} onClick={() => setFormatFilter(f)}
              className={`btn btn-sm ${formatFilter === f ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: 11 }}>{f}</button>
          ))}
          <div style={{ width: 1, background: 'var(--card-border)', margin: '0 4px' }} />
          {[['ALL','All'],['IRL','🏟 IRL'],['ONLINE','💻 Online']].map(([v, label]) => (
            <button key={v} onClick={() => setVenueFilter(v)}
              className={`btn btn-sm ${venueFilter === v ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: 11 }}>{label}</button>
          ))}
        </div>
      </div>

      {loading && !tournaments.length && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>Loading tournaments…</div>
      )}

      {showIrl && irl.length > 0 && (
        <>
          <SectionHeader label="🏟 In-Person" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
            {irl.map(t => <TournamentRow key={t.id} t={t} onOpen={onOpen} />)}
          </div>
        </>
      )}

      {showOnline && online.length > 0 && (
        <>
          <SectionHeader label="💻 Online" color="#63b3ed" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
            {online.map(t => <TournamentRow key={t.id} t={t} onOpen={onOpen} />)}
          </div>
        </>
      )}

      {/* Tournaments still waiting on details */}
      {venueFilter === 'ALL' && pending.length > 0 && (
        <>
          <SectionHeader label={loadingDetails ? '⏳ Sorting…' : '— Other'} color="var(--muted)" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pending.map(t => <TournamentRow key={t.id} t={t} onOpen={onOpen} />)}
          </div>
        </>
      )}

      {venueFilter !== 'ALL' && pending.length > 0 && loadingDetails && (
        <div style={{ textAlign: 'center', padding: 16, color: 'var(--muted)', fontSize: 11 }}>
          Classifying {pending.length} more…
        </div>
      )}

      {!loading && !loadingDetails && irl.length === 0 && online.length === 0 && pending.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>No tournaments found.</div>
      )}

      {hasMore && (
        <button className="btn btn-ghost" style={{ width: '100%', marginTop: 16 }} onClick={onLoadMore} disabled={loading}>
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}

// ── Tournament Standings ──────────────────────────────────────────────────────

function TournamentStandings({ tournament, details, standings, loading, state, onBack, onViewDecklist }) {
  const hasDecklists = details?.decklists ?? false;
  const isLabs = !!details?.isLabs;

  async function handlePlayerClick(player) {
    if (!hasDecklists) return;
    if (isLabs && player.hasDecklist) {
      // Fetch decklist from Labs API
      try {
        const res = await fetch(`${LABS}/decklist?tournamentId=${details.labsId}&playerId=${player.tpId}`);
        const data = await res.json();
        const dl = data.message || data;
        onViewDecklist({ ...player, decklist: dl });
      } catch {
        onViewDecklist(player);
      }
    } else if (!isLabs) {
      onViewDecklist(player);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>{details?.name || tournament?.name}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            {fmtDate(details?.date || tournament?.date)} · {details?.format || tournament?.format} · {details?.players || tournament?.players} players
            {details?.isOnline && ' · Online'}
          </div>
        </div>
        {hasDecklists && (
          <span style={{ background: 'rgba(74,222,128,.2)', color: 'var(--green)', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>Decklists available</span>
        )}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>Loading standings…</div>}

      {!loading && standings.length > 0 && (
        <div style={{ background: 'var(--card-bg)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--card-border)' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr 200px 90px', gap: 0, padding: '10px 16px', borderBottom: '2px solid var(--card-border)', fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
            <span>#</span><span>Player</span><span>Deck</span><span style={{ textAlign: 'right' }}>Record</span>
          </div>
          {standings.map(player => {
            const deckCards = parseLimitlessDecklist(player.decklist);
            const hasDecklist = hasDecklists && (isLabs ? player.hasDecklist : (deckCards.length > 0 || player.decklist));
            return (
              <div key={player.player || player.tpId || player.name}
                onClick={() => hasDecklist && handlePlayerClick(player)}
                style={{ display: 'grid', gridTemplateColumns: '56px 1fr 200px 90px', gap: 0, padding: '12px 16px', borderBottom: '1px solid var(--card-border)', alignItems: 'center', cursor: hasDecklist ? 'pointer' : 'default', transition: 'background .1s' }}
                onMouseEnter={e => { if (hasDecklist) e.currentTarget.style.background = 'var(--pill)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = ''; }}
              >
                <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 13, color: player.placing <= 3 ? 'var(--yellow)' : 'var(--muted)' }}>
                  {ordinal(player.placing)}
                </span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 12 }}>{player.name || player.player}</div>
                  {player.country && <div style={{ fontSize: 10, color: 'var(--muted)' }}>{player.country}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {player.deck?.icons?.slice(0, 3).map(icon => (
                    <span key={icon} style={{ background: 'var(--pill)', borderRadius: 4, padding: '2px 6px', fontSize: 9, fontWeight: 700, textTransform: 'capitalize' }}>{icon}</span>
                  ))}
                  {player.deck?.name && <span style={{ fontSize: 10, color: 'var(--muted)' }}>{player.deck.name}</span>}
                  {hasDecklist && <span style={{ fontSize: 9, color: 'var(--yellow)' }}>▶</span>}
                </div>
                <span style={{ textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>{fmtRecord(player.record)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Decklist Modal ────────────────────────────────────────────────────────────

function DecklistModal({ player, tournament, state, onImport, onClose }) {
  const cards = useMemo(() => parseLimitlessDecklist(player.decklist), [player]);
  const [cardImages, setCardImages] = useState({}); // `${setCode}-${num}` -> api data

  // Fetch card images in batches of 6
  useEffect(() => {
    if (!cards.length) return;
    let cancelled = false;
    async function fetchAll() {
      for (let i = 0; i < cards.length; i += 6) {
        if (cancelled) break;
        const batch = cards.slice(i, i + 6);
        const results = await Promise.all(
          batch.map(c => lookupCard(c.setCode, c.num, c.name).catch(() => null))
        );
        if (cancelled) break;
        setCardImages(prev => {
          const next = { ...prev };
          batch.forEach((c, idx) => {
            if (results[idx]) next[`${c.setCode}-${c.num}`] = results[idx];
          });
          return next;
        });
      }
    }
    fetchAll();
    return () => { cancelled = true; };
  }, [player]);

  function getOwnership(card) {
    // Standalone (free) copies
    const ck = cardKey({ name: card.name, setCode: card.setCode, num: card.num });
    let standalone = collQty(state.collection[ck]);
    if (!standalone) {
      for (const [k, val] of Object.entries(state.collection)) {
        if (k === card.name || k.startsWith(`${card.name}||`)) standalone += collQty(val);
      }
    }
    // In-deck copies
    let inDecks = 0;
    for (const deck of state.decks) {
      if (deck.isBuyList) continue;
      for (const rc of deck.rawCards) {
        if (rc.name.toLowerCase() === card.name.toLowerCase()) {
          inDecks += deck.ownedMap?.[cardKey(rc)] ?? 0;
        }
      }
    }
    return { standalone, inDecks };
  }

  const SECTIONS = ['Pokémon', 'Trainer', 'Energy'];
  const bySection = {};
  for (const s of SECTIONS) bySection[s] = cards.filter(c => c.section === s);

  const totalNeeded = cards.reduce((s, c) => s + c.qty, 0);
  const totalOwned = cards.reduce((s, c) => {
    const { standalone, inDecks } = getOwnership(c);
    return s + Math.min(c.qty, standalone + inDecks);
  }, 0);
  const pct = totalNeeded > 0 ? Math.round((totalOwned / totalNeeded) * 100) : 0;
  const deckName = `${player.name || player.player}'s ${tournament?.name} list`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'var(--card-bg)', borderRadius: 14, border: '1px solid var(--card-border)', width: '95vw', maxWidth: 1100, maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', margin: 'auto' }}>

        {/* Header */}
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--card-border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 3px', fontSize: 15 }}>{player.name || player.player}</h3>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                {ordinal(player.placing)} place · {tournament?.name}
                {player.deck?.name && ` · ${player.deck.name}`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => onImport(cards)} disabled={!cards.length}>
                + Add to My Decks
              </button>
              <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
            </div>
          </div>

          {/* Ownership bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
            <span style={{ color: 'var(--muted)' }}>Collection coverage</span>
            <span style={{ fontWeight: 800, color: pct >= 100 ? STATUS_COLORS.green : pct > 50 ? STATUS_COLORS.yellow : 'var(--muted)' }}>
              {totalOwned}/{totalNeeded} ({pct}%)
            </span>
          </div>
          <div style={{ height: 5, background: 'var(--pill)', borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? STATUS_COLORS.green : STATUS_COLORS.yellow, borderRadius: 3, transition: 'width .3s' }} />
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: STATUS_COLORS[key], flexShrink: 0 }} />
                <span style={{ color: 'var(--muted)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Card grid — scrollable */}
        <div style={{ overflowY: 'auto', padding: '16px 22px', flex: 1 }}>
          {cards.length === 0 && (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>No decklist data available.</div>
          )}
          {SECTIONS.map(section => {
            const sCards = bySection[section];
            if (!sCards?.length) return null;
            return (
              <div key={section} style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--yellow)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, borderBottom: '2px solid var(--card-border)', paddingBottom: 5 }}>
                  {section} · {sCards.reduce((s, c) => s + c.qty, 0)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
                  {sCards.map((card, i) => {
                    const api = cardImages[`${card.setCode}-${card.num}`];
                    const { standalone, inDecks } = getOwnership(card);
                    const status = getStatus(card.qty, standalone, inDecks);
                    const color = STATUS_COLORS[status];
                    const freeCount = Math.min(standalone, card.qty);
                    const inDeckCount = Math.min(inDecks, Math.max(0, card.qty - freeCount));
                    return (
                      <div key={i} style={{ background: 'var(--dark)', border: `2px solid ${color}`, borderRadius: 10, overflow: 'hidden', position: 'relative' }}>
                        {/* Card image */}
                        {api?.imageSmall
                          ? <img src={api.imageSmall} alt={card.name} style={{ width: '100%', display: 'block' }} loading="lazy" />
                          : <div style={{ height: 90, background: 'var(--pill)' }} />
                        }
                        {/* Qty badge */}
                        <div style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(0,0,0,.75)', color: '#fff', fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 11, padding: '1px 5px', borderRadius: 4 }}>
                          ×{card.qty}
                        </div>
                        {/* Status badge */}
                        <div style={{ position: 'absolute', top: 4, right: 4, background: color, color: '#000', fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 10, padding: '1px 5px', borderRadius: 4 }}>
                          {standalone + inDecks >= card.qty
                            ? status === 'purple' ? `${freeCount}free` : '✓'
                            : `${Math.min(standalone + inDecks, card.qty)}/${card.qty}`}
                        </div>
                        {/* Info */}
                        <div style={{ padding: '5px 7px' }}>
                          <div style={{ fontWeight: 800, fontSize: 9, lineHeight: 1.3, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.name}</div>
                          {card.setCode && <div style={{ fontSize: 8, color: 'var(--muted)' }}>{card.setCode} {card.num}</div>}
                          {status === 'yellow' && (
                            <div style={{ fontSize: 8, color: STATUS_COLORS.yellow, marginTop: 2 }}>{standalone}free+{inDecks}deck</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
