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

export interface ReadingPosition {
  pageIndex: number;
  fraction: number;
}

function readingPositionKey(scope: string): string {
  return `reading_position:${scope}`;
}

export async function getReadingPosition(scope: string): Promise<ReadingPosition | null> {
  try {
    const db = await getDb();
    const value = await db.get(STORE_NAME, readingPositionKey(scope));
    if (
      value &&
      typeof value === "object" &&
      typeof (value as ReadingPosition).pageIndex === "number" &&
      typeof (value as ReadingPosition).fraction === "number"
    ) {
      return value as ReadingPosition;
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveReadingPosition(
  scope: string,
  position: ReadingPosition,
): Promise<void> {
  try {
    const db = await getDb();
    await db.put(STORE_NAME, position, readingPositionKey(scope));
  } catch {
    return;
  }
}

export async function clearReadingPosition(scope: string): Promise<void> {
  try {
    const db = await getDb();
    await db.delete(STORE_NAME, readingPositionKey(scope));
  } catch {
    return;
  }
}
