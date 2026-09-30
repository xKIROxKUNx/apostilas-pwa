import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const USO = "Uso: node scripts/simulado-html-para-json.mjs <arquivo.html> [-o saida.json]";

const TAGS_PERMITIDAS = new Set(["b", "strong", "i", "em", "sub", "sup", "br", "p", "ol", "ul", "li"]);
const LETRAS = ["A", "B", "C", "D", "E"];

const erros = [];
const avisos = [];

function decodificar(texto) {
  return texto
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function textoPuro(html) {
  return decodificar(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function htmlLimpo(html) {
  return html
    .replace(/<span class="ref-grp">[\s\S]*?<\/span>/g, "")
    .replace(/<\/?([a-zA-Z0-9]+)[^>]*>/g, (tag, nome) => {
      const n = nome.toLowerCase();
      if (!TAGS_PERMITIDAS.has(n)) return "";
      return tag.startsWith("</") ? `</${n}>` : n === "br" ? "<br>" : `<${n}>`;
    })
    .replace(/\s+/g, " ")
    .trim();
}

function blocosDiv(fonte, classe) {
  const saida = [];
  const abertura = new RegExp(`<div class="${classe}"(?: id="([^"]*)")?>`, "g");
  let m;
  while ((m = abertura.exec(fonte))) {
    let i = m.index + m[0].length;
    let profundidade = 1;
    while (profundidade > 0) {
      const abre = fonte.indexOf("<div", i);
      const fecha = fonte.indexOf("</div>", i);
      if (fecha === -1) throw new Error(`<div class="${classe}"> sem fechamento`);
      if (abre !== -1 && abre < fecha) {
        profundidade++;
        i = abre + 4;
      } else {
        profundidade--;
        i = fecha + 6;
      }
    }
    saida.push({ id: m[1] ?? null, html: fonte.slice(m.index, i), interno: fonte.slice(m.index + m[0].length, i - 6) });
  }
  return saida;
}

function primeiro(re, fonte, padrao = null) {
  const m = fonte.match(re);
  return m ? m[1] : padrao;
}

function dificuldade(rotulo, onde) {
  const r = textoPuro(rotulo).toLowerCase();
  if (r.startsWith("fác") || r.startsWith("fac")) return "facil";
  if (r.startsWith("méd") || r.startsWith("med")) return "media";
  if (r.startsWith("difí") || r.startsWith("dific")) return "dificil";
  erros.push(`${onde}: dificuldade desconhecida "${rotulo}"`);
  return "media";
}

function intervalo(texto) {
  const numeros = [];
  for (const parte of textoPuro(texto).split(",")) {
    const [a, b = a] = parte.split(/[–-]/).map((x) => parseInt(x.trim(), 10));
    if (Number.isNaN(a) || Number.isNaN(b)) continue;
    for (let n = a; n <= b; n++) numeros.push(n);
  }
  return numeros;
}

function cabecalhos(fonte) {
  return [...fonte.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => textoPuro(m[1]));
}

function caixa(fonte, rotulo) {
  for (const bx of blocosDiv(fonte, "bx info").concat(blocosDiv(fonte, "bx warn"))) {
    const lbl = primeiro(/<div class="lbl">([\s\S]*?)<\/div>/, bx.interno, "");
    if (textoPuro(lbl).toLowerCase().startsWith(rotulo)) {
      return htmlLimpo(bx.interno.replace(/<div class="lbl">[\s\S]*?<\/div>/, ""));
    }
  }
  return null;
}

function converter(fonte) {
  const corpo = primeiro(/<body>([\s\S]*)<\/body>/, fonte, fonte);
  const secoesHtml = blocosDiv(corpo, "sec").concat(blocosDiv(corpo, "sec gab"));
  const secaoPorId = new Map(secoesHtml.map((s) => [s.id, s]));

  const capa = blocosDiv(corpo, "cover")[0]?.interno ?? "";
  const titulo = textoPuro(primeiro(/<div class="subtitle">([\s\S]*?)<\/div>/, capa, "Simulado"));
  const tempoSugerido = primeiro(/Tempo sugerido:\s*([^<·]+)/, capa);

  const instr = secaoPorId.get("instr")?.interno ?? "";
  const minutos = [...instr.matchAll(/(\d+(?:[.,]\d+)?)\s*min\/questão/g)].map((m) => Number(m[1].replace(",", ".")));
  const minutosPorObjetiva = minutos[0] ?? 2;
  const minutosPorDiscursiva = minutos.length > 1 ? minutos[minutos.length - 1] : 10;

  const gabaritoHtml = secaoPorId.get("gabarito")?.interno ?? "";
  const linhasGabarito = new Map();
  const reLinha = /<tr><td class="k">(\d+)<\/td><td class="k">([A-E])<\/td><td>([\s\S]*?)<\/td><td class="c">([^<]*)<\/td><td class="c">([^<]*)<\/td><\/tr>/g;
  for (const m of gabaritoHtml.matchAll(reLinha)) {
    linhasGabarito.set(Number(m[1]), { letra: m[2], justificativa: m[3], referencia: textoPuro(m[4]), dif: m[5] });
  }
  const gabaritoRapido = new Map(
    [...gabaritoHtml.matchAll(/<td><span>(\d+)<\/span>\s*<b>([A-E])<\/b><\/td>/g)].map((m) => [Number(m[1]), m[2]]),
  );

  const secoes = [];
  const numerosLidos = [];
  const objetivas = [];
  const discursivas = [];

  for (const sec of secoesHtml) {
    if (!sec.id || ["instr", "folha", "gabarito", "espelho", "diag", "fontes"].includes(sec.id)) continue;
    const h1 = textoPuro(primeiro(/<h1>([\s\S]*?)<\/h1>/, sec.interno, sec.id));
    const partes = h1.split("·").map((p) => p.trim());
    const parte = /^Parte III/i.test(h1) ? "III" : /^Parte II/i.test(h1) ? "II" : "I";
    const secao = { id: sec.id, parte, titulo: partes[partes.length - 1] };

    const grp = blocosDiv(sec.interno, "grp")[0];
    if (grp) {
      const lbl = primeiro(/<div class="lbl">([\s\S]*?)<\/div>/, grp.interno, "");
      secao.casoIntegrado = {
        titulo: textoPuro(lbl.replace(/<span>[\s\S]*?<\/span>/, "")),
        casos: textoPuro(primeiro(/<span>([\s\S]*?)<\/span>/, lbl, "")),
        texto: htmlLimpo(grp.interno.replace(/<div class="lbl">[\s\S]*?<\/div>/, "")),
      };
    }
    secoes.push(secao);

    for (const q of blocosDiv(sec.interno, "q").concat(blocosDiv(sec.interno, "q disc"))) {
      const cab = primeiro(/<div class="q-head">([\s\S]*?)<\/div>/, q.interno, "");
      const numeroTexto = textoPuro(primeiro(/<span class="q-num[^"]*">([\s\S]*?)<\/span>/, cab, "")).replace(/\.$/, "");
      const dif = primeiro(/<span class="chip [^"]*">([\s\S]*?)<\/span>/, cab, "");
      const tema = textoPuro(primeiro(/<span class="tag">([\s\S]*?)<\/span>/, cab, ""));
      const casoBloco = blocosDiv(q.interno, "case")[0];
      const caso = casoBloco ? htmlLimpo(casoBloco.interno.replace(/<div class="lbl">[\s\S]*?<\/div>/, "")) : undefined;
      const rotulo = casoBloco ? textoPuro(primeiro(/<div class="lbl">([\s\S]*?)<\/div>/, casoBloco.interno, "")) : "";
      const casoRotulo = rotulo && !/^caso clínico$/i.test(rotulo) ? { casoRotulo: rotulo } : {};
      const enunciado = htmlLimpo(blocosDiv(q.interno, "stem")[0]?.interno ?? "");

      if (q.html.startsWith('<div class="q disc"')) {
        discursivas.push({
          id: numeroTexto,
          secao: sec.id,
          dificuldade: dificuldade(dif, numeroTexto),
          tema,
          ...(caso ? { caso, ...casoRotulo } : {}),
          enunciado,
          referencia: "",
          espelho: [],
          pontos: 0,
        });
        continue;
      }

      const numero = Number(numeroTexto);
      const onde = `Questão ${numero}`;
      const alternativas = [...q.interno.matchAll(/<div class="alt"><span class="alt-k">([A-E])\)<\/span>([\s\S]*?)<\/div>/g)].map(
        (m) => ({ letra: m[1], texto: htmlLimpo(m[2]) }),
      );
      const letras = alternativas.map((a) => a.letra).join("");
      if (letras !== LETRAS.join("")) erros.push(`${onde}: alternativas encontradas "${letras}", esperado "ABCDE"`);
      const textos = alternativas.map((a) => textoPuro(a.texto).toLowerCase());
      if (new Set(textos).size !== textos.length) erros.push(`${onde}: alternativas repetidas`);
      numerosLidos.push(numero);

      const linha = linhasGabarito.get(numero);
      if (!linha) {
        erros.push(`${onde}: sem linha no gabarito comentado`);
        continue;
      }
      const rapido = gabaritoRapido.get(numero);
      if (rapido && rapido !== linha.letra) {
        erros.push(`${onde}: gabarito rápido diz ${rapido}, gabarito comentado diz ${linha.letra}`);
      }
      const difQuestao = dificuldade(dif, onde);
      if (dificuldade(linha.dif, `${onde} (gabarito)`) !== difQuestao) {
        avisos.push(`${onde}: dificuldade na questão (${textoPuro(dif)}) difere da do gabarito (${linha.dif})`);
      }
      const comentadasComoErradas = new Set(
        [...linha.justificativa.matchAll(/<b>([A-E])(?::<\/b>|<\/b>\s*(?:e|,)\s*<b>)/g)].map((m) => m[1]),
      );
      if (comentadasComoErradas.has(linha.letra)) {
        erros.push(`${onde}: a justificativa comenta a própria resposta (${linha.letra}) como alternativa errada`);
      }

      objetivas.push({
        numero,
        secao: sec.id,
        dificuldade: difQuestao,
        tema,
        ...(caso ? { caso, ...casoRotulo } : {}),
        enunciado,
        alternativas,
        gabarito: linha.letra,
        justificativa: htmlLimpo(linha.justificativa),
        referencia: linha.referencia,
      });
    }
  }

  const espelhoHtml = secaoPorId.get("espelho")?.interno ?? "";
  for (const esp of blocosDiv(espelhoHtml, "esp")) {
    const h3 = primeiro(/<h3>([\s\S]*?)<\/h3>/, esp.interno, "");
    const id = textoPuro(h3).split("·")[0].trim();
    const disc = discursivas.find((d) => d.id === id);
    if (!disc) {
      erros.push(`Espelho ${id}: não corresponde a nenhuma discursiva`);
      continue;
    }
    disc.referencia = textoPuro(primeiro(/(?:Caso·)?cap\.\s*([^<]+)/i, h3, ""));
    disc.espelho = [...esp.interno.matchAll(/<tr><td>([\s\S]*?)<\/td><td class="pts">([^<]+)<\/td><\/tr>/g)].map((m) => ({
      texto: htmlLimpo(m[1]),
      pontos: Number(m[2].replace(",", ".")),
    }));
    disc.pontos = disc.espelho.reduce((soma, c) => soma + c.pontos, 0);
  }
  for (const d of discursivas) {
    if (d.espelho.length === 0) erros.push(`Discursiva ${d.id}: sem espelho de correção`);
    else if (d.pontos !== 10) avisos.push(`Discursiva ${d.id}: critérios somam ${d.pontos} pontos`);
  }

  const diagHtml = secaoPorId.get("diag")?.interno ?? "";
  const agrupamento = /caso/i.test(cabecalhos(diagHtml)[0] ?? cabecalhos(gabaritoHtml)[3] ?? "") ? "caso" : "capitulo";
  const diagnostico = [];
  const reDiag = /<tr><td><b>([\s\S]*?)<\/b><\/td><td>([\s\S]*?)<\/td><td class="c">(\d+)<\/td><td>([\s\S]*?)<\/td>/g;
  for (const m of diagHtml.matchAll(reDiag)) {
    const rotulo = textoPuro(m[1]);
    const [id, ...resto] = rotulo.split("·").map((p) => p.trim());
    const nums = intervalo(m[2]);
    if (nums.length !== Number(m[3])) avisos.push(`Diagnóstico "${rotulo}": ${nums.length} questões listadas, total diz ${m[3]}`);
    diagnostico.push({
      id,
      titulo: resto.join(" · ") || rotulo,
      objetivas: nums,
      discursivas: textoPuro(m[4]).split(",").map((d) => d.trim()).filter((d) => /\w/.test(d)),
    });
  }
  if (diagnostico.length > 0) {
    const contagem = new Map();
    for (const g of diagnostico) for (const n of g.objetivas) contagem.set(n, (contagem.get(n) ?? 0) + 1);
    for (const q of objetivas) {
      const c = contagem.get(q.numero) ?? 0;
      if (c !== 1) erros.push(`Questão ${q.numero}: aparece ${c} vez(es) no diagnóstico por ${agrupamento === "caso" ? "caso" : "capítulo"}`);
    }
  }

  const blocos = [];
  const legenda = primeiro(/Sugestão:([\s\S]*?)<\/caption>/, instr, "");
  for (const m of legenda.matchAll(/bloco (\d+)<\/b>\s*=\s*([^;<]+(?:<[^>]+>[^;<]*)*?)(?:;|\.\s*$|$)/g)) {
    const descricao = textoPuro(m[2]).replace(/\.$/, "");
    const faixa = descricao.match(/(\d+)\s*a\s*(\d+)/);
    const bloco = { id: `bloco${m[1]}`, titulo: `Bloco ${m[1]}`, descricao, objetivas: [], discursivas: [] };
    if (faixa) {
      for (let n = Number(faixa[1]); n <= Number(faixa[2]); n++) bloco.objetivas.push(n);
    } else {
      if (/integrad/i.test(descricao)) {
        bloco.objetivas = objetivas.filter((q) => secoes.find((s) => s.id === q.secao)?.parte === "II").map((q) => q.numero);
      }
      if (/discursiva/i.test(descricao)) bloco.discursivas = discursivas.map((d) => d.id);
    }
    if (bloco.objetivas.length + bloco.discursivas.length > 0) blocos.push(bloco);
  }

  if (objetivas.length === 0) erros.push("Nenhuma questão objetiva encontrada");
  const discursivasNaoLidas = (corpo.match(/<div class="dq">/g) ?? []).length;
  if (discursivasNaoLidas > 0) {
    avisos.push(`${discursivasNaoLidas} bloco(s) "dq" de discursivas em formato antigo foram ignorados (só "q disc" é lido)`);
  }
  if (linhasGabarito.size !== objetivas.length) {
    avisos.push(`Gabarito comentado tem ${linhasGabarito.size} linhas para ${objetivas.length} questões`);
  }
  const foraDeOrdem = numerosLidos.findIndex((n, i) => n !== i + 1);
  if (foraDeOrdem !== -1) {
    avisos.push(
      foraDeOrdem === 0
        ? `A numeração começa em ${numerosLidos[0]}, e não em 1`
        : `Numeração fora de sequência: depois da questão ${numerosLidos[foraDeOrdem - 1]} vem a ${numerosLidos[foraDeOrdem]}`,
    );
  }
  if (objetivas.length >= 20) {
    const porLetra = new Map(LETRAS.map((l) => [l, 0]));
    for (const q of objetivas) porLetra.set(q.gabarito, porLetra.get(q.gabarito) + 1);
    const desequilibradas = [...porLetra].filter(([, n]) => n / objetivas.length > 0.3 || n / objetivas.length < 0.1);
    if (desequilibradas.length > 0) {
      avisos.push(`Respostas mal distribuídas: ${desequilibradas.map(([l, n]) => `${l} = ${n}`).join(", ")} (ideal: cerca de ${Math.round(objetivas.length / 5)} por letra)`);
    }
  }

  return {
    versao: 1,
    titulo,
    ...(tempoSugerido ? { tempoSugerido: tempoSugerido.trim() } : {}),
    minutosPorObjetiva,
    minutosPorDiscursiva,
    limiarPontoFraco: 60,
    agrupamento,
    orientacaoCorrecao: caixa(instr, "correção"),
    orientacaoGabarito: caixa(gabaritoHtml, "confira"),
    orientacaoEspelho: caixa(espelhoHtml, "como corrigir"),
    orientacaoPosCorrecao: caixa(diagHtml, "depois de corrigir"),
    secoes,
    blocos,
    objetivas,
    discursivas,
    diagnostico,
  };
}

const args = process.argv.slice(2);
const entrada = args.find((a) => !a.startsWith("-"));
if (!entrada) {
  console.error(USO);
  process.exit(2);
}
const iSaida = args.indexOf("-o");
const saida = iSaida !== -1 ? args[iSaida + 1] : join(dirname(entrada), basename(entrada).replace(/\.html?$/i, "") + ".json");

const simulado = converter(readFileSync(entrada, "utf8"));
const porDificuldade = simulado.objetivas.reduce((acc, q) => ({ ...acc, [q.dificuldade]: (acc[q.dificuldade] ?? 0) + 1 }), {});
const porLetra = LETRAS.map((l) => `${l} ${simulado.objetivas.filter((q) => q.gabarito === l).length}`).join(" · ");
const comCaso = simulado.objetivas.filter((q) => q.caso || simulado.secoes.find((s) => s.id === q.secao)?.casoIntegrado).length;

console.log(`Simulado: ${simulado.titulo}`);
console.log(`  seções: ${simulado.secoes.length} | objetivas: ${simulado.objetivas.length} | discursivas: ${simulado.discursivas.length}`);
console.log(`  dificuldade: ${JSON.stringify(porDificuldade)} | com caso clínico: ${comCaso}`);
console.log(`  respostas: ${porLetra}`);
console.log(`  diagnóstico por ${simulado.agrupamento === "caso" ? "caso" : "capítulo"}: ${simulado.diagnostico.length} grupos | blocos: ${simulado.blocos.length}`);
for (const a of avisos) console.log(`  aviso: ${a}`);
for (const e of erros) console.error(`  ERRO: ${e}`);

if (erros.length > 0) {
  console.error(`\n${erros.length} erro(s). Nada foi gravado.`);
  process.exit(1);
}
writeFileSync(saida, JSON.stringify(simulado));
console.log(`\nGravado em ${saida}`);
