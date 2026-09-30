import { downloadStorageBytes } from "./storageService";
import { parseSimulado } from "@/simulado/parseSimulado";
import type { Simulado } from "@/simulado/types";

const MAX_SIMULADO_BYTES = 5 * 1024 * 1024;

export async function downloadSimulado(urlOrGsPath: string): Promise<Simulado> {
  const bytes = await downloadStorageBytes(urlOrGsPath, MAX_SIMULADO_BYTES);
  let dados: unknown;
  try {
    dados = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error("O arquivo do simulado não é um JSON válido.");
  }
  return parseSimulado(dados);
}
