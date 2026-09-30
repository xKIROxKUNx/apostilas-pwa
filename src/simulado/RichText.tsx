import { Fragment, createElement, useMemo } from "react";

const TAGS_PERMITIDAS: Record<string, string> = {
  B: "b",
  STRONG: "strong",
  I: "i",
  EM: "em",
  SUB: "sub",
  SUP: "sup",
  P: "p",
  OL: "ol",
  UL: "ul",
  LI: "li",
};

function converter(no: Node, chave: number): React.ReactNode {
  if (no.nodeType === Node.TEXT_NODE) return no.textContent;
  if (no.nodeType !== Node.ELEMENT_NODE) return null;
  const elemento = no as Element;
  if (elemento.tagName === "BR") return <br key={chave} />;
  const filhos = Array.from(elemento.childNodes, converter);
  const tag = TAGS_PERMITIDAS[elemento.tagName];
  return tag ? createElement(tag, { key: chave }, filhos) : <Fragment key={chave}>{filhos}</Fragment>;
}

interface RichTextProps {
  html: string;
  as?: "div" | "span";
  className?: string;
}

export default function RichText({ html, as = "div", className }: RichTextProps) {
  const conteudo = useMemo(() => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return Array.from(doc.body.childNodes, converter);
  }, [html]);
  return createElement(as, { className }, conteudo);
}
