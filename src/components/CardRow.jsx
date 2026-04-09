import { useState } from 'react';
import { useStore } from '../hooks/useStore';
import { cardKey, checkLegality } from '../utils/cards';
import { fetchAllPrints, getCachedCard, lookupCard } from '../utils/api';

// printGroup: { api, qty, firstCopyIndex } — when set, this row represents a subset of copies sharing the same print
export default function CardRow({ deck, rc, onZoom, printGroup }) {
  const { state, dispatch, getApiData, getDeckOwned, getDeckOwnedArr, getDeckBling } = useStore();
  const api = getApiData(rc);
  const owned = getDeckOwned(deck, rc);
  const ownedArr = getDeckOwnedArr(deck, rc);
  const blingArr = getDeckBling(deck, rc);
  const ck = cardKey(rc);
  const qty = rc.qty;

  // How many copies this row represents
  const displayQty = printGroup ? printGroup.qty : qty;
  const displayApi = printGroup ? (printGroup.api || api) : (blingArr[0] || api);

  // Ownership for this row's copies — use per-copy array for groups so each group tracks independently
  let isOwned, isPartial, ownedInGroup;
  if (printGroup) {
    ownedInGroup = ownedArr.slice(printGroup.firstCopyIndex, printGroup.firstCopyIndex + printGroup.qty).reduce((s, v) => s + (v || 0), 0);
    isOwned = ownedInGroup >= printGroup.qty;
    isPartial = ownedInGroup > 0 && !isOwned;
  } else {
    isOwned = owned >= qty;
    isPartial = owned > 0 && owned < qty;
    ownedInGroup = owned;
  }

  const legality = checkLegality(rc, deck, api, state.apiCache);

  // Price
  let totalPrice = null, neededPrice = null;
  if (printGroup) {
    const unitPrice = printGroup.api?.marketPrice ?? api?.marketPrice ?? null;
    if (unitPrice != null) {
      totalPrice = unitPrice * printGroup.qty;
      const need = printGroup.qty - ownedInGroup;
      if (need > 0) neededPrice = unitPrice * need;
    }
  } else {
    const copyPrices = blingArr.map(b => b?.marketPrice ?? api?.marketPrice ?? null);
    if (copyPrices.some(p => p != null)) {
      totalPrice = copyPrices.reduce((s, p) => s + (p ?? 0), 0);
      if (owned < qty) neededPrice = copyPrices.slice(owned).reduce((s, p) => s + (p ?? 0), 0);
    }
  }

  function setOwned(val) {
    dispatch({ type: 'SET_OWNED', deckId: deck.id, ck, val: parseInt(val) || 0 });
  }
  function setGroupOwned(val) {
    dispatch({ type: 'SET_GROUP_OWNED', deckId: deck.id, ck, firstCopyIndex: printGroup.firstCopyIndex, groupQty: printGroup.qty, val });
  }

  const displayOwned = printGroup ? ownedInGroup : owned;

  function incrementOwned() {
    if (printGroup) setGroupOwned(ownedInGroup + 1);
    else setOwned(Math.min(qty, owned + 1));
  }
  function decrementOwned() {
    if (printGroup) setGroupOwned(ownedInGroup - 1);
    else setOwned(Math.max(0, owned - 1));
  }
  function changeOwned(val) {
    const n = parseInt(val) || 0;
    if (printGroup) setGroupOwned(n);
    else setOwned(Math.min(qty, Math.max(0, n)));
  }

  function toggleHaveAll() {
    if (printGroup) setGroupOwned(isOwned ? 0 : printGroup.qty);
    else setOwned(isOwned ? 0 : qty);
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: isOwned ? 'rgba(74,222,128,.07)' : isPartial ? 'rgba(251,146,60,.07)' : 'var(--card-bg)',
      border: `1px solid ${isOwned ? 'rgba(74,222,128,.3)' : isPartial ? 'rgba(251,146,60,.3)' : 'var(--card-border)'}`,
      borderRadius: 10, padding: '9px 12px', marginBottom: 6, transition: 'all .15s',
    }}>
      {/* Qty badge */}
      <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: 12, fontWeight: 700, minWidth: 26, textAlign: 'center', color: 'var(--yellow)', flexShrink: 0 }}>
        ×{displayQty}
      </span>

      {/* Card image */}
      {displayApi?.imageSmall ? (
        <img
          src={displayApi.imageSmall}
          alt={rc.name}
          onClick={() => onZoom?.(displayApi)}
          style={{ width: 38, height: 52, borderRadius: 4, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--card-border)', cursor: 'pointer', transition: 'transform .15s' }}
          onMouseEnter={e => e.target.style.transform = 'scale(1.1)'}
          onMouseLeave={e => e.target.style.transform = 'scale(1)'}
        />
      ) : (
        <div style={{ width: 38, height: 52, borderRadius: 4, flexShrink: 0, background: 'var(--pill)', border: '1px solid var(--card-border)' }} />
      )}

      {/* Card info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {rc.name}
          {!legality.legal && (
            <span title={legality.reason} style={{ fontSize: 9, background: 'rgba(227,53,13,.2)', color: '#ff6b4a', border: '1px solid rgba(227,53,13,.4)', padding: '1px 5px', borderRadius: 4, cursor: 'help' }}>
              illegal
            </span>
          )}
        </div>
        {displayApi?.setName && (
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
            {displayApi.setName} · {displayApi.number || rc.num}
          </div>
        )}
        {(displayApi?.rarity || displayApi?.subtypes?.length > 0) && (
          <div style={{ fontSize: 10, marginTop: 1, color: 'var(--muted)' }}>
            {displayApi?.rarity && <span>{displayApi.rarity}</span>}
            {displayApi?.subtypes?.length > 0 && (
              <span style={{ color: 'var(--blue)', marginLeft: displayApi?.rarity ? ' · ' : 0 }}>
                {displayApi.subtypes.join(' · ')}
              </span>
            )}
          </div>
        )}
        {totalPrice != null && (
          <div style={{ fontSize: 10, color: 'var(--green)', marginTop: 1 }}>
            ${totalPrice.toFixed(2)}{displayQty > 1 ? ' total' : ''}{neededPrice > 0
              ? <span style={{ color: 'var(--muted)' }}> · need {printGroup ? printGroup.qty - ownedInGroup : qty - owned} (${neededPrice.toFixed(2)})</span>
              : null}
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <PrintSel deck={deck} rc={rc} blingArr={blingArr} ownedArr={ownedArr} startCopyIdx={printGroup?.firstCopyIndex ?? 0} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <button className="btn btn-ghost btn-xs" onClick={decrementOwned}
            style={{ width: 24, height: 24, padding: 0, justifyContent: 'center', fontSize: 14, fontWeight: 800 }}>−</button>
          <input
            type="number" min={0} max={displayQty} value={displayOwned}
            onChange={e => changeOwned(e.target.value)}
            style={{ width: 38, height: 24, textAlign: 'center', padding: 0, fontSize: 12, fontWeight: 800 }}
          />
          <button className="btn btn-ghost btn-xs" onClick={incrementOwned}
            style={{ width: 24, height: 24, padding: 0, justifyContent: 'center', fontSize: 14, fontWeight: 800 }}>+</button>
        </div>
        <button
          className={`btn btn-xs ${isOwned ? 'btn-green' : 'btn-ghost'}`}
          onClick={toggleHaveAll}
          style={{ whiteSpace: 'nowrap' }}
        >
          {isOwned ? 'Have all' : 'Have all?'}
        </button>
      </div>
    </div>
  );
}

function PrintSel({ deck, rc, blingArr, ownedArr, startCopyIdx = 0 }) {
  const { state, dispatch, getApiData } = useStore();
  const api = getApiData(rc);
  const [prints, setPrints] = useState(null);
  const [open, setOpen] = useState(false);
  const [copyIdx, setCopyIdx] = useState(startCopyIdx);
  const ck = cardKey(rc);
  const qty = rc.qty;
  const anyPrint = blingArr.some(b => b != null);

  async function handleOpen() {
    setCopyIdx(startCopyIdx);
    if (!prints) {
      const all = await fetchAllPrints(rc.name, {
        supertype: api?.supertype,
        hp: api?.hp,
        attackNames: api?.attacks,
        attacksFull: api?.attacksFull,
        regulationMark: api?.regulationMark,
        setId: api?.setId,
      });

      // Inject collection cards missing from the API results.
      // The API search can miss prints (pagination, name variants like "Boss's Orders (Geeta)").
      // Scan collection keys matching "CardName||SET||NUM" and fetch any not already in the list.
      // Use normalized+stripped name so "Boss's Orders" matches "Boss's Orders (Geeta)||PAL||265".
      const _norm = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
      const _strip = s => s.replace(/\s*\([^)]*\)/g, '').trim();
      const normName = _norm(_strip(rc.name));
      const collectionKeys = Object.keys(state.collection || {}).filter(k => {
        const parts = k.split('||');
        return parts.length >= 3 && _norm(_strip(parts[0])) === normName;
      });
      const extras = [];
      for (const ck of collectionKeys) {
        const parts = ck.split('||');
        if (parts.length < 3) continue;
        const [, setCode, number] = parts;
        if (all.some(p => p.setCode === setCode && p.number === number)) continue;
        const card = getCachedCard(setCode, number) || await lookupCard(setCode, number, rc.name);
        if (card) extras.push(card);
      }

      const combined = [...all, ...extras];
      // Always ensure the imported print is in the list
      if (api && !combined.some(p => p.id === api.id)) {
        setPrints([api, ...combined]);
      } else {
        setPrints(combined);
      }
    }
    setOpen(true);
  }

  function selectPrint(p) {
    const curBling = blingArr[copyIdx];
    // Active = either explicitly set, or implicitly the base api card
    const effectiveBling = curBling ?? api;
    const sameAsActive = effectiveBling?.id === p.id && (effectiveBling?.variant ?? null) === (p.variant ?? null);
    // Clicking the active tile deselects (back to null); otherwise set to p
    const next = sameAsActive ? null : p;
    dispatch({ type: 'SET_BLING', deckId: deck.id, ck, blingSel: next, copyIndex: copyIdx });
    if (next && copyIdx < qty - 1) setCopyIdx(copyIdx + 1);
  }

  const curBling = blingArr[copyIdx];

  return (
    <>
      <button
        className="btn btn-xs btn-ghost"
        onClick={handleOpen}
        title="Select print"
        style={{ padding: '3px 8px', fontSize: 11, fontWeight: 700 }}
      >
        Print
      </button>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal" style={{ maxWidth: 1100, width: '92vw' }} onClick={e => e.stopPropagation()}>
            <h3>Select Print — {rc.name}</h3>
            <p className="modal-hint">Choose the specific version you own or want to track. Click the active print to revert to the deck's default.</p>

            {qty > 1 && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                {blingArr.map((b, i) => (
                  <button key={i} onClick={() => setCopyIdx(i)} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '4px 10px', borderRadius: 8,
                    border: `2px solid ${copyIdx === i ? 'var(--yellow)' : 'var(--card-border)'}`,
                    background: copyIdx === i ? 'rgba(255,203,5,.1)' : 'var(--card-bg)',
                    cursor: 'pointer', fontSize: 11, fontWeight: 700,
                    color: copyIdx === i ? 'var(--yellow)' : 'var(--muted)',
                  }}>
                    {(b?.imageSmall || api?.imageSmall)
                      ? <img src={b?.imageSmall || api?.imageSmall} alt="" style={{ width: 18, borderRadius: 2 }} />
                      : <span style={{ width: 18, height: 25, display: 'inline-block', background: 'var(--card-border)', borderRadius: 2 }} />}
                    Copy {i + 1}
                  </button>
                ))}
              </div>
            )}

            {prints === null ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Loading prints…</div>
            ) : prints.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>No alternate prints found.</div>
            ) : (() => {
                const effectiveBling = curBling ?? api;
                const hasAnyCollection = Object.keys(state.collection || {}).length > 0;

                function renderTile(p, variant) {
                  const entryId = variant ? `${p.id}-${variant}` : p.id;
                  const active = effectiveBling?.id === p.id && (effectiveBling?.variant ?? null) === variant;
                  const price = variant === 'reverseHolo' ? p.reverseHoloPrice : variant === 'stamped' ? p.stampedPrice : p.marketPrice;

                  const printCk = `${rc.name}||${p.setCode}||${p.number}`;
                  const printCkApi = `${p.name}||${p.setCode}||${p.number}`;
                  // Only check collection for base prints — reverse holo/stamped share the same card key
                  const collectionQty = !variant ? (state.collection?.[printCk] ?? state.collection?.[printCkApi] ?? 0) : 0;
                  const isDefaultPrint = p.setCode === rc.setCode && p.number === rc.num && !variant;

                  // How many copies of this print are used in THIS deck (reactive — updates as user selects)
                  const usedInThisDeck = !variant ? blingArr.reduce((sum, b) => {
                    if (b !== null) return sum + (b.setCode === p.setCode && b.number === p.number ? 1 : 0);
                    return sum + (isDefaultPrint ? 1 : 0); // null bling = uses default (rc's print)
                  }, 0) : 0;

                  // Freed copies: owned copies of the initial import that have been reassigned to a
                  // different print. The physical card is now free — count it as available.
                  const freedOwned = (isDefaultPrint && ownedArr)
                    ? blingArr.filter((b, i) => b !== null && (ownedArr[i] ?? 0)).length
                    : 0;

                  // Variants (reverseHolo/stamped) share set+number with base — skip deck usage to avoid double-count
                  const otherDeckInfo = !variant ? state.decks
                    .filter(d => d.id !== deck.id)
                    .flatMap(d => {
                      for (const r of (d.rawCards || [])) {
                        if (r.name === rc.name && r.setCode === p.setCode && r.num === p.number) return [{ name: d.name, qty: r.qty }];
                      }
                      for (const bv of Object.values(d.blingSel || {})) {
                        const ba = Array.isArray(bv) ? bv : [bv];
                        const count = ba.filter(b => b && b.setCode === p.setCode && b.number === p.number).length;
                        if (count > 0) return [{ name: d.name, qty: count }];
                      }
                      return [];
                    }) : [];

                  // Include current deck in usage list
                  const thisDeckEntry = usedInThisDeck > 0 ? [{ name: deck.name, qty: usedInThisDeck, isCurrent: true }] : [];
                  const allDeckInfo = [...thisDeckEntry, ...otherDeckInfo];
                  const inOtherDeck = allDeckInfo.length > 0;

                  // Available = collection owned minus all deck usage, plus freed initial-import copies
                  const totalUsed = usedInThisDeck + otherDeckInfo.reduce((s, i) => s + i.qty, 0);
                  const availableQty = Math.max(0, collectionQty - totalUsed) + freedOwned;
                  const inCollection = collectionQty > 0 || freedOwned > 0;

                  const greyScale = hasAnyCollection && !inCollection && !inOtherDeck && !active;
                  let imgFilter = variant === 'reverseHolo' ? 'hue-rotate(180deg) saturate(1.5)' : variant === 'stamped' ? 'sepia(0.4) saturate(1.8) hue-rotate(10deg)' : 'none';
                  if (greyScale) imgFilter = imgFilter === 'none' ? 'grayscale(1) opacity(0.6)' : `${imgFilter} grayscale(1) opacity(0.6)`;

                  // Border/bg priority: active (white) > inCollection (green) > inOtherDeck (orange) > default
                  const borderColor = active ? 'rgba(255,255,255,.8)' : inCollection ? 'var(--green)' : inOtherDeck ? 'var(--orange)' : 'var(--card-border)';
                  const bgColor = active ? 'rgba(255,255,255,.06)' : inCollection ? 'rgba(74,222,128,.08)' : inOtherDeck ? 'rgba(251,146,60,.06)' : 'var(--card-bg)';

                  function selectVariant() {
                    const variantPrice = variant === 'reverseHolo' ? p.reverseHoloPrice : variant === 'stamped' ? p.stampedPrice : null;
                    selectPrint({ ...p, ...(variant ? { marketPrice: variantPrice, variant } : {}), _variantKey: entryId });
                  }
                  return (
                    <div key={entryId} onClick={selectVariant} style={{
                      border: `2px solid ${borderColor}`,
                      borderRadius: 10, padding: 8, cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                      background: bgColor, transition: 'border-color .15s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--yellow)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = borderColor}
                    >
                      {p.imageSmall && <img src={p.imageSmall} alt={p.name} style={{ width: 96, borderRadius: 5, filter: imgFilter }} />}
                      <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.4, fontWeight: 700 }}>
                        {p.setName}<br />#{p.number}
                      </div>
                      {variant === 'reverseHolo' && <div style={{ fontSize: 9, color: 'var(--blue)', fontWeight: 800 }}>Rev. Holo</div>}
                      {variant === 'stamped' && <div style={{ fontSize: 9, color: '#f59e0b', fontWeight: 800 }}>⭐ Stamped</div>}
                      {!variant && p.rarity && <div style={{ fontSize: 9, color: 'var(--muted)' }}>{p.rarity}</div>}
                      {isDefaultPrint && <div style={{ fontSize: 9, color: 'var(--yellow)', fontWeight: 800, textAlign: 'center' }}>Initial import</div>}
                      {inCollection && (
                        <div style={{ fontSize: 9, color: availableQty > 0 ? 'var(--green)' : 'var(--muted)', fontWeight: 800, textAlign: 'center' }}>
                          {availableQty > 0 ? `Available ×${availableQty}` : 'All in use'}
                        </div>
                      )}
                      {allDeckInfo.map(({ name, qty, isCurrent }) => (
                        <div key={name} style={{ fontSize: 9, color: isCurrent ? 'var(--yellow)' : 'var(--orange)', fontWeight: 800, textAlign: 'center', lineHeight: 1.3 }}>{name} ×{qty}</div>
                      ))}
                      {price != null && <div style={{ fontSize: 10, color: 'var(--green)', fontWeight: 800 }}>${price.toFixed(2)}</div>}
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, maxHeight: 520, overflowY: 'auto' }}>
                    {prints.flatMap(p => {
                      const entries = [renderTile(p, null)];
                      if (p.reverseHoloPrice != null) entries.push(renderTile(p, 'reverseHolo'));
                      if (p.stampedPrice != null) entries.push(renderTile(p, 'stamped'));
                      return entries;
                    })}
                  </div>
                );
              })()
            }
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
