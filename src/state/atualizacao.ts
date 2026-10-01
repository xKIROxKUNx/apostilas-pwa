import { useSyncExternalStore } from "react";

const BASE = import.meta.env.BASE_URL;
const CHAVE_RECARGA = "apostilas-recarga";
export const VERSAO_ATUAL: string = import.meta.env.VITE_APP_VERSION ?? "dev";

type EstadoAtualizacao = "normal" | "atualizando";

let estado: EstadoAtualizacao = "normal";
const ouvintes = new Set<() => void>();

function definirEstado(novo: EstadoAtualizacao) {
  estado = novo;
  ouvintes.forEach((ouvinte) => ouvinte());
}

export function useEstadoAtualizacao(): EstadoAtualizacao {
  return useSyncExternalStore(
    (ouvinte) => {
      ouvintes.add(ouvinte);
      return () => {
        ouvintes.delete(ouvinte);
      };
    },
    () => estado,
  );
}

export function registrarServiceWorker() {
  if (import.meta.env.DEV || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${BASE}sw.js`, { scope: BASE, updateViaCache: "none" }).catch(() => {});
  });
}

function numeros(versao: string): number[] | null {
  return /^\d+\.\d+\.\d+$/.test(versao) ? versao.split(".").map(Number) : null;
}

function maisNova(candidata: string, atual: string): boolean {
  const a = numeros(candidata);
  const b = numeros(atual);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

export async function haVersaoMaisNova(): Promise<boolean> {
  if (!numeros(VERSAO_ATUAL)) return false;
  try {
    const resposta = await fetch(`${BASE}version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!resposta.ok) return false;
    const publicada = ((await resposta.json()) as { versao?: unknown } | null)?.versao;
    return typeof publicada === "string" && maisNova(publicada, VERSAO_ATUAL);
  } catch {
    return false;
  }
}

function esperar(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function aguardarEstado(worker: ServiceWorker, alvos: ServiceWorkerState[], ms: number): Promise<ServiceWorkerState> {
  return new Promise((resolve) => {
    if (alvos.includes(worker.state)) {
      resolve(worker.state);
      return;
    }
    const encerrar = () => {
      clearTimeout(limite);
      worker.removeEventListener("statechange", mudou);
      resolve(worker.state);
    };
    const mudou = () => {
      if (alvos.includes(worker.state)) encerrar();
    };
    const limite = setTimeout(encerrar, ms);
    worker.addEventListener("statechange", mudou);
  });
}

async function obterRegistro(): Promise<ServiceWorkerRegistration | undefined> {
  if (!("serviceWorker" in navigator)) return undefined;
  return navigator.serviceWorker.getRegistration(BASE).catch(() => undefined);
}

async function obterWorkerNovo(registro: ServiceWorkerRegistration): Promise<ServiceWorker | null> {
  if (registro.waiting) return registro.waiting;
  await registro.update().catch(() => {});
  if (registro.waiting) return registro.waiting;
  const instalando = registro.installing;
  if (!instalando) return null;
  const final = await aguardarEstado(instalando, ["installed", "activated", "redundant"], 60_000);
  return final === "redundant" ? null : (registro.waiting ?? null);
}

async function ativarERecarregar(worker: ServiceWorker) {
  worker.postMessage({ type: "SKIP_WAITING" });
  await aguardarEstado(worker, ["activated", "redundant"], 10_000);
  location.reload();
}

export async function aplicarAtualizacao(): Promise<boolean> {
  definirEstado("atualizando");
  const registro = await obterRegistro();
  if (!registro || !navigator.serviceWorker.controller) {
    location.reload();
    return true;
  }
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const novo = await obterWorkerNovo(registro);
    if (novo) {
      await ativarERecarregar(novo);
      return true;
    }
    await esperar(3000);
  }
  definirEstado("normal");
  return false;
}

function podeRecarregar(): boolean {
  try {
    const ultima = Number(sessionStorage.getItem(CHAVE_RECARGA) ?? 0);
    if (Date.now() - ultima < 60_000) return false;
    sessionStorage.setItem(CHAVE_RECARGA, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

export function carregarComRecuperacao<T>(carregar: () => Promise<T>): () => Promise<T> {
  return () =>
    carregar().catch(async (erro: unknown) => {
      if (!podeRecarregar()) throw erro;
      definirEstado("atualizando");
      const novo = (await obterRegistro())?.waiting;
      if (novo) await ativarERecarregar(novo);
      else location.reload();
      return new Promise<T>(() => {});
    });
}
