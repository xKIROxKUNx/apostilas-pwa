import { downloadStorageBytes } from "./storageService";

const MAX_APOSTILA_BYTES = 20 * 1024 * 1024;

export async function downloadApostilaHtml(urlOrGsPath: string): Promise<string> {
  const bytes = await downloadStorageBytes(urlOrGsPath, MAX_APOSTILA_BYTES);
  return new TextDecoder().decode(bytes);
}
