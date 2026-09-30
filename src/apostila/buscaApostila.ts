export interface IndiceTexto {
  texto: string;
  dobrado: string;
  nos: Text[];
  inicios: number[];
}

export interface Ocorrencia {
  range: Range;
  trecho: string;
  destaqueInicio: number;
  destaqueFim: number;
}

const MAX_OCORRENCIAS = 500;
const CONTEXTO = 48;
const BLOCOS = "p, li, td, th, caption, figcaption, h1, h2, h3, h4, h5, h6, dt, dd, blockquote, div, .tag, .chain > span";

function dobrar(texto: string): string {
  let saida = "";
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c < "\u0080") {
      saida += c.toLowerCase();
      continue;
    }
    const base = c.normalize("NFD")[0] ?? c;
    saida += base.toLowerCase()[0] ?? base;
  }
  return saida;
}

export function criarIndice(raiz: Element): IndiceTexto {
  const walker = raiz.ownerDocument.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  const nos: Text[] = [];
  const inicios: number[] = [];
  let texto = "";
  let blocoAnterior: Element | null = null;
  while (walker.nextNode()) {
    const no = walker.currentNode as Text;
    const bloco = no.parentElement?.closest(BLOCOS) ?? null;
    if (texto && bloco !== blocoAnterior && !/\s$/.test(texto)) texto += " ";
    blocoAnterior = bloco;
    nos.push(no);
    inicios.push(texto.length);
    texto += no.data;
  }
  return { texto, dobrado: dobrar(texto), nos, inicios };
}

function localizar(indice: IndiceTexto, posicao: number): { no: Text; deslocamento: number } {
  let baixo = 0;
  let alto = indice.inicios.length - 1;
  while (baixo < alto) {
    const meio = (baixo + alto + 1) >> 1;
    if (indice.inicios[meio] <= posicao) baixo = meio;
    else alto = meio - 1;
  }
  return { no: indice.nos[baixo], deslocamento: posicao - indice.inicios[baixo] };
}

export function buscar(indice: IndiceTexto, consulta: string): Ocorrencia[] {
  const termo = dobrar(consulta.trim().replace(/\s+/g, " "));
  if (termo.length < 2 || indice.nos.length === 0) return [];
  const ocorrencias: Ocorrencia[] = [];
  let de = 0;
  while (ocorrencias.length < MAX_OCORRENCIAS) {
    const pos = indice.dobrado.indexOf(termo, de);
    if (pos === -1) break;
    const fim = pos + termo.length;
    const inicio = localizar(indice, pos);
    const termino = localizar(indice, fim - 1);
    const range = document.createRange();
    range.setStart(inicio.no, inicio.deslocamento);
    range.setEnd(termino.no, termino.deslocamento + 1);

    const a = Math.max(0, pos - CONTEXTO);
    const b = Math.min(indice.texto.length, fim + CONTEXTO);
    const prefixo = a > 0 ? "…" : "";
    const antes = indice.texto.slice(a, pos).replace(/\s+/g, " ");
    const achado = indice.texto.slice(pos, fim).replace(/\s+/g, " ");
    const depois = indice.texto.slice(fim, b).replace(/\s+/g, " ");
    ocorrencias.push({
      range,
      trecho: prefixo + antes + achado + depois + (b < indice.texto.length ? "…" : ""),
      destaqueInicio: prefixo.length + antes.length,
      destaqueFim: prefixo.length + antes.length + achado.length,
    });
    de = fim;
  }
  return ocorrencias;
}

const REGISTRO = "ap-busca";
const REGISTRO_ATUAL = "ap-busca-atual";

export function suportaDestaque(): boolean {
  return typeof CSS !== "undefined" && "highlights" in CSS && typeof Highlight !== "undefined";
}

export function destacar(ocorrencias: Ocorrencia[], atual: number) {
  if (!suportaDestaque()) return;
  CSS.highlights.set(REGISTRO, new Highlight(...ocorrencias.map((o) => o.range)));
  const escolhida = ocorrencias[atual];
  if (escolhida) CSS.highlights.set(REGISTRO_ATUAL, new Highlight(escolhida.range));
  else CSS.highlights.delete(REGISTRO_ATUAL);
}

export function limparDestaque() {
  if (!suportaDestaque()) return;
  CSS.highlights.delete(REGISTRO);
  CSS.highlights.delete(REGISTRO_ATUAL);
}
