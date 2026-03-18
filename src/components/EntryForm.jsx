import { useState, useMemo, useEffect } from 'react';
import { anonymizeCoordinates } from '../lib/anonymize.js';
import { suggestEmojis } from '../lib/suggestEmojis.js';
import { supabase } from '../lib/supabase.js';

const EMOJI_SLOT_COUNT_MOBILE = 6;
const EMOJI_SLOT_COUNT_DESKTOP = 8;

export default function EntryForm({ onCreated }) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [selectedEmoji, setSelectedEmoji] = useState('');
  const [saved, setSaved] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 600);

  useEffect(() => {
    function handleResize() {
      setIsDesktop(window.innerWidth >= 600);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const emojiSlotCount = isDesktop ? EMOJI_SLOT_COUNT_DESKTOP : EMOJI_SLOT_COUNT_MOBILE;

  const suggestions = useMemo(() => suggestEmojis(note), [note]);

  useEffect(() => {
    setSelectedEmoji(suggestions[0] || '');
  }, [suggestions]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!note.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      const trueLat = position.coords.latitude;
      const trueLng = position.coords.longitude;
      const id = crypto.randomUUID();
      const deleteToken = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      const { anonLat, anonLng } = await anonymizeCoordinates(trueLat, trueLng, id);

      // Insert into shared entries (public: just emoji + anonymized coords)
      const { error: insertError } = await supabase
        .from('shared_entries')
        .insert({
          id,
          anon_lat: anonLat,
          anon_lng: anonLng,
          emoji: selectedEmoji || null,
          delete_token: deleteToken,
        });

      if (insertError) throw new Error(insertError.message);

      // Pass receipt back to App for encrypted blob storage
      onCreated({
        id,
        deleteToken,
        trueLat,
        trueLng,
        note: note.trim(),
        emoji: selectedEmoji || undefined,
        createdAt,
      });

      setNote('');
      setSelectedEmoji('');
      setSaved(true);
    } catch (err) {
      if (err.code === 1) {
        setError('Location access denied. Please allow location access to save moments.');
      } else {
        setError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleSaveAnother() {
    setSaved(false);
    setError(null);
  }

  if (saved) {
    return (
      <div className="entry-card">
        <h2 className="entry-card__title">That's lovely!</h2>
        <p className="entry-card__subtitle">
          Take a look at all the wonderful moments happening around us
        </p>
        <button className="entry-card__btn" onClick={handleSaveAnother}>
          Save another moment
        </button>
      </div>
    );
  }

  // Build emoji slots: fill with suggestions, rest are empty
  const slots = [];
  for (let i = 0; i < emojiSlotCount; i++) {
    slots.push(suggestions[i] || null);
  }

  return (
    <form className="entry-card" onSubmit={handleSubmit}>
      <label className="entry-card__label">A small nice thing:</label>
      <textarea
        className="entry-card__input"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="My small thing…"
        rows={2}
        maxLength={1000}
        disabled={submitting}
      />
      <div className="emoji-row">
        {slots.map((emoji, i) => (
          <button
            key={i}
            type="button"
            className={`emoji-circle${emoji && selectedEmoji === emoji ? ' emoji-circle--selected' : ''}${!emoji ? ' emoji-circle--empty' : ''}`}
            onClick={() => emoji && setSelectedEmoji(selectedEmoji === emoji ? '' : emoji)}
            disabled={submitting || !emoji}
            aria-label={emoji || 'empty'}
          >
            {emoji || ''}
          </button>
        ))}
      </div>
      {error && <p className="entry-card__error">{error}</p>}
      <button
        className="entry-card__btn"
        type="submit"
        disabled={submitting || !note.trim()}
      >
        {submitting ? 'Saving...' : 'Save this moment'}
      </button>
    </form>
  );
}
