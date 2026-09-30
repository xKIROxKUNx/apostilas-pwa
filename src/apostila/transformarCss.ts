function fechamento(css: string, abre: number): number {
  let profundidade = 0;
  for (let i = abre; i < css.length; i++) {
    if (css[i] === "{") profundidade++;
    else if (css[i] === "}" && --profundidade === 0) return i;
  }
  return css.length;
}

function mapearSeletor(seletor: string): string {
  return seletor
    .split(",")
    .map((s) =>
      s
        .trim()
        .replace(/:root\b/g, ":host")
        .replace(/^html\s+body\b/, "body")
        .replace(/^(html|body)\b/, ".ap-raiz"),
    )
    .join(", ");
}

function processar(css: string): string {
  let saida = "";
  let i = 0;
  while (i < css.length) {
    const abre = css.indexOf("{", i);
    if (abre === -1) break;
    const fecha = fechamento(css, abre);
    const segmento = css.slice(i, abre);
    const cabecalho = segmento.slice(segmento.lastIndexOf(";") + 1).trim();
    const corpo = css.slice(abre + 1, fecha);
    i = fecha + 1;

    if (!cabecalho) continue;
    if (cabecalho.startsWith("@")) {
      const regra = cabecalho.toLowerCase();
      if (regra.startsWith("@page") || regra.startsWith("@font-face") || /^@media\s+print\b/.test(regra)) continue;
      if (regra.startsWith("@media") || regra.startsWith("@supports") || regra.startsWith("@container")) {
        saida += `${cabecalho}{${processar(corpo)}}\n`;
      } else {
        saida += `${cabecalho}{${corpo}}\n`;
      }
      continue;
    }
    saida += `${mapearSeletor(cabecalho)}{${corpo}}\n`;
  }
  return saida;
}

export function transformarCss(css: string): string {
  return processar(css.replace(/\/\*[\s\S]*?\*\//g, ""));
}
