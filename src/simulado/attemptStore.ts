import { openDB, type IDBPDatabase } from "idb";
import type { RegistroSimulado } from "./types";

const DB_NAME = "apostilas-simulados";
const STORE_NAME = "registros";
const MAX_HISTORICO = 20;

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

export function registroVazio(): RegistroSimulado {
  return { atual: null, historico: [] };
}

export async function carregarRegistro(escopo: string): Promise<RegistroSimulado> {
  try {
    const db = await getDb();
    const valor = (await db.get(STORE_NAME, escopo)) as RegistroSimulado | undefined;
    if (!valor || !Array.isArray(valor.historico)) return registroVazio();
    return valor;
  } catch (err) {
    console.error("[simulado] erro ao carregar tentativas:", err);
    return registroVazio();
  }
}

export async function salvarRegistro(escopo: string, registro: RegistroSimulado): Promise<void> {
  try {
    const db = await getDb();
    await db.put(STORE_NAME, { ...registro, historico: registro.historico.slice(0, MAX_HISTORICO) }, escopo);
  } catch (err) {
    console.error("[simulado] erro ao salvar tentativa:", err);
  }
}
