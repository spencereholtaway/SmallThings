import { useState, useEffect, useCallback, useRef } from 'react';
import EntryList from './components/EntryList.jsx';
import EntryForm from './components/EntryForm.jsx';
import {
  loadReceiptsFromJson,
  exportReceiptsJson,
  removeReceipt,
  receiptCount,
} from './lib/receipts.js';

function downloadFile(content, filename) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [receiptsLoaded, setReceiptsLoaded] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const fileInputRef = useRef(null);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch('/entries');
      const data = await res.json();
      setEntries(data.entries);
    } catch (err) {
      console.error('Failed to fetch entries:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  function handleLoadFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        loadReceiptsFromJson(ev.target.result);
        setReceiptsLoaded(true);
        setUnsaved(false);
        // Re-render list with loaded receipts
        setEntries((prev) => [...prev]);
      } catch {
        alert('Could not load that file. Make sure it\'s a valid Small Things data file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleSaveFile() {
    const json = exportReceiptsJson();
    downloadFile(json, 'small-things-data.json');
    setUnsaved(false);
  }

  function handleStartFresh() {
    setReceiptsLoaded(true);
  }

  function handleEntryCreated() {
    setUnsaved(true);
    fetchEntries();
  }

  async function handleDelete(id) {
    try {
      const res = await fetch(`/entries/${id}`, { method: 'DELETE' });
      if (res.ok) {
        removeReceipt(id);
        setEntries((prev) => prev.filter((e) => e.id !== id));
        setUnsaved(true);
      }
    } catch (err) {
      console.error('Failed to delete entry:', err);
    }
  }

  // --- Data file screen ---
  if (!receiptsLoaded) {
    return (
      <div className="app">
        <header className="app__header">
          <h1>A Series of Small Things</h1>
        </header>
        <main className="app__main">
          <div className="data-screen">
            <p className="data-screen__lead">
              Your entries are yours. Load your data file to see which things are yours,
              or start fresh if this is your first time.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleLoadFile}
            />
            <button className="btn btn--primary" onClick={() => fileInputRef.current.click()}>
              Load my data file
            </button>
            <button className="btn btn--secondary" onClick={handleStartFresh}>
              Start fresh
            </button>
          </div>
        </main>
      </div>
    );
  }

  // --- Main app ---
  return (
    <div className="app">
      <header className="app__header">
        <h1>A Series of Small Things</h1>
        <div className="app__header-actions">
          {unsaved && (
            <span className="unsaved-badge">unsaved changes</span>
          )}
          <button className="btn btn--small" onClick={handleSaveFile}>
            Save my data
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleLoadFile}
          />
          <button className="btn btn--small btn--secondary" onClick={() => fileInputRef.current.click()}>
            Load file
          </button>
        </div>
      </header>
      <main className="app__main">
        {receiptCount() > 0 && (
          <p className="data-note">{receiptCount()} of your things loaded</p>
        )}
        <EntryList entries={entries} onDelete={handleDelete} loading={loading} />
        <EntryForm onCreated={handleEntryCreated} />
      </main>
    </div>
  );
}
