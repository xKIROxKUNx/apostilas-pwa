import { ref, getBytes } from "firebase/storage";
import { storage, auth } from "./client";
import { isStorageDenied } from "./errorMessages";

export async function downloadStorageBytes(urlOrGsPath: string, maxBytes: number): Promise<ArrayBuffer> {
  const storageRef = ref(storage, urlOrGsPath);
  try {
    return await getBytes(storageRef, maxBytes);
  } catch (err) {
    const usuario = auth.currentUser;
    if (!isStorageDenied(err) || !usuario) throw err;
    await usuario.getIdToken(true);
    return await getBytes(storageRef, maxBytes);
  }
}
