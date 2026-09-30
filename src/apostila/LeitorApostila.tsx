import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import "./leitor.css";
import cssConteudo from "./conteudo.css?inline";
import { prepararApostila } from "./prepararApostila";
import { buscar, criarIndice, destacar, limparDestaque, type IndiceTexto, type Ocorrencia } from "./buscaApostila";
import BarraRolagem, { type MarcoRolagem } from "./BarraRolagem";
import { AjusteTexto, ResultadosBusca, SumarioApostila } from "./folhas";
import { useTheme } from "@/state/ThemeContext";
import { getReadingPosition, saveReadingPosition } from "@/state/localPrefs";
import { IconButton, Spinner, TopAppBar } from "@/components";
import {
  ArrowBack,
  Close,
  FormatListBulleted,
  FormatSize,
  KeyboardArrowDown,
  KeyboardArrowUp,
  Search,
  Toc,
} from "@/components/icons";

const ESCALAS = [0.8, 0.9, 1, 1.1, 1.2, 1.35, 1.5, 1.7];
const CHAVE_ESCALA = "apostilas-escala-texto";
const FONTE_ALVO_PX = 16;
const LARGURA_MAX_CONTEUDO = 760;
const SALVAR_POSICAO_MS = 500;
const BUSCA_DEBOUNCE_MS = 250;
const MARGEM_TITULO_PX = 8;
const FRACAO_LEITURA = 0.3;

interface Posicao {
  indice: number;
  fracao: number;
}

interface TituloMedido {
  id: string;
  titulo: string;
  nivel: 0 | 1;
  topo: number;
}

function ajustarTitulosCapa(raiz: HTMLElement) {
  for (const titulo of Array.from(raiz.querySelectorAll<HTMLElement>(".cover .title"))) {
    titulo.style.fontSize = "";
    let tamanho = parseFloat(getComputedStyle(titulo).fontSize);
    const minimo = tamanho * 0.45;
    while (titulo.scrollWidth > titulo.clientWidth + 1 && tamanho > minimo) {
      tamanho *= 0.92;
      titulo.style.fontSize = `${tamanho}px`;
    }
  }
}

function lerEscala(): number {
  try {
    const valor = Number(localStorage.getItem(CHAVE_ESCALA));
    return ESCALAS.includes(valor) ? valor : 1;
  } catch {
    return 1;
  }
}

function gravarEscala(valor: number) {
  try {
    localStorage.setItem(CHAVE_ESCALA, String(valor));
  } catch {
    return;
  }
}

interface LeitorApostilaProps {
  titulo: string;
  html: string;
  escopoArmazenamento: string;
  onSair: () => void;
}

