import type { Simulado } from "./types";

const LETRAS = ["A", "B", "C", "D", "E"];

function falha(motivo: string): never {
  throw new Error(`Arquivo de simulado inválido: ${motivo}.`);
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function textoOuNulo(valor: unknown): string | null {
  return typeof valor === "string" && valor.length > 0 ? valor : null;
}

export function parseSimulado(dados: unknown): Simulado {
  if (!ehObjeto(dados) || dados.versao !== 1) falha("versão não suportada");
  const { secoes, objetivas, discursivas } = dados;
  if (!Array.isArray(secoes) || !Array.isArray(objetivas) || !Array.isArray(discursivas)) {
    falha("listas de seções e questões ausentes");
  }

  const idsSecao = new Set<string>();
  for (const secao of secoes) {
    if (!ehObjeto(secao) || typeof secao.id !== "string" || typeof secao.titulo !== "string") {
      falha("seção sem identificação");
    }
    idsSecao.add(secao.id);
  }

  for (const q of objetivas) {
    if (!ehObjeto(q) || typeof q.numero !== "number" || typeof q.enunciado !== "string") {
      falha("questão objetiva malformada");
    }
    if (typeof q.secao !== "string" || !idsSecao.has(q.secao)) {
      falha(`questão ${q.numero} aponta para uma seção inexistente`);
    }
    if (!Array.isArray(q.alternativas) || q.alternativas.length < 2) {
      falha(`questão ${q.numero} sem alternativas`);
    }
    const letras = q.alternativas.map((a) => (ehObjeto(a) && typeof a.texto === "string" ? a.letra : null));
    if (typeof q.gabarito !== "string" || !LETRAS.includes(q.gabarito) || !letras.includes(q.gabarito)) {
      falha(`questão ${q.numero} com gabarito inválido`);
    }
  }

  for (const d of discursivas) {
    if (!ehObjeto(d) || typeof d.id !== "string" || typeof d.enunciado !== "string" || !Array.isArray(d.espelho)) {
      falha("questão discursiva malformada");
    }
    if (typeof d.secao !== "string" || !idsSecao.has(d.secao)) {
      falha(`discursiva ${d.id} aponta para uma seção inexistente`);
    }
  }

  return {
    ...(dados as unknown as Simulado),
    titulo: typeof dados.titulo === "string" ? dados.titulo : "Simulado",
    minutosPorObjetiva: typeof dados.minutosPorObjetiva === "number" ? dados.minutosPorObjetiva : 2,
    minutosPorDiscursiva: typeof dados.minutosPorDiscursiva === "number" ? dados.minutosPorDiscursiva : 10,
    limiarPontoFraco: typeof dados.limiarPontoFraco === "number" ? dados.limiarPontoFraco : 60,
    agrupamento: dados.agrupamento === "capitulo" ? "capitulo" : "caso",
    orientacaoCorrecao: textoOuNulo(dados.orientacaoCorrecao),
    orientacaoGabarito: textoOuNulo(dados.orientacaoGabarito),
    orientacaoEspelho: textoOuNulo(dados.orientacaoEspelho),
    orientacaoPosCorrecao: textoOuNulo(dados.orientacaoPosCorrecao),
    blocos: Array.isArray(dados.blocos) ? (dados.blocos as Simulado["blocos"]) : [],
    diagnostico: Array.isArray(dados.diagnostico) ? (dados.diagnostico as Simulado["diagnostico"]) : [],
  };
}
