import { useState, useMemo, useEffect } from 'react';
import { anonymizeCoordinates } from '../lib/anonymize.js';
import { addReceipt } from '../lib/receipts.js';
import { suggestEmojis } from '../lib/suggestEmojis.js';

const EMOJI_SLOT_COUNT = 7;

export default function EntryForm({ onCreated }) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [selectedEmoji, setSelectedEmoji] = useState('');
  const [saved, setSaved] = useState(false);

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
      const uuid = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      const { anonLat, anonLng } = await anonymizeCoordinates(trueLat, trueLng, uuid);

      const contentObj = { note: note.trim() };
      if (selectedEmoji) contentObj.emoji = selectedEmoji;

      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: uuid,
          anon_lat: anonLat,
          anon_lng: anonLng,
          content: JSON.stringify(contentObj),
          created_at: createdAt,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || data.errors?.join(', ') || 'Failed to create entry');
      }

      addReceipt({ uuid, trueLat, trueLng, createdAt, emoji: selectedEmoji || undefined });
      setNote('');
      setSelectedEmoji('');
      setSaved(true);
      onCreated();
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
  for (let i = 0; i < EMOJI_SLOT_COUNT; i++) {
    slots.push(suggestions[i] || null);
  }

  return (
    <form className="entry-card" onSubmit={handleSubmit}>
      <label className="entry-card__label">A small nice thing:</label>
      <textarea
        className="entry-card__input"
        value={note}
        onChange={(e) => setNote(e.target.value)}
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
