import type {
  Dificuldade,
  Escopo,
  ItemRef,
  QuestaoDiscursiva,
  RespostaDiscursiva,
  Simulado,
  Tentativa,
} from "./types";

export interface Placar {
  acertos: number;
  total: number;
}

export interface Resultado {
  objetivas: Placar;
  respondidas: number;
  porDificuldade: Record<Dificuldade, Placar>;
  porGrupo: Array<{ id: string; titulo: string; placar: Placar }>;
  capitulosComErro: Array<{ referencia: string; erros: number }>;
  parteI: Placar;
  parteII: Placar;
  discursivas: { corrigidas: number; total: number; pontos: number; maximo: number };
  erros: number[];
}

export const ROTULO_DIFICULDADE: Record<Dificuldade, string> = {
  facil: "Fácil",
  media: "Média",
  dificil: "Difícil",
};

export function chaveItem(item: ItemRef): string {
  return item.tipo === "objetiva" ? String(item.numero) : item.id;
}

export function porcentagem({ acertos, total }: Placar): number {
  return total > 0 ? Math.round((acertos / total) * 100) : 0;
}

export function itensDoEscopo(simulado: Simulado, escopo: Escopo): ItemRef[] {
  const objetivas = (numeros: number[]): ItemRef[] => numeros.map((numero) => ({ tipo: "objetiva", numero }));
  const discursivas = (ids: string[]): ItemRef[] => ids.map((id) => ({ tipo: "discursiva", id }));

  switch (escopo.tipo) {
    case "tudo":
      return [
        ...objetivas(simulado.objetivas.map((q) => q.numero)),
        ...discursivas(simulado.discursivas.map((d) => d.id)),
      ];
    case "bloco": {
      const bloco = simulado.blocos.find((b) => b.id === escopo.id);
      return bloco ? [...objetivas(bloco.objetivas), ...discursivas(bloco.discursivas)] : [];
    }
    case "secao":
      return [
        ...objetivas(simulado.objetivas.filter((q) => q.secao === escopo.id).map((q) => q.numero)),
        ...discursivas(simulado.discursivas.filter((d) => d.secao === escopo.id).map((d) => d.id)),
      ];
    case "erros":
      return objetivas(escopo.numeros);
  }
}

export function minutosSugeridos(simulado: Simulado, itens: ItemRef[]): number {
  return itens.reduce(
    (soma, item) =>
      soma + (item.tipo === "objetiva" ? simulado.minutosPorObjetiva : simulado.minutosPorDiscursiva),
    0,
  );
}

export function notaDiscursiva(questao: QuestaoDiscursiva, resposta?: RespostaDiscursiva): number | null {
  if (!resposta || resposta.correcao.length !== questao.espelho.length) return null;
  if (resposta.correcao.some((c) => c === null)) return null;
  return questao.espelho.reduce((soma, criterio, i) => soma + criterio.pontos * (resposta.correcao[i] ?? 0), 0);
}

export function calcularResultado(simulado: Simulado, tentativa: Tentativa): Resultado {
  const parteDaSecao = new Map(simulado.secoes.map((s) => [s.id, s.parte]));
  const questaoPorNumero = new Map(simulado.objetivas.map((q) => [q.numero, q]));
  const discursivaPorId = new Map(simulado.discursivas.map((d) => [d.id, d]));

  const vazio = (): Placar => ({ acertos: 0, total: 0 });
  const resultado: Resultado = {
    objetivas: vazio(),
    respondidas: 0,
    porDificuldade: { facil: vazio(), media: vazio(), dificil: vazio() },
    porGrupo: [],
    capitulosComErro: [],
    parteI: vazio(),
    parteII: vazio(),
    discursivas: { corrigidas: 0, total: 0, pontos: 0, maximo: 0 },
    erros: [],
  };

  const acertou = new Map<number, boolean>();
  const errosPorCapitulo = new Map<string, number>();

  for (const item of tentativa.itens) {
    if (item.tipo === "discursiva") {
      const questao = discursivaPorId.get(item.id);
      if (!questao) continue;
      resultado.discursivas.total++;
      const nota = notaDiscursiva(questao, tentativa.discursivas[item.id]);
      if (nota !== null) {
        resultado.discursivas.corrigidas++;
        resultado.discursivas.pontos += nota;
        resultado.discursivas.maximo += questao.pontos;
      }
      continue;
    }

    const questao = questaoPorNumero.get(item.numero);
    if (!questao) continue;
    const resposta = tentativa.respostas[item.numero];
    const certo = resposta === questao.gabarito;
    acertou.set(item.numero, certo);

    if (resposta) resultado.respondidas++;
    const somar = (placar: Placar) => {
      placar.total++;
      if (certo) placar.acertos++;
    };
    somar(resultado.objetivas);
    somar(resultado.porDificuldade[questao.dificuldade]);
    const parte = parteDaSecao.get(questao.secao);
    if (parte === "I") somar(resultado.parteI);
    if (parte === "II") somar(resultado.parteII);

    if (!certo) {
      resultado.erros.push(item.numero);
      if (questao.referencia) {
        errosPorCapitulo.set(questao.referencia, (errosPorCapitulo.get(questao.referencia) ?? 0) + 1);
      }
    }
  }

  for (const grupo of simulado.diagnostico) {
    const placar = vazio();
    for (const numero of grupo.objetivas) {
      const certo = acertou.get(numero);
      if (certo === undefined) continue;
      placar.total++;
      if (certo) placar.acertos++;
    }
    if (placar.total > 0) resultado.porGrupo.push({ id: grupo.id, titulo: grupo.titulo, placar });
  }

  resultado.capitulosComErro = [...errosPorCapitulo.entries()]
    .map(([referencia, erros]) => ({ referencia, erros }))
    .sort((a, b) => b.erros - a.erros || a.referencia.localeCompare(b.referencia, "pt-BR", { numeric: true }));

  return resultado;
}

export function descreverReferencia(referencia: string): string {
  const [caso, capitulo] = referencia.split("·").map((p) => p.trim());
  if (!capitulo) return referencia;
  const plural = /[–,-]/.test(capitulo);
  return `Caso ${caso} · ${plural ? "caps." : "cap."} ${capitulo}`;
}

export function formatarDuracao(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  if (totalMin < 1) return `${Math.max(0, Math.floor(ms / 1000))} s`;
  const horas = Math.floor(totalMin / 60);
  const minutos = totalMin % 60;
  if (horas === 0) return `${minutos} min`;
  return `${horas} h ${String(minutos).padStart(2, "0")} min`;
}
