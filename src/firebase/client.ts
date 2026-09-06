import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { loadFirebaseConfig } from "./config";

const app = initializeApp(loadFirebaseConfig());

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
