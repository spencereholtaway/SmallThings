const STORAGE_KEY = 'small-things-receipts';

export function getReceipts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

export function saveReceipt({ uuid, trueLat, trueLng, createdAt }) {
  const receipts = getReceipts();
  receipts.push({ uuid, trueLat, trueLng, createdAt });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts));
}

export function isMyEntry(uuid) {
  return getReceipts().some((r) => r.uuid === uuid);
}

export function getReceiptFor(uuid) {
  return getReceipts().find((r) => r.uuid === uuid) || null;
}

export function deleteReceipt(uuid) {
  const receipts = getReceipts().filter((r) => r.uuid !== uuid);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts));
}
