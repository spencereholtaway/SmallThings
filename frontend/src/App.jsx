import { useState, useEffect, useCallback } from 'react';
import EntryList from './components/EntryList.jsx';
import EntryForm from './components/EntryForm.jsx';
import { deleteReceipt } from './lib/receipts.js';

export default function App() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

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

  async function handleDelete(id) {
    try {
      const res = await fetch(`/entries/${id}`, { method: 'DELETE' });
      if (res.ok) {
        deleteReceipt(id);
        setEntries((prev) => prev.filter((e) => e.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete entry:', err);
    }
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1>A Series of Small Things</h1>
      </header>
      <main className="app__main">
        <EntryList entries={entries} onDelete={handleDelete} loading={loading} />
        <EntryForm onCreated={fetchEntries} />
      </main>
    </div>
  );
}
