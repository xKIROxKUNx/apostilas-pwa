import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import cssImpressao from "./impressao.css?inline";
import { prepararImpressao } from "./prepararApostila";
import { motorWebKit } from "./motor";

const TITULAR = "Pedro Lucas Oliveira Cerqueira";
const PRIMEIRO_ANO = 2026;
const PAGINA_BASE = "@page { size: A4; margin: 15mm; }";
const PAGINA_FINAL =
  "@page { size: A4; }\n@page ap-creditos { @top-left { content: none; } @top-center { content: none; } @top-right { content: none; } }";

function hoje(): string {
  return new Date().toLocaleDateString("pt-BR");
}

function anos(): string {
  const atual = new Date().getFullYear();
  return atual > PRIMEIRO_ANO ? `${PRIMEIRO_ANO}–${atual}` : String(PRIMEIRO_ANO);
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, classe: string | null, ...filhos: (Node | string)[]) {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  elemento.append(...filhos);
  return elemento;
}

function criarCreditos(titulo: string, componente: string, email: string) {
  const data = el("span", null, hoje());
  const pagina = el(
    "section",
    "ap-creditos",
    el("p", "ap-creditos__selo", "Cópia de uso pessoal"),
    el("h2", "ap-creditos__titulo", titulo),
    el("p", "ap-creditos__componente", componente),
    el("p", "ap-creditos__assinante", "Licenciada para ", el("strong", null, email || "o assinante"), el("br", null), "Impressa em ", data),
    el(
      "div",
      "ap-creditos__aviso",
      el(
        "p",
        null,
        el("strong", null, "Venda proibida."),
        " Este material é de uso pessoal e exclusivo do assinante. É proibido vender, revender, copiar, redistribuir ou compartilhar este conteúdo, no todo ou em parte, por qualquer meio, impresso ou digital.",
      ),
      el(
        "p",
        null,
        "Obra protegida pela Lei nº 9.610/1998 (Lei de Direitos Autorais). A violação de direito autoral é crime previsto no art. 184 do Código Penal.",
      ),
    ),
    el(
      "p",
      "ap-creditos__rodape",
      `Apostilas App · distribuído por ${TITULAR}`,
      el("br", null),
      `© ${anos()} ${TITULAR}. Todos os direitos reservados.`,
    ),
  );
  return { pagina, data };
}

interface ImpressaoApostilaProps {
  html: string;
  titulo: string;
  componente: string;
  email: string;
}

export default function ImpressaoApostila({ html, titulo, componente, email }: ImpressaoApostilaProps) {
  const preparado = useMemo(() => prepararImpressao(html), [html]);
  const hostRef = useRef<HTMLDivElement>(null);
  const [conteiner] = useState(() => {
    const div = document.createElement("div");
    div.id = "print-portal";
    return div;
  });

  useLayoutEffect(() => {
    document.body.prepend(conteiner);
    return () => conteiner.remove();
  }, [conteiner]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const sombra = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    const estilo = document.createElement("style");
    estilo.textContent = `${preparado.css}\n${cssImpressao}`;

    const raiz = preparado.raiz;
    if (motorWebKit()) raiz.dataset.motor = "webkit";
    raiz.querySelector(".ap-creditos")?.remove();
    const { pagina, data } = criarCreditos(titulo, componente, email);
    const capa = raiz.querySelector(".cover");
    if (capa) capa.after(pagina);
    else raiz.prepend(pagina);
    sombra.replaceChildren(estilo, raiz);

    const atualizarData = () => {
      data.textContent = hoje();
    };
    window.addEventListener("beforeprint", atualizarData);
    return () => window.removeEventListener("beforeprint", atualizarData);
  }, [preparado, titulo, componente, email]);

  useEffect(() => {
    const estilo = document.createElement("style");
    estilo.media = "print";
    estilo.textContent = `${PAGINA_BASE}\n${preparado.paginas}\n${PAGINA_FINAL}`;
    document.head.append(estilo);
    return () => estilo.remove();
  }, [preparado]);

  return createPortal(<div ref={hostRef} />, conteiner);
}
