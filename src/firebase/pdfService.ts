import { ref, getBytes } from "firebase/storage";
import { storage, auth } from "./client";
import { isStorageDenied } from "./errorMessages";

const MAX_PDF_BYTES = 200 * 1024 * 1024;

export async function downloadPdfBytes(urlOrGsPath: string): Promise<ArrayBuffer> {
  const storageRef = ref(storage, urlOrGsPath);
  try {
    return await getBytes(storageRef, MAX_PDF_BYTES);
  } catch (err) {
    const usuario = auth.currentUser;
    if (!isStorageDenied(err) || !usuario) throw err;
    await usuario.getIdToken(true);
    return await getBytes(storageRef, MAX_PDF_BYTES);
  }
}
