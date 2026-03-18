import { useState, useEffect, useCallback, useRef } from 'react';
import Map from './components/Map.jsx';
import FilterDropdown from './components/FilterDropdown.jsx';
import EntryForm from './components/EntryForm.jsx';
import { Navigation } from 'lucide-react';
import {
  loadReceiptsFromJson,
  exportReceiptsJson,
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
  const [filter, setFilter] = useState('all');
  const fileInputRef = useRef(null);
  const mapRef = useRef(null);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch('/api/entries');
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
    navigator.geolocation.getCurrentPosition(() => {}, () => {});
  }, [fetchEntries]);

  function handleLoadFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        loadReceiptsFromJson(ev.target.result);
        setEntries((prev) => [...prev]);
      } catch {
        alert("Could not load that file. Make sure it's a valid Small Things data file.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleSaveFile() {
    const json = exportReceiptsJson();
    downloadFile(json, 'small-things-data.json');
  }

  function handleEntryCreated() {
    fetchEntries();
  }

  return (
    <div className="app">
      <Map ref={mapRef} entries={entries} filter={filter} />

      <div className="overlay-top">
        <FilterDropdown value={filter} onChange={setFilter} />
        <button
          className="location-btn"
          onClick={() => mapRef.current?.flyToUser()}
          title="Go to my location"
          type="button"
        >
          <Navigation size={18} strokeWidth={1.75} />
        </button>
      </div>

      {receiptCount() > 0 && (
        <div className="overlay-data-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleLoadFile}
          />
          <button
            className="data-btn"
            onClick={handleSaveFile}
            title="Download backup"
          >
            ↓
          </button>
          <button
            className="data-btn"
            onClick={() => fileInputRef.current.click()}
            title="Restore from backup"
          >
            ↑
          </button>
        </div>
      )}

      <div className="overlay-bottom">
        <EntryForm onCreated={handleEntryCreated} />
      </div>
    </div>
  );
}
