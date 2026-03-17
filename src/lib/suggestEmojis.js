import data from 'emojibase-data/en/data.json';

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'i', 'my', 'me', 'we', 'it', 'is', 'was', 'are', 'be',
  'been', 'have', 'has', 'had', 'do', 'did', 'will', 'just', 'that',
  'this', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which',
  'their', 'from', 'not', 'its', 'into', 'as', 'by', 'there', 'than',
  'then', 'some', 'what', 'when', 'how', 'all', 'each', 'been', 'very',
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

export function suggestEmojis(text, limit = 10) {
  const words = tokenize(text);
  if (words.length === 0) return [];

  const scores = new Map();

  for (const entry of data) {
    const searchable = [
      ...(entry.tags || []),
      ...(entry.label ? entry.label.split(/[\s-]+/) : []),
    ].map((t) => t.toLowerCase());

    let score = 0;
    for (const word of words) {
      for (const tag of searchable) {
        if (tag === word) score += 2;
        else if (tag.startsWith(word) || word.startsWith(tag)) score += 1;
      }
    }

    if (score > 0) scores.set(entry.emoji, (scores.get(entry.emoji) || 0) + score);
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([emoji]) => emoji);
}
