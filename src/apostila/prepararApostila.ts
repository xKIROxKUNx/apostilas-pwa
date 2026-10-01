import { transformarCss, transformarCssImpressao } from "./transformarCss";

export interface TituloApostila {
  id: string;
  titulo: string;
  nivel: 0 | 1;
}

export interface ApostilaPreparada {
  css: string;
  raiz: HTMLDivElement;
  titulos: TituloApostila[];
  ancoras: Element[];
}

const BLOQUEADOS =
  "script, iframe, frame, frameset, object, embed, applet, link, meta, base, form, input, button, textarea, select, option, noscript, template, style";
const ATRIBUTOS_URL = new Set(["href", "src", "xlink:href", "action", "formaction", "srcset"]);
const PROTOCOLO_PERIGOSO = /^\s*(javascript|vbscript):/i;

function colunas(tabela: HTMLTableElement): number {
  const linha = tabela.rows[0];
  if (!linha) return 0;
  return Array.from(linha.cells).reduce((soma, c) => soma + (c.colSpan || 1), 0);
}

const PREFIXO_CASO = /^\s*(\d+)\s*·\s*/;

function distribuirPerguntas(doc: Document) {
  const capitulos = new Map<number, Element>();
  for (const h1 of Array.from(doc.body.querySelectorAll(".cap > h1"))) {
    const numero = (h1.querySelector(".num")?.textContent ?? "").trim();
    if (/^\d+$/.test(numero) && h1.parentElement) capitulos.set(parseInt(numero, 10), h1.parentElement);
  }
  if (capitulos.size === 0) return;

  const grupos = new Map<Element, Element[]>();
  const origens = new Set<Element>();
  for (const cartao of Array.from(doc.body.querySelectorAll(".f.qa"))) {
    const pergunta = cartao.firstElementChild;
    const texto = pergunta?.firstChild;
    const achado = texto?.nodeType === Node.TEXT_NODE ? (texto.textContent ?? "").match(PREFIXO_CASO) : null;
    const destino = achado ? capitulos.get(parseInt(achado[1], 10)) : undefined;
    if (!texto || !destino || destino.contains(cartao)) continue;
    texto.textContent = (texto.textContent ?? "").replace(PREFIXO_CASO, "");
    if (cartao.parentElement) origens.add(cartao.parentElement);
    grupos.set(destino, [...(grupos.get(destino) ?? []), cartao]);
  }

  for (const [capitulo, cartoes] of grupos) {
    const titulo = doc.createElement("h2");
    titulo.textContent = "Perguntas-relâmpago";
    const guia = doc.createElement("p");
    guia.className = "small";
    guia.textContent = "Teste o que ficou deste capítulo: responda de cabeça antes de tocar no cartão.";
    const bloco = doc.createElement("div");
    bloco.className = "flash";
    bloco.append(...cartoes);
    capitulo.append(titulo, guia, bloco);
  }

  for (const origem of origens) {
    if (origem.children.length > 0) continue;
    let anterior = origem.previousElementSibling;
    origem.remove();
    if (anterior?.matches("p.small")) {
      const antes = anterior.previousElementSibling;
      anterior.remove();
      anterior = antes;
    }
    if (anterior?.tagName === "H2") anterior.remove();
  }
}

const LARGURA_MINIMA_FIGURA = 200;

