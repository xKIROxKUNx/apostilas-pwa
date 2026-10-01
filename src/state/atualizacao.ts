import { useSyncExternalStore } from "react";

const BASE = import.meta.env.BASE_URL;
const CHAVE_RECARGA = "apostilas-recarga";
const CHAVE_ALVO = "apostilas-alvo";
const CHAVE_FALHA = "apostilas-atualizacao-falhou";
export const VERSAO_ATUAL: string = import.meta.env.VITE_APP_VERSION ?? "dev";

type EstadoAtualizacao = "normal" | "atualizando";
type Etapa = "suave" | "forte";

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

function ler(chave: string): string | null {
  try {
    return sessionStorage.getItem(chave);
  } catch {
    return null;
  }
}

function gravar(chave: string, valor: string | null) {
  try {
    if (valor === null) sessionStorage.removeItem(chave);
    else sessionStorage.setItem(chave, valor);
  } catch {
    return;
  }
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

function esperar(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function buscarVersaoPublicada(): Promise<string | null> {
  try {
    const resposta = await fetch(`${BASE}version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!resposta.ok) return null;
    const publicada = ((await resposta.json()) as { versao?: unknown } | null)?.versao;
    return typeof publicada === "string" && numeros(publicada) ? publicada : null;
  } catch {
    return null;
  }
}

export async function haVersaoMaisNova(): Promise<boolean> {
  if (!numeros(VERSAO_ATUAL)) return false;
  let publicada = await buscarVersaoPublicada();
  if (publicada === null) {
    await esperar(5000);
    publicada = await buscarVersaoPublicada();
  }
  return publicada !== null && maisNova(publicada, VERSAO_ATUAL);
}

export function atualizacaoFalhou(): boolean {
  const versao = ler(CHAVE_FALHA);
  return versao !== null && maisNova(versao, VERSAO_ATUAL);
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
      navigator.serviceWorker.removeEventListener("controllerchange", encerrar);
      resolve(worker.state);
    };
    const mudou = () => {
      if (alvos.includes(worker.state)) encerrar();
    };
    const limite = setTimeout(encerrar, ms);
    worker.addEventListener("statechange", mudou);
    if (alvos.includes("activated")) navigator.serviceWorker.addEventListener("controllerchange", encerrar);
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

function eDesteApp(escopoOuCache: string): boolean {
  return escopoOuCache.includes(`${location.origin}${BASE}`);
}

async function removerRegistros() {
  try {
    for (const registro of await navigator.serviceWorker.getRegistrations()) {
      if (eDesteApp(registro.scope)) await registro.unregister();
    }
  } catch {
    return;
  }
}

async function removerCaches() {
  try {
    for (const nome of await caches.keys()) {
      if (eDesteApp(nome)) await caches.delete(nome);
    }
  } catch {
    return;
  }
}

async function atualizarSemServiceWorker() {
  await removerRegistros();
  await removerCaches();
  location.reload();
}

function marcarAlvo(versao: string, etapa: Etapa) {
  gravar(CHAVE_ALVO, JSON.stringify({ versao, etapa }));
}

export async function aplicarAtualizacao(): Promise<void> {
  definirEstado("atualizando");
  gravar(CHAVE_FALHA, null);
  const alvo = await buscarVersaoPublicada();
  if (alvo) marcarAlvo(alvo, "suave");
  const registro = await obterRegistro();
  if (registro && navigator.serviceWorker.controller) {
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      const novo = await obterWorkerNovo(registro);
      if (novo) {
        await ativarERecarregar(novo);
        return;
      }
      await esperar(2000);
    }
  }
  if (alvo) marcarAlvo(alvo, "forte");
  await atualizarSemServiceWorker();
}

export function retomarAtualizacao(): boolean {
  const bruto = ler(CHAVE_ALVO);
  if (!bruto) return false;
  gravar(CHAVE_ALVO, null);
  let marca: { versao?: unknown; etapa?: unknown } | null = null;
  try {
    marca = JSON.parse(bruto);
  } catch {
    return false;
  }
  if (typeof marca?.versao !== "string" || !maisNova(marca.versao, VERSAO_ATUAL)) return false;
  if (marca.etapa === "suave") {
    marcarAlvo(marca.versao, "forte");
    const aviso = document.querySelector(".ci p");
    if (aviso) aviso.textContent = "Atualizando…";
    void atualizarSemServiceWorker();
    return true;
  }
  gravar(CHAVE_FALHA, marca.versao);
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
