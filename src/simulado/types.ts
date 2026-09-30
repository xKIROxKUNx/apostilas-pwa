export type Letra = "A" | "B" | "C" | "D" | "E";
export type Dificuldade = "facil" | "media" | "dificil";
export type Parte = "I" | "II" | "III";

export interface CasoIntegrado {
  titulo: string;
  casos: string;
  texto: string;
}

export interface Secao {
  id: string;
  parte: Parte;
  titulo: string;
  casoIntegrado?: CasoIntegrado;
}

export interface Alternativa {
  letra: Letra;
  texto: string;
}

export interface QuestaoObjetiva {
  numero: number;
  secao: string;
  dificuldade: Dificuldade;
  tema: string;
  caso?: string;
  enunciado: string;
  alternativas: Alternativa[];
  gabarito: Letra;
  justificativa: string;
  referencia: string;
}

export interface CriterioEspelho {
  texto: string;
  pontos: number;
}

export interface QuestaoDiscursiva {
  id: string;
  secao: string;
  dificuldade: Dificuldade;
  tema: string;
  caso?: string;
  enunciado: string;
  referencia: string;
  espelho: CriterioEspelho[];
  pontos: number;
}

export interface GrupoDiagnostico {
  id: string;
  titulo: string;
  objetivas: number[];
  discursivas: string[];
}

export interface Bloco {
  id: string;
  titulo: string;
  descricao: string;
  objetivas: number[];
  discursivas: string[];
}

export interface Simulado {
  versao: 1;
  titulo: string;
  tempoSugerido?: string;
  minutosPorObjetiva: number;
  minutosPorDiscursiva: number;
  limiarPontoFraco: number;
  orientacaoCorrecao: string | null;
  orientacaoGabarito: string | null;
  orientacaoEspelho: string | null;
  orientacaoPosCorrecao: string | null;
  secoes: Secao[];
  blocos: Bloco[];
  objetivas: QuestaoObjetiva[];
  discursivas: QuestaoDiscursiva[];
  diagnostico: GrupoDiagnostico[];
}

export type ItemRef = { tipo: "objetiva"; numero: number } | { tipo: "discursiva"; id: string };

export type Modo = "treino" | "prova";

export type Escopo =
  | { tipo: "tudo" }
  | { tipo: "bloco"; id: string }
  | { tipo: "secao"; id: string }
  | { tipo: "erros"; numeros: number[] };

export type FracaoCriterio = 0 | 0.5 | 1;

export interface RespostaDiscursiva {
  texto: string;
  correcao: (FracaoCriterio | null)[];
}

export interface Tentativa {
  id: string;
  modo: Modo;
  escopo: Escopo;
  escopoTitulo: string;
  itens: ItemRef[];
  indice: number;
  respostas: Record<number, Letra>;
  riscadas: Record<number, Letra[]>;
  marcadas: string[];
  discursivas: Record<string, RespostaDiscursiva>;
  iniciadaEm: number;
  tempoMs: number;
  finalizadaEm?: number;
}

export interface ResumoTentativa {
  id: string;
  modo: Modo;
  escopoTitulo: string;
  finalizadaEm: number;
  acertos: number;
  total: number;
  tempoMs: number;
  erros: number[];
}

export interface RegistroSimulado {
  atual: Tentativa | null;
  historico: ResumoTentativa[];
}
