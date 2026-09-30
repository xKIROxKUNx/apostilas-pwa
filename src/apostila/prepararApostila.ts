import { transformarCss } from "./transformarCss";

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

function textoDoTitulo(el: Element): string {
  const copia = el.cloneNode(true) as Element;
  copia.querySelectorAll(".ref").forEach((r) => r.remove());
  return (copia.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function prepararApostila(html: string): ApostilaPreparada {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const css = transformarCss(Array.from(doc.querySelectorAll("style"), (s) => s.textContent ?? "").join("\n"));

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

  const raiz = document.createElement("div");
  raiz.className = "ap-raiz";
  for (const classe of Array.from(doc.body.classList)) raiz.classList.add(classe);
  raiz.append(...Array.from(doc.body.childNodes));

  const ancoras = Array.from(raiz.querySelectorAll(":scope > * > *:not(.ap-dica-tabela)"));
  return { css, raiz, titulos, ancoras: ancoras.length > 0 ? ancoras : Array.from(raiz.children) };
}
