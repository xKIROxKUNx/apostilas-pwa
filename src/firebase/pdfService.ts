import { ref, getBytes } from "firebase/storage";
import { storage } from "./client";

const MAX_PDF_BYTES = 200 * 1024 * 1024;

export async function downloadPdfBytes(urlOrGsPath: string): Promise<ArrayBuffer> {
  const storageRef = ref(storage, urlOrGsPath);
  const bytes = await getBytes(storageRef, MAX_PDF_BYTES);
  return bytes;
}