function larguraDeclarada(midia: Element): number | null {
  const caixa = (midia.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
  if (caixa.length === 4 && caixa[2] > 0) return caixa[2];
  const largura = parseFloat(midia.getAttribute("width") ?? "");
  return Number.isFinite(largura) && largura > 0 ? largura : null;
}

function marcarFiguras(doc: Document) {
  for (const midia of Array.from(doc.body.querySelectorAll("svg, img"))) {
    if (midia.parentElement?.closest("svg") || midia.closest(".cover, a, .f.qa")) continue;
    const largura = larguraDeclarada(midia);
    if (largura !== null && largura < LARGURA_MINIMA_FIGURA) continue;
    const figura = midia.closest("figure, .fig, .figbox") ?? midia;
    if (figura.classList.contains("ap-figura")) continue;
    figura.classList.add("ap-figura");
    figura.setAttribute("tabindex", "0");
  }
}

function textoDoTitulo(el: Element): string {
  const copia = el.cloneNode(true) as Element;
  copia.querySelectorAll(".ref").forEach((r) => r.remove());
  return (copia.textContent ?? "").replace(/\s+/g, " ").trim();
}

function cssDoDocumento(doc: Document): string {
  return Array.from(doc.querySelectorAll("style"), (s) => s.textContent ?? "").join("\n");
}

function limpar(doc: Document) {
  doc.querySelectorAll(BLOQUEADOS).forEach((el) => el.remove());

  for (const el of Array.from(doc.body.querySelectorAll("*"))) {
    for (const atributo of Array.from(el.attributes)) {
      const nome = atributo.name.toLowerCase();
      if (nome.startsWith("on")) el.removeAttribute(atributo.name);
      else if (ATRIBUTOS_URL.has(nome) && PROTOCOLO_PERIGOSO.test(atributo.value)) el.removeAttribute(atributo.name);
    }
  }

  for (const a of Array.from(doc.body.querySelectorAll("a[href]"))) {
    const href = a.getAttribute("href") ?? "";
    if (href.startsWith("#")) continue;
    if (/^https?:\/\//i.test(href)) {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    } else {
      a.removeAttribute("href");
    }
  }
}

function raizDe(doc: Document): HTMLDivElement {
  const raiz = document.createElement("div");
  raiz.className = "ap-raiz";
  for (const classe of Array.from(doc.body.classList)) raiz.classList.add(classe);
  raiz.append(...Array.from(doc.body.childNodes));
  return raiz;
}

export interface ImpressaoPreparada {
  css: string;
  paginas: string;
  raiz: HTMLDivElement;
}

export function prepararImpressao(html: string): ImpressaoPreparada {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const { conteudo, paginas } = transformarCssImpressao(cssDoDocumento(doc));
  limpar(doc);
  return { css: conteudo, paginas, raiz: raizDe(doc) };
}

export function prepararApostila(html: string): ApostilaPreparada {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const css = transformarCss(cssDoDocumento(doc));
  limpar(doc);

  distribuirPerguntas(doc);
  marcarFiguras(doc);

  for (const tabela of Array.from(doc.body.querySelectorAll("table"))) {
    const caixa = doc.createElement("div");
    caixa.className = "ap-tabela";
    tabela.replaceWith(caixa);
    caixa.append(tabela);
    if (colunas(tabela) >= 4) {
      tabela.classList.add("ap-larga");
      const dica = doc.createElement("div");
      dica.className = "ap-dica-tabela";
      dica.setAttribute("aria-hidden", "true");
      caixa.before(dica);
    }
  }

  for (const cartao of Array.from(doc.body.querySelectorAll(".f.qa"))) {
    const pergunta = cartao.firstElementChild;
    if (!pergunta) continue;
    const resposta = doc.createElement("span");
    resposta.className = "ap-resposta";
    while (pergunta.nextSibling) resposta.append(pergunta.nextSibling);
    cartao.append(resposta);
    cartao.setAttribute("role", "button");
    cartao.setAttribute("tabindex", "0");
    cartao.setAttribute("aria-expanded", "false");
  }

  const titulos: TituloApostila[] = [];
  Array.from(doc.body.querySelectorAll("h1, h2")).forEach((el, i) => {
    const titulo = textoDoTitulo(el);
    if (!titulo) return;
    if (!el.id) el.id = `ap-t${i}`;
    titulos.push({ id: el.id, titulo, nivel: el.tagName === "H1" ? 0 : 1 });
  });

  const raiz = raizDe(doc);

  const ancoras = Array.from(raiz.querySelectorAll(":scope > * > *:not(.ap-dica-tabela)"));
  return { css, raiz, titulos, ancoras: ancoras.length > 0 ? ancoras : Array.from(raiz.children) };
}
