import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db, auth } from "./client";
import type { UserProfile } from "@/types/domain";
import { DeviceBindingError } from "@/types/domain";
import { deviceIdsMatch } from "@/security/wasm/accessGuard";
import { boundDeviceIds, decideBinding } from "./deviceSlots";

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Usuário não autenticado.");
  return uid;
}

export async function getCurrentUserLevel(): Promise<number> {
  const uid = requireUid();
  const snap = await getDoc(doc(db, "users", uid));
  const raw = snap.data()?.nivel_acesso;
  return typeof raw === "number" ? raw : 1;
}

export async function getUserProfile(): Promise<UserProfile> {
  const uid = requireUid();
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) {
    throw new Error("Conta revogada: documento do usuário não encontrado.");
  }
  const data = snap.data();
  return {
    email: data.email ?? "",
    nivelAcesso: typeof data.nivel_acesso === "number" ? data.nivel_acesso : 1,
    deviceIds: boundDeviceIds(data),
  };
}

export async function validateUserProfile(): Promise<boolean> {
  const uid = requireUid();
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) {
    throw new Error("Conta revogada: documento do usuário não encontrado.");
  }
  return true;
}

export async function checkDeviceBinding(currentDeviceId: string): Promise<void> {
  const uid = requireUid();
  const docRef = doc(db, "users", uid);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    throw new Error("Conta revogada: documento do usuário não encontrado.");
  }

  const data = snap.data();
  const nivel = typeof data.nivel_acesso === "number" ? data.nivel_acesso : 1;

  if (nivel === 5) {
    return;
  }

  const decisao = decideBinding(data, currentDeviceId, deviceIdsMatch);

  if (decisao.tipo === "ja-vinculado") return;

  if (decisao.tipo === "reivindicar") {
    await updateDoc(docRef, { [decisao.campo]: currentDeviceId });
    return;
  }

  throw new DeviceBindingError(
    "Acesso Negado: Esta conta já está vinculada a outro dispositivo/navegador. Contate a administração.",
  );
}
