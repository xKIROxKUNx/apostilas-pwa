import { useCallback, useMemo, useState } from "react";
import type { Apostila } from "@/types/domain";

const PREFIXO_CHAVE = "apostilas-unidade:";

interface Escolha {
  unidade: number;
  padrao: number;
}

function lerEscolha(chave: string): Escolha | null {
  try {
    const valor = JSON.parse(localStorage.getItem(chave) ?? "null") as Partial<Escolha> | null;
    return typeof valor?.unidade === "number" && typeof valor.padrao === "number"
      ? { unidade: valor.unidade, padrao: valor.padrao }
      : null;
  } catch {
    return null;
  }
}

function gravarEscolha(chave: string, escolha: Escolha) {
  try {
    localStorage.setItem(chave, JSON.stringify(escolha));
  } catch {
    return;
  }
}

export function useUnidade(apostilas: Apostila[], uid: string) {
  const chave = `${PREFIXO_CHAVE}${uid}`;
  const [escolha, setEscolha] = useState(() => lerEscolha(chave));

  const unidades = useMemo(
    () => [...new Set(apostilas.flatMap((a) => (a.unidade === null ? [] : [a.unidade])))].sort((a, b) => a - b),
    [apostilas],
  );
  const padrao = unidades.length > 0 ? unidades[unidades.length - 1] : null;
  const selecionada =
    padrao === null
      ? null
      : escolha && escolha.padrao === padrao && unidades.includes(escolha.unidade)
        ? escolha.unidade
        : padrao;

  const selecionar = useCallback(
    (unidade: number) => {
      if (padrao === null) return;
      const nova = { unidade, padrao };
      gravarEscolha(chave, nova);
      setEscolha(nova);
    },
    [chave, padrao],
  );

  return { unidades, selecionada, selecionar };
}
