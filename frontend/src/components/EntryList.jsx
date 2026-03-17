import { isMyEntry, getReceiptFor } from '../lib/receipts.js';

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function parseContent(contentStr) {
  try {
    const parsed = JSON.parse(contentStr);
    return parsed.note || parsed.text || contentStr;
  } catch {
    return contentStr;
  }
}

export default function EntryList({ entries, onDelete, loading }) {
  if (loading) return <p className="loading">Loading entries...</p>;
  if (entries.length === 0) return <p className="empty">No entries yet. Create one below!</p>;

  return (
    <ul className="entry-list">
      {entries.map((entry) => {
        const mine = isMyEntry(entry.id);
        const receipt = mine ? getReceiptFor(entry.id) : null;
        const displayLat = receipt ? receipt.trueLat : entry.anon_lat;
        const displayLng = receipt ? receipt.trueLng : entry.anon_lng;

        return (
          <li key={entry.id} className={`entry ${mine ? 'entry--mine' : ''}`}>
            <div className="entry__header">
              <span className="entry__time">{timeAgo(entry.created_at)}</span>
              {mine && <span className="entry__badge">mine</span>}
            </div>
            <p className="entry__content">{parseContent(entry.content)}</p>
            <div className="entry__footer">
              <span className="entry__location">
                {displayLat.toFixed(4)}, {displayLng.toFixed(4)}
                {!mine && <span className="entry__approx"> (approx)</span>}
              </span>
              {mine && (
                <button className="entry__delete" onClick={() => onDelete(entry.id)}>
                  delete
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
