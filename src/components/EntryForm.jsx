import { useState, useMemo, useEffect } from 'react';
import { anonymizeCoordinates } from '../lib/anonymize.js';
import { addReceipt } from '../lib/receipts.js';
import { suggestEmojis } from '../lib/suggestEmojis.js';

export default function EntryForm({ onCreated }) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [selectedEmoji, setSelectedEmoji] = useState('');

  const suggestions = useMemo(() => suggestEmojis(note), [note]);

  // Auto-select first suggestion whenever suggestions change
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
      onCreated();
    } catch (err) {
      if (err.code === 1) {
        setError('Location access denied. Please allow location access to create entries.');
      } else {
        setError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="entry-form" onSubmit={handleSubmit}>
      <textarea
        className="entry-form__input"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What small thing did you notice?"
        rows={3}
        maxLength={1000}
        disabled={submitting}
      />
      {suggestions.length > 0 && (
        <div className="emoji-suggestions">
          {suggestions.map((emoji, i) => (
            <button
              key={i}
              type="button"
              className={`emoji-btn${selectedEmoji === emoji ? ' emoji-btn--selected' : ''}`}
              onClick={() => setSelectedEmoji(selectedEmoji === emoji ? '' : emoji)}
              disabled={submitting}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      {error && <p className="entry-form__error">{error}</p>}
      <button className="entry-form__submit" type="submit" disabled={submitting || !note.trim()}>
        {submitting ? 'Sharing...' : 'Share'}
      </button>
    </form>
  );
}
