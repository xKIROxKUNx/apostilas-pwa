import { downloadStorageBytes } from "./storageService";

const MAX_PDF_BYTES = 200 * 1024 * 1024;

export function downloadPdfBytes(urlOrGsPath: string): Promise<ArrayBuffer> {
  return downloadStorageBytes(urlOrGsPath, MAX_PDF_BYTES);
}
