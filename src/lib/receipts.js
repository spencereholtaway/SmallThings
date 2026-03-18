const STORAGE_KEY = 'small-things-receipts';

let receipts = loadFromStorage();

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts));
  } catch {
    // Storage full or unavailable — silent fail
  }
}

export function getReceipts() {
  return receipts;
}

export function addReceipt({ uuid, trueLat, trueLng, createdAt, emoji }) {
  const receipt = { uuid, trueLat, trueLng, createdAt };
  if (emoji) receipt.emoji = emoji;
  receipts = [...receipts, receipt];
  persist();
}

export function removeReceipt(uuid) {
  receipts = receipts.filter((r) => r.uuid !== uuid);
  persist();
}

export function isMyEntry(uuid) {
  return receipts.some((r) => r.uuid === uuid);
}

export function getReceiptFor(uuid) {
  return receipts.find((r) => r.uuid === uuid) || null;
}

export function loadReceiptsFromJson(json) {
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed)) throw new Error('Invalid receipts file');
  receipts = parsed;
  persist();
}

export function exportReceiptsJson() {
  return JSON.stringify(receipts, null, 2);
}

export function receiptCount() {
  return receipts.length;
}
