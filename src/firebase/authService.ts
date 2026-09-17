import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth } from "./client";

export function getCurrentUser(): FirebaseUser | null {
  return auth.currentUser;
}

export function isUserLoggedIn(): boolean {
  return auth.currentUser !== null;
}

export async function login(email: string, password: string): Promise<FirebaseUser> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function logout(): Promise<void> {
  await signOut(auth);
}

export async function forceSignOut(): Promise<void> {
  await signOut(auth);
}

export function observeAuthState(
  callback: (user: FirebaseUser | null) => void,
): () => void {
  return onAuthStateChanged(auth, callback);
}

export function waitForInitialAuthState(): Promise<FirebaseUser | null> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export async function reloadCurrentUser(): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  await user.reload();
}