export default function LeitorApostila({ titulo, html, escopoArmazenamento, onSair }: LeitorApostilaProps) {
  const preparado = useMemo(() => prepararApostila(html), [html]);
  const { resolved } = useTheme();

  const rolagemRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);
  const indiceRef = useRef<IndiceTexto | null>(null);
  const restaurarRef = useRef<Posicao | null>(null);
  const ultimaPosicaoRef = useRef<Posicao | null>(null);
  const restauradoRef = useRef(false);
  const salvarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const larguraRolagemRef = useRef(0);

  const [zoomBase, setZoomBase] = useState<number | null>(null);
  const [escala, setEscala] = useState(lerEscala);
  const [larguraRolagem, setLarguraRolagem] = useState(0);
  const [medidas, setMedidas] = useState<{ titulos: TituloMedido[]; faixa: number }>({ titulos: [], faixa: 1 });
  const [rolagem, setRolagem] = useState({ topo: 0, fracao: 0 });
  const [pronto, setPronto] = useState(false);
  const [folha, setFolha] = useState<"sumario" | "texto" | "resultados" | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [consulta, setConsulta] = useState("");
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [atual, setAtual] = useState(-1);
  const [procurando, setProcurando] = useState(false);

  const zoom = (zoomBase ?? 1) * escala;
  const escopoPosicao = `html:${escopoArmazenamento}`;

  const posicaoAtual = useCallback((): Posicao | null => {
    const r = rolagemRef.current;
    const ancoras = preparado.ancoras;
    if (!r || ancoras.length === 0) return null;
    const limite = r.getBoundingClientRect().top + 1;
    let baixo = 0;
    let alto = ancoras.length - 1;
    let melhor = 0;
    while (baixo <= alto) {
      const meio = (baixo + alto) >> 1;
      if (ancoras[meio].getBoundingClientRect().top <= limite) {
        melhor = meio;
        baixo = meio + 1;
      } else {
        alto = meio - 1;
      }
    }
    const rect = ancoras[melhor].getBoundingClientRect();
    const fracao = rect.height > 0 ? Math.min(Math.max((limite - rect.top) / rect.height, 0), 1) : 0;
    return { indice: melhor, fracao };
  }, [preparado]);

  const restaurar = useCallback(
    (posicao: Posicao) => {
      const r = rolagemRef.current;
      const el = preparado.ancoras[posicao.indice];
      if (!r || !el) return;
      const rect = el.getBoundingClientRect();
      r.scrollTop += rect.top - r.getBoundingClientRect().top + posicao.fracao * rect.height;
    },
    [preparado],
  );

  const lerRolagem = useCallback(() => {
    const r = rolagemRef.current;
    if (!r) return;
    const faixa = r.scrollHeight - r.clientHeight;
    setRolagem({ topo: r.scrollTop, fracao: faixa > 0 ? Math.min(Math.max(r.scrollTop / faixa, 0), 1) : 0 });
  }, []);

  const medir = useCallback(() => {
    const r = rolagemRef.current;
    const sombra = hostRef.current?.shadowRoot;
    if (!r || !sombra) return;
    const base = r.getBoundingClientRect().top - r.scrollTop;
    const titulos = preparado.titulos.flatMap((t) => {
      const el = sombra.getElementById(t.id);
      return el ? [{ ...t, topo: el.getBoundingClientRect().top - base }] : [];
    });
    setMedidas({ titulos, faixa: Math.max(r.scrollHeight - r.clientHeight, 1) });
    lerRolagem();
  }, [preparado, lerRolagem]);

  const irParaElemento = useCallback((el: Element | null) => {
    const r = rolagemRef.current;
    if (!r || !el) return;
    r.scrollTop += el.getBoundingClientRect().top - r.getBoundingClientRect().top - MARGEM_TITULO_PX;
  }, []);

  const irParaId = useCallback(
    (id: string) => irParaElemento(hostRef.current?.shadowRoot?.getElementById(id) ?? null),
    [irParaElemento],
  );

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const sombra = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    const estilo = document.createElement("style");
    estilo.textContent = `${preparado.css}\n${cssConteudo}`;
    sombra.replaceChildren(estilo, preparado.raiz);
    indiceRef.current = null;
    restauradoRef.current = false;
    if (rolagemRef.current) {
      larguraRolagemRef.current = rolagemRef.current.clientWidth;
      setLarguraRolagem(rolagemRef.current.clientWidth);
    }
    const fonte = parseFloat(getComputedStyle(preparado.raiz).fontSize) || FONTE_ALVO_PX;
    setZoomBase(Math.min(Math.max(FONTE_ALVO_PX / fonte, 1), 2.2));
  }, [preparado]);

  useLayoutEffect(() => {
    const raiz = preparado.raiz;
    raiz.style.zoom = String(zoom);
    raiz.style.setProperty("--ap-escala", String(escala));
    raiz.style.setProperty("--ap-escala-inversa", String(1 / escala));
    raiz.dataset.tema = resolved === "dark" ? "escuro" : "claro";
    const efetiva = Math.min(larguraRolagem / zoom, LARGURA_MAX_CONTEUDO);
    raiz.dataset.largura = efetiva < 460 ? "estreita" : efetiva < 680 ? "media" : "larga";
    ajustarTitulosCapa(raiz);
    const pendente = restaurarRef.current;
    if (pendente) {
      restaurarRef.current = null;
      restaurar(pendente);
    }
    medir();
  }, [preparado, zoom, escala, resolved, larguraRolagem, restaurar, medir]);

  useEffect(() => {
    const r = rolagemRef.current;
    if (!r) return;
    const observador = new ResizeObserver(() => {
      if (r.clientWidth === larguraRolagemRef.current) return;
      restaurarRef.current = ultimaPosicaoRef.current;
      larguraRolagemRef.current = r.clientWidth;
      setLarguraRolagem(r.clientWidth);
    });
    observador.observe(r);
    return () => observador.disconnect();
  }, []);

  useEffect(() => {
    const observador = new ResizeObserver(() => medir());
    observador.observe(preparado.raiz);
    return () => observador.disconnect();
  }, [preparado, medir]);

  useEffect(() => {
    if (zoomBase === null || restauradoRef.current) return;
    let cancelado = false;
    (async () => {
      const salvo = await getReadingPosition(escopoPosicao);
      await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 1500))]);
      if (cancelado) return;
      ajustarTitulosCapa(preparado.raiz);
      if (salvo) restaurar({ indice: salvo.pageIndex, fracao: salvo.fraction });
      restauradoRef.current = true;
      ultimaPosicaoRef.current = posicaoAtual();
      medir();
      setPronto(true);
    })();
    return () => {
      cancelado = true;
    };
  }, [zoomBase, escopoPosicao, preparado, restaurar, posicaoAtual, medir]);

  const salvarPosicao = useCallback(() => {
    if (!restauradoRef.current) return;
    const posicao = ultimaPosicaoRef.current;
    if (posicao) void saveReadingPosition(escopoPosicao, { pageIndex: posicao.indice, fraction: posicao.fracao });
  }, [escopoPosicao]);

  useEffect(() => {
    const r = rolagemRef.current;
    if (!r) return;
    let quadro = 0;
    function onRolar() {
      if (quadro) return;
      quadro = requestAnimationFrame(() => {
        quadro = 0;
        lerRolagem();
        if (!restauradoRef.current) return;
        ultimaPosicaoRef.current = posicaoAtual();
        if (salvarTimerRef.current) clearTimeout(salvarTimerRef.current);
        salvarTimerRef.current = setTimeout(salvarPosicao, SALVAR_POSICAO_MS);
      });
    }
    r.addEventListener("scroll", onRolar, { passive: true });
    return () => {
      r.removeEventListener("scroll", onRolar);
      if (quadro) cancelAnimationFrame(quadro);
    };
  }, [lerRolagem, posicaoAtual, salvarPosicao]);

  useEffect(() => {
    function onVisibilidade() {
      if (document.hidden) salvarPosicao();
    }
    document.addEventListener("visibilitychange", onVisibilidade);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilidade);
      if (salvarTimerRef.current) clearTimeout(salvarTimerRef.current);
      salvarPosicao();
    };
  }, [salvarPosicao]);

  useEffect(() => {
    const raiz = preparado.raiz;
    function alternar(cartao: Element) {
      cartao.setAttribute("aria-expanded", cartao.getAttribute("aria-expanded") === "true" ? "false" : "true");
    }
    function onClique(e: MouseEvent) {
      const alvo = e.target instanceof Element ? e.target : null;
      const link = alvo?.closest("a[href^='#']");
      if (link) {
        e.preventDefault();
        irParaId(decodeURIComponent((link.getAttribute("href") ?? "").slice(1)));
        return;
      }
      const cartao = alvo?.closest(".f.qa");
      if (cartao) alternar(cartao);
    }
    function onTecla(e: KeyboardEvent) {
      const alvo = e.target instanceof Element ? e.target : null;
      if (alvo?.matches(".f.qa") && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        alternar(alvo);
      }
    }
    raiz.addEventListener("click", onClique);
    raiz.addEventListener("keydown", onTecla);
    return () => {
      raiz.removeEventListener("click", onClique);
      raiz.removeEventListener("keydown", onTecla);
    };
  }, [preparado, irParaId]);

  useEffect(() => {
    if (buscando) buscaRef.current?.focus();
  }, [buscando]);

  useEffect(() => {
    if (!buscando) return;
    setProcurando(consulta.trim().length >= 2);
    const id = setTimeout(() => {
      if (!indiceRef.current) indiceRef.current = criarIndice(preparado.raiz);
      const achados = buscar(indiceRef.current, consulta);
      setOcorrencias(achados);
      setAtual(achados.length > 0 ? 0 : -1);
      setProcurando(false);
    }, BUSCA_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [consulta, buscando, preparado]);

  useEffect(() => {
    if (buscando) destacar(ocorrencias, atual);
    else limparDestaque();
  }, [ocorrencias, atual, buscando]);

  useEffect(() => () => limparDestaque(), []);

  useEffect(() => {
    const ocorrencia = ocorrencias[atual];
    const r = rolagemRef.current;
    if (!ocorrencia || !r) return;
    const cartao = ocorrencia.range.startContainer.parentElement?.closest(".f.qa");
    if (cartao?.getAttribute("aria-expanded") === "false") cartao.setAttribute("aria-expanded", "true");
    const tabela = ocorrencia.range.startContainer.parentElement?.closest(".ap-tabela");
    if (tabela) {
      const alvo = ocorrencia.range.getBoundingClientRect();
      const caixa = tabela.getBoundingClientRect();
      if (alvo.left < caixa.left || alvo.right > caixa.right) {
        tabela.scrollLeft += alvo.left - caixa.left - tabela.clientWidth / 3;
      }
    }
    const rect = ocorrencia.range.getBoundingClientRect();
    r.scrollTop += rect.top - r.getBoundingClientRect().top - r.clientHeight / 3;
  }, [ocorrencias, atual]);

  const capitulosDasOcorrencias = useMemo(() => {
    const sombra = hostRef.current?.shadowRoot;
    const capitulos = preparado.titulos
      .filter((t) => t.nivel === 0)
      .flatMap((t) => {
        const el = sombra?.getElementById(t.id);
        return el ? [{ el, titulo: t.titulo }] : [];
      });
    return ocorrencias.map((o) => {
      let rotulo: string | null = null;
      for (const c of capitulos) {
        if (c.el.compareDocumentPosition(o.range.startContainer) & Node.DOCUMENT_POSITION_FOLLOWING) rotulo = c.titulo;
        else break;
      }
      return rotulo;
    });
  }, [ocorrencias, preparado]);

  function fecharBusca() {
    setBuscando(false);
    setConsulta("");
    setOcorrencias([]);
    setAtual(-1);
    setProcurando(false);
    setFolha(null);
  }

  function moverOcorrencia(delta: number) {
    if (ocorrencias.length === 0) return;
    setAtual((i) => (((i + delta) % ocorrencias.length) + ocorrencias.length) % ocorrencias.length);
  }

  function mudarEscala(nova: number) {
    restaurarRef.current = posicaoAtual();
    setEscala(nova);
    gravarEscala(nova);
  }

  const indiceEscala = ESCALAS.indexOf(escala);
  const limiteTopo = rolagem.topo + (rolagemRef.current?.clientHeight ?? 0) * FRACAO_LEITURA;
  let capituloAtual: string | null = null;
  let secaoAtualId: string | null = null;
  for (const t of medidas.titulos) {
    if (t.topo > limiteTopo) break;
    secaoAtualId = t.id;
    if (t.nivel === 0) capituloAtual = t.titulo;
  }
  const marcos: MarcoRolagem[] = medidas.titulos
    .filter((t) => t.nivel === 0)
    .map((t) => ({ titulo: t.titulo, fracao: Math.min(t.topo / medidas.faixa, 1) }));

  return (
    <div className="ap-pagina">
      <TopAppBar>
        {buscando ? (
          <>
            <IconButton label="Fechar busca" onClick={fecharBusca}>
              <Close />
            </IconButton>
            <input
              ref={buscaRef}
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
              placeholder="Buscar na apostila…"
              className="m3-body-large ap-busca"
              aria-label="Buscar na apostila"
              enterKeyHint="search"
              onKeyDown={(e) => {
                if (e.key === "Enter") moverOcorrencia(e.shiftKey ? -1 : 1);
              }}
            />
            <span className="m3-label-large ap-contador">
              {procurando ? (
                <Spinner size={18} />
              ) : ocorrencias.length > 0 ? (
                `${atual + 1}/${ocorrencias.length}`
              ) : consulta.trim().length >= 2 ? (
                "0"
              ) : (
                ""
              )}
            </span>
            {ocorrencias.length > 0 && (
              <>
                <IconButton label="Ocorrência anterior" onClick={() => moverOcorrencia(-1)}>
                  <KeyboardArrowUp />
                </IconButton>
                <IconButton label="Próxima ocorrência" onClick={() => moverOcorrencia(1)}>
                  <KeyboardArrowDown />
                </IconButton>
                <IconButton label="Todos os resultados" onClick={() => setFolha("resultados")}>
                  <FormatListBulleted />
                </IconButton>
              </>
            )}
          </>
        ) : (
          <>
            <IconButton label="Voltar" onClick={onSair}>
              <ArrowBack />
            </IconButton>
            <span className="m3-title-medium m3-appbar__title" style={{ color: "var(--md-on-surface-variant)" }}>
              {capituloAtual ?? titulo}
            </span>
            <IconButton label="Tamanho do texto" onClick={() => setFolha("texto")}>
              <FormatSize />
            </IconButton>
            <IconButton label="Buscar" onClick={() => setBuscando(true)}>
              <Search />
            </IconButton>
            <IconButton label="Sumário" onClick={() => setFolha("sumario")}>
              <Toc />
            </IconButton>
          </>
        )}
      </TopAppBar>

      <div className="ap-progresso" role="progressbar" aria-label="Progresso da leitura" aria-valuenow={Math.round(rolagem.fracao * 100)}>
        <span style={{ width: `${rolagem.fracao * 100}%` }} />
      </div>

      <div className="ap-corpo">
        <div ref={rolagemRef} className="ap-rolagem">
          <div
            ref={hostRef}
            className={`ap-host${pronto ? "" : " ap-host--oculto"}`}
            style={{ maxWidth: LARGURA_MAX_CONTEUDO * zoom }}
          />
        </div>
        {!pronto && (
          <div className="ap-carregando">
            <Spinner label="Preparando a apostila" />
          </div>
        )}
        {pronto && (
          <BarraRolagem
            fracao={rolagem.fracao}
            marcos={marcos}
            onFracao={(f) => {
              const r = rolagemRef.current;
              if (r) r.scrollTop = f * (r.scrollHeight - r.clientHeight);
            }}
          />
        )}
      </div>

      {folha === "sumario" && (
        <SumarioApostila
          titulos={preparado.titulos}
          atualId={secaoAtualId}
          onIr={(id) => {
            setFolha(null);
            irParaId(id);
          }}
          onClose={() => setFolha(null)}
        />
      )}

      {folha === "texto" && (
        <AjusteTexto
          escala={escala}
          minimo={indiceEscala <= 0}
          maximo={indiceEscala >= ESCALAS.length - 1}
          onMenor={() => mudarEscala(ESCALAS[Math.max(indiceEscala - 1, 0)])}
          onMaior={() => mudarEscala(ESCALAS[Math.min(indiceEscala + 1, ESCALAS.length - 1)])}
          onPadrao={() => mudarEscala(1)}
          onClose={() => setFolha(null)}
        />
      )}

      {folha === "resultados" && (
        <ResultadosBusca
          ocorrencias={ocorrencias}
          capitulos={capitulosDasOcorrencias}
          atual={atual}
          onEscolher={(i) => {
            setAtual(i);
            setFolha(null);
          }}
          onClose={() => setFolha(null)}
        />
      )}
    </div>
  );
}
