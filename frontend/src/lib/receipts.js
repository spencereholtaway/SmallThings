// Receipts are kept in memory only — no localStorage.
// The user loads them from a file on startup and saves to a file after changes.

let receipts = [];

export function getReceipts() {
  return receipts;
}

export function addReceipt({ uuid, trueLat, trueLng, createdAt }) {
  receipts = [...receipts, { uuid, trueLat, trueLng, createdAt }];
}

export function removeReceipt(uuid) {
  receipts = receipts.filter((r) => r.uuid !== uuid);
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
}

export function exportReceiptsJson() {
  return JSON.stringify(receipts, null, 2);
}

export function receiptCount() {
  return receipts.length;
}
