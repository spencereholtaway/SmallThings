import { useState } from 'react';
import { anonymizeCoordinates } from '../lib/anonymize.js';
import { addReceipt } from '../lib/receipts.js';

export default function EntryForm({ onCreated }) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

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

      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: uuid,
          anon_lat: anonLat,
          anon_lng: anonLng,
          content: JSON.stringify({ note: note.trim() }),
          created_at: createdAt,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || data.errors?.join(', ') || 'Failed to create entry');
      }

      addReceipt({ uuid, trueLat, trueLng, createdAt });
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
      {error && <p className="entry-form__error">{error}</p>}
      <button className="entry-form__submit" type="submit" disabled={submitting || !note.trim()}>
        {submitting ? 'Sharing...' : 'Share'}
      </button>
    </form>
  );
}
