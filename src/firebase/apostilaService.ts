import { collection, getDocs } from "firebase/firestore";
import { db } from "./client";
import type { Apostila } from "@/types/domain";

export async function getApostilas(): Promise<Apostila[]> {
  const snapshot = await getDocs(collection(db, "apostilas"));
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      titulo: data.titulo ?? "",
      componenteCurricular: data.componente_curricular ?? "Sem componente curricular",
      urlPdf: data.url_pdf ?? "",
      nivelRequerido: typeof data.nivel_requerido === "number" ? data.nivel_requerido : 1,
    } satisfies Apostila;
  });
}
