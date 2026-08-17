import { useState } from 'react';
import { useStore } from '../hooks/useStore';
import { useToast } from './Toast';

export default function SaveRestoreModal({ onClose }) {
  const { state, dispatch } = useStore();
  const toast = useToast();

  function exportAll() {
    const data = { version: 4, exported: new Date().toISOString(), decks: state.decks, collection: state.collection };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = 'tcg-companion-backup.json';
    a.click();
  }

  function importAll(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        dispatch({ type: 'IMPORT_ALL', decks: data.decks || [], collection: data.collection || {} });
        toast('Backup restored!', 'green');
        onClose();
      } catch { toast('Invalid backup file', 'red'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Save & Restore</h3>

        <p className="modal-hint">
          Everything auto-saves to your browser. Export a JSON backup to use on another device or as a safety net.
        </p>

        <div className="modal-actions">
          <button className="btn btn-yellow" onClick={exportAll}>Export JSON</button>
          <button className="btn btn-ghost" onClick={() => document.getElementById('restore-file').click()}>Import JSON</button>
          <input type="file" id="restore-file" accept=".json" style={{ display: 'none' }} onChange={importAll} />
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>

        <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 10 }}>
          Card images and API data are re-fetched automatically — only your decks, owned counts, bling selections, and collection are saved.
        </p>
      </div>
    </div>
  );
}
