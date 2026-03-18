import { useState, useEffect, useCallback, useRef } from 'react';
import Map from './components/Map.jsx';
import FilterDropdown from './components/FilterDropdown.jsx';
import EntryForm from './components/EntryForm.jsx';
import AuthScreen from './components/AuthScreen.jsx';
import { Navigation, User } from 'lucide-react';
import { supabase } from './lib/supabase.js';
import { initUserCrypto, loadBlob, saveBlob } from './lib/blob.js';
import { SAMPLE_ENTRIES } from './lib/sampleData.js';

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = logged out
  const [entries, setEntries] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [encryptionKey, setEncryptionKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showSample, setShowSample] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const mapRef = useRef(null);
  const menuRef = useRef(null);

  // Auth: check session on mount and listen for changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    );

    return () => subscription.unsubscribe();
  }, []);

  // Fetch shared entries from Supabase
  const fetchEntries = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('public_entries')
        .select('*');
      if (error) throw error;
      setEntries(data || []);
    } catch (err) {
      console.error('Failed to fetch entries:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // On login: init crypto, load blob, fetch entries
  useEffect(() => {
    if (!session) {
      setReceipts([]);
      setEncryptionKey(null);
      return;
    }

    async function init() {
      try {
        const key = await initUserCrypto(supabase, session.user.id);
        setEncryptionKey(key);
        const blob = await loadBlob(supabase, session.user.id, key);
        setReceipts(blob);
      } catch (err) {
        console.error('Failed to initialize crypto:', err);
      }
      fetchEntries();
      navigator.geolocation.getCurrentPosition(() => {}, () => {});
    }

    init();
  }, [session, fetchEntries]);

  // Save receipts to encrypted blob whenever they change
  const saveReceipts = useCallback(async (newReceipts) => {
    setReceipts(newReceipts);
    if (session && encryptionKey) {
      try {
        await saveBlob(supabase, session.user.id, encryptionKey, newReceipts);
      } catch (err) {
        console.error('Failed to save encrypted blob:', err);
      }
    }
  }, [session, encryptionKey]);

  function handleEntryCreated(receipt) {
    saveReceipts([...receipts, receipt]);
    fetchEntries();
    mapRef.current?.flyTo(receipt.trueLng, receipt.trueLat, 18);
  }

  async function handleDelete(entryId) {
    const receipt = receipts.find((r) => r.id === entryId);
    if (!receipt) return;

    try {
      const { error } = await supabase
        .from('shared_entries')
        .delete()
        .eq('id', entryId)
        .eq('delete_token', receipt.deleteToken);

      if (error) throw error;

      saveReceipts(receipts.filter((r) => r.id !== entryId));
      fetchEntries();
    } catch (err) {
      console.error('Failed to delete entry:', err);
    }
  }

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  async function handleSignOut() {
    setMenuOpen(false);
    await supabase.auth.signOut();
  }

  async function handleDeleteAccount() {
    setDeleteLoading(true);
    try {
      const userId = session.user.id;

      // Delete all shared entries using receipts (respects delete_token auth)
      for (const receipt of receipts) {
        await supabase
          .from('shared_entries')
          .delete()
          .eq('id', receipt.id)
          .eq('delete_token', receipt.deleteToken);
      }

      // Delete private blob and encryption key
      await supabase.from('user_blobs').delete().eq('user_id', userId);
      await supabase.from('user_keys').delete().eq('user_id', userId);

      // Delete auth user via RPC (requires a delete_user() security definer function in Supabase)
      await supabase.rpc('delete_user');

      await supabase.auth.signOut();
    } catch (err) {
      console.error('Failed to delete account:', err);
      setDeleteLoading(false);
    }
  }

  // Still checking auth state
  if (session === undefined) return null;

  // Not logged in — show sign-in screen
  if (!session) return <AuthScreen />;

  return (
    <div className="app">
      <Map ref={mapRef} entries={showSample ? [...entries, ...SAMPLE_ENTRIES] : entries} receipts={receipts} filter={filter} onDelete={handleDelete} />

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
        <button
          className={`sample-toggle${showSample ? ' sample-toggle--on' : ''}`}
          onClick={() => setShowSample((v) => !v)}
          type="button"
        >
          <span className="sample-toggle__dot" />
          <span className="sample-toggle__label">Sample data</span>
        </button>
      </div>

      <div className="overlay-top-right" ref={menuRef}>
        <button
          className="location-btn"
          onClick={() => setMenuOpen((o) => !o)}
          title="Account"
          type="button"
        >
          <User size={18} strokeWidth={1.75} />
        </button>
        {menuOpen && (
          <div className="user-menu">
            <button className="user-menu__item" onClick={handleSignOut} type="button">
              Log out
            </button>
            <button
              className="user-menu__item user-menu__item--danger"
              onClick={() => { setMenuOpen(false); setShowDeleteDialog(true); }}
              type="button"
            >
              Delete Account
            </button>
          </div>
        )}
      </div>

      {showDeleteDialog && (
        <div className="dialog-backdrop" onClick={() => !deleteLoading && setShowDeleteDialog(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <p className="dialog__message">Are you sure you want to delete your account?</p>
            <div className="dialog__actions">
              <button
                className="dialog__btn dialog__btn--cancel"
                onClick={() => setShowDeleteDialog(false)}
                disabled={deleteLoading}
                type="button"
              >
                No
              </button>
              <button
                className="dialog__btn dialog__btn--confirm"
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
                type="button"
              >
                {deleteLoading ? 'Deleting…' : 'Yes'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="overlay-bottom">
        <EntryForm onCreated={handleEntryCreated} />
      </div>
    </div>
  );
}
