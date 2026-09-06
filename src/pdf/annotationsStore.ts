import { openDB, type IDBPDatabase } from "idb";
import type { Stroke } from "@/types/domain";

interface StrokesDocV1 {
  version: number;
  pages: Record<number, Stroke[]>;
}

const DB_NAME = "apostilas-annotations";
const STORE_NAME = "strokes";
const CURRENT_VERSION = 1;

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

const maxKnownStrokeCount = new Map<string, number>();

function countStrokes(pages: Record<number, Stroke[]>): number {
  return Object.values(pages).reduce((sum, list) => sum + list.length, 0);
}

export async function loadStrokes(apostilaId: string): Promise<Record<number, Stroke[]>> {
  try {
    const db = await getDb();
    const doc = (await db.get(STORE_NAME, apostilaId)) as StrokesDocV1 | undefined;
    if (!doc) return {};

    const loadedCount = countStrokes(doc.pages);
    const knownMax = maxKnownStrokeCount.get(apostilaId) ?? 0;

    if (loadedCount < knownMax) {
      console.warn(
        `[annotationsStore] leitura regressiva para ${apostilaId}: carregou ${loadedCount}, máximo conhecido é ${knownMax}.`,
      );
    } else {
      maxKnownStrokeCount.set(apostilaId, loadedCount);
    }

    return doc.pages;
  } catch (err) {
    console.error("[annotationsStore] erro ao carregar traços:", err);
    return {};
  }
}

export async function saveStrokes(
  apostilaId: string,
  pages: Record<number, Stroke[]>,
): Promise<boolean> {
  const currentCount = countStrokes(pages);
  const knownMax = maxKnownStrokeCount.get(apostilaId) ?? 0;

  if (currentCount < knownMax) {
    console.warn(
      `[annotationsStore] save abortado para ${apostilaId}: contagem atual (${currentCount}) menor que o máximo confirmado (${knownMax}).`,
    );
    return false;
  }

  try {
    const db = await getDb();
    const doc: StrokesDocV1 = { version: CURRENT_VERSION, pages };
    await db.put(STORE_NAME, doc, apostilaId);
    maxKnownStrokeCount.set(apostilaId, currentCount);
    return true;
  } catch (err) {
    console.error("[annotationsStore] erro ao salvar traços:", err);
    return false;
  }
}

export function resetKnownStrokeCount(apostilaId: string): void {
  maxKnownStrokeCount.set(apostilaId, 0);
}

export async function purgeLegacyStrokes(): Promise<void> {
  try {
    const db = await getDb();
    const keys = await db.getAllKeys(STORE_NAME);
    const legacy = keys.filter((k) => typeof k === "string" && !k.includes(":"));
    if (legacy.length === 0) return;
    await Promise.all(legacy.map((k) => db.delete(STORE_NAME, k)));
    console.info(
      `[annotationsStore] ${legacy.length} anotação(ões) em formato antigo removida(s) (ver purgeLegacyStrokes).`,
    );
  } catch (err) {
    console.warn("[annotationsStore] falha ao limpar anotações antigas (ignorado):", err);
  }
}
