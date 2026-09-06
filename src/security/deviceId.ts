import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "apostilas-security";
const STORE_NAME = "device";
const DEVICE_ID_KEY = "deviceId";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
}

function generateDeviceId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function getOrCreateDeviceId(): Promise<string> {
  const db = await getDb();
  const existing = await db.get(STORE_NAME, DEVICE_ID_KEY);
  if (typeof existing === "string" && existing.length > 0) {
    return existing;
  }
  const newId = generateDeviceId();
  await db.put(STORE_NAME, newId, DEVICE_ID_KEY);
  return newId;
}
