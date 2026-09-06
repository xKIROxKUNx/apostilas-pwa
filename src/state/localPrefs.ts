import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "apostilas-prefs";
const STORE_NAME = "prefs";
const NICKNAME_KEY = "user_nickname";

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

export async function getSavedNickname(): Promise<string> {
  const db = await getDb();
  const value = await db.get(STORE_NAME, NICKNAME_KEY);
  return typeof value === "string" ? value : "";
}

export async function saveNickname(nickname: string): Promise<void> {
  const db = await getDb();
  await db.put(STORE_NAME, nickname.trim(), NICKNAME_KEY);
}

export async function clearNickname(): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, NICKNAME_KEY);
}
