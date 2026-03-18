import { useState, useEffect, useCallback, useRef } from 'react';
import Map from './components/Map.jsx';
import FilterDropdown from './components/FilterDropdown.jsx';
import EntryForm from './components/EntryForm.jsx';
import AuthScreen from './components/AuthScreen.jsx';
import { Navigation, User, Trash2 } from 'lucide-react';
import { supabase } from './lib/supabase.js';
import { initUserCrypto, loadBlob, saveBlob } from './lib/blob.js';
import { SAMPLE_ENTRIES } from './lib/sampleData.js';

function formatReceiptTime(createdAt) {
  const d = new Date(createdAt);
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' at ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  );
}

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
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const mapRef = useRef(null);
  const menuRefMobile = useRef(null);
  const menuRefDesktop = useRef(null);

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

  // Close menu when clicking outside either menu container
  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e) {
      const inMobile = menuRefMobile.current?.contains(e.target);
      const inDesktop = menuRefDesktop.current?.contains(e.target);
      if (!inMobile && !inDesktop) setMenuOpen(false);
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

  const sortedReceipts = [...receipts].sort((a, b) =>
    new Date(b.createdAt) - new Date(a.createdAt)
  );

  const userMenuDropdown = menuOpen && (
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
  );

  return (
    <div className="app">
      <div className="map-area">
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

        {/* Mobile-only user menu */}
        <div className="overlay-top-right overlay-top-right--mobile-only" ref={menuRefMobile}>
          <button
            className="location-btn"
            onClick={() => setMenuOpen((o) => !o)}
            title="Account"
            type="button"
          >
            <User size={18} strokeWidth={1.75} />
          </button>
          {userMenuDropdown}
        </div>

        <div className="overlay-bottom">
          <EntryForm onCreated={handleEntryCreated} />
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className="moments-sidebar">
        <div className="moments-sidebar__header">
          <h2 className="moments-sidebar__title">My Moments</h2>
          <div className="moments-sidebar__user-wrap" ref={menuRefDesktop}>
            <button
              className="moments-sidebar__user-btn"
              onClick={() => setMenuOpen((o) => !o)}
              title="Account"
              type="button"
            >
              <User size={20} strokeWidth={1.5} />
            </button>
            {userMenuDropdown}
          </div>
        </div>

        <div className="moments-sidebar__list">
          {sortedReceipts.length === 0 ? (
            <p className="moments-sidebar__empty">No moments yet.</p>
          ) : (
            sortedReceipts.map((receipt) => {
              const confirming = confirmDeleteId === receipt.id;
              return confirming ? (
                <div key={receipt.id} className="moment-item moment-item--confirming">
                  <span className="moment-item__confirm-label">Delete this pin?</span>
                  <div className="moment-item__confirm-actions">
                    <button
                      className="moment-item__confirm-btn moment-item__confirm-btn--delete"
                      onClick={() => { setConfirmDeleteId(null); handleDelete(receipt.id); }}
                      type="button"
                    >
                      Delete
                    </button>
                    <button
                      className="moment-item__confirm-btn moment-item__confirm-btn--cancel"
                      onClick={() => setConfirmDeleteId(null)}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  key={receipt.id}
                  className="moment-item"
                  onClick={() => mapRef.current?.flyTo(receipt.trueLng, receipt.trueLat, 18)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && mapRef.current?.flyTo(receipt.trueLng, receipt.trueLat, 18)}
                >
                  <div className="moment-item__emoji">
                    {receipt.emoji || '·'}
                  </div>
                  <div className="moment-item__content">
                    <div className="marker-popup__time">{formatReceiptTime(receipt.createdAt)}</div>
                    <div className="marker-popup__note">{receipt.note}</div>
                  </div>
                  <button
                    className="moment-item__delete"
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(receipt.id); }}
                    title="Delete"
                    type="button"
                  >
                    <Trash2 size={15} strokeWidth={1.75} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>

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
    </div>
  );
}
