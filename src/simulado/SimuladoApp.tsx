import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./simulado.css";
import type {
  Escopo,
  FracaoCriterio,
  ItemRef,
  Letra,
  Modo,
  RegistroSimulado,
  RespostaDiscursiva,
  Simulado,
  Tentativa,
} from "./types";
import { calcularResultado, chaveItem, itensDoEscopo } from "./scoring";
import { carregarRegistro, salvarRegistro } from "./attemptStore";
import { Cronometro } from "./partes";
import SimuladoInicio from "./SimuladoInicio";
import SimuladoResultado from "./SimuladoResultado";
import QuestaoObjetivaView from "./QuestaoObjetivaView";
import QuestaoDiscursivaView from "./QuestaoDiscursivaView";
import MapaQuestoes from "./MapaQuestoes";
import { Button, IconButton, Spinner, TopAppBar } from "@/components";
import { Apps, ArrowBack, Check, Flag, OutlinedFlag } from "@/components/icons";

type Fase =
  | { tipo: "inicio" }
  | { tipo: "respondendo" }
  | { tipo: "resultado" }
  | { tipo: "revisao"; itens: ItemRef[]; indice: number };

const SALVAR_DEBOUNCE_MS = 400;
const LETRAS: Letra[] = ["A", "B", "C", "D", "E"];

interface SimuladoAppProps {
  titulo: string;
  simulado: Simulado;
  escopoArmazenamento: string;
  onSair: () => void;
}

function comTempo(registro: RegistroSimulado, desde: number | null, agora: number): RegistroSimulado {
  if (!registro.atual || desde === null) return registro;
  return { ...registro, atual: { ...registro.atual, tempoMs: registro.atual.tempoMs + Math.max(0, agora - desde) } };
}

export default function SimuladoApp({ titulo, simulado, escopoArmazenamento, onSair }: SimuladoAppProps) {
  const [registro, setRegistro] = useState<RegistroSimulado | null>(null);
  const [fase, setFase] = useState<Fase>({ tipo: "inicio" });
  const [mapaAberto, setMapaAberto] = useState(false);
  const [desde, setDesde] = useState<number | null>(null);
  const rolagemRef = useRef<HTMLDivElement>(null);

  const registroRef = useRef(registro);
  registroRef.current = registro;
  const desdeRef = useRef(desde);
  desdeRef.current = desde;
  const carregadoRef = useRef(false);

  const questaoPorNumero = useMemo(() => new Map(simulado.objetivas.map((q) => [q.numero, q])), [simulado]);
  const discursivaPorId = useMemo(() => new Map(simulado.discursivas.map((d) => [d.id, d])), [simulado]);
  const secaoPorId = useMemo(() => new Map(simulado.secoes.map((s) => [s.id, s])), [simulado]);

  useEffect(() => {
    let cancelado = false;
    carregarRegistro(escopoArmazenamento).then((r) => {
      if (!cancelado) setRegistro(r);
    });
    return () => {
      cancelado = true;
    };
  }, [escopoArmazenamento]);

  useEffect(() => {
    if (!registro) return;
    if (!carregadoRef.current) {
      carregadoRef.current = true;
      return;
    }
    const id = setTimeout(() => void salvarRegistro(escopoArmazenamento, registro), SALVAR_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [registro, escopoArmazenamento]);

  const salvarAgora = useCallback(() => {
    const atual = registroRef.current;
    if (atual) void salvarRegistro(escopoArmazenamento, comTempo(atual, desdeRef.current, Date.now()));
  }, [escopoArmazenamento]);

  const atualizarTentativa = useCallback((fn: (t: Tentativa) => Tentativa) => {
    setRegistro((prev) => (prev?.atual ? { ...prev, atual: fn(prev.atual) } : prev));
  }, []);

  const pausarTempo = useCallback(() => {
    const inicio = desdeRef.current;
    if (inicio === null) return;
    const delta = Math.max(0, Date.now() - inicio);
    desdeRef.current = null;
    setDesde(null);
    atualizarTentativa((t) => ({ ...t, tempoMs: t.tempoMs + delta }));
  }, [atualizarTentativa]);

  const tentativa = registro?.atual ?? null;
  const cronometroAtivo = fase.tipo === "respondendo" && tentativa !== null && !tentativa.finalizadaEm;

  useEffect(() => {
    if (cronometroAtivo && !document.hidden) {
      if (desdeRef.current === null) setDesde(Date.now());
    } else {
      pausarTempo();
    }
  }, [cronometroAtivo, pausarTempo]);

  useEffect(() => {
    function onVisibilidade() {
      if (document.hidden) {
        salvarAgora();
        pausarTempo();
      } else if (cronometroAtivo && desdeRef.current === null) {
        setDesde(Date.now());
      }
    }
    document.addEventListener("visibilitychange", onVisibilidade);
    return () => document.removeEventListener("visibilitychange", onVisibilidade);
  }, [cronometroAtivo, salvarAgora, pausarTempo]);

  useEffect(() => () => salvarAgora(), [salvarAgora]);

  const itensVisiveis = fase.tipo === "revisao" ? fase.itens : (tentativa?.itens ?? []);
  const indiceVisivel = fase.tipo === "revisao" ? fase.indice : (tentativa?.indice ?? 0);
  const itemAtual: ItemRef | undefined = itensVisiveis[indiceVisivel];
  const chaveAtual = itemAtual ? chaveItem(itemAtual) : "";

  useEffect(() => {
    rolagemRef.current?.scrollTo({ top: 0 });
  }, [chaveAtual, fase.tipo]);

  function iniciar(modo: Modo, escopo: Escopo, escopoTitulo: string) {
    const itens = itensDoEscopo(simulado, escopo).filter((item) =>
      item.tipo === "objetiva" ? questaoPorNumero.has(item.numero) : discursivaPorId.has(item.id),
    );
    if (itens.length === 0) return;
    const nova: Tentativa = {
      id: String(Date.now()),
      modo,
      escopo,
      escopoTitulo,
      itens,
      indice: 0,
      respostas: {},
      riscadas: {},
      marcadas: [],
      discursivas: {},
      iniciadaEm: Date.now(),
      tempoMs: 0,
    };
    desdeRef.current = null;
    setDesde(null);
    setRegistro((prev) => (prev ? { ...prev, atual: nova } : prev));
    setFase({ tipo: "respondendo" });
  }

  function finalizar() {
    const inicio = desdeRef.current;
    const agora = Date.now();
    desdeRef.current = null;
    setDesde(null);
    setRegistro((prev) => {
      if (!prev?.atual) return prev;
      const tempoMs = prev.atual.tempoMs + (inicio !== null ? Math.max(0, agora - inicio) : 0);
      const atual: Tentativa = { ...prev.atual, tempoMs, finalizadaEm: agora };
      const r = calcularResultado(simulado, atual);
      const resumo = {
        id: atual.id,
        modo: atual.modo,
        escopoTitulo: atual.escopoTitulo,
        finalizadaEm: agora,
        acertos: r.objetivas.acertos,
        total: r.objetivas.total,
        tempoMs,
        erros: r.erros,
      };
      return { atual, historico: [resumo, ...prev.historico.filter((h) => h.id !== atual.id)] };
    });
    setMapaAberto(false);
    setFase({ tipo: "resultado" });
  }

  function ir(indice: number) {
    const limite = Math.min(Math.max(indice, 0), itensVisiveis.length - 1);
    if (fase.tipo === "revisao") setFase({ ...fase, indice: limite });
    else atualizarTentativa((t) => ({ ...t, indice: limite }));
    setMapaAberto(false);
  }

  function responder(numero: number, letra: Letra) {
    atualizarTentativa((t) => {
      if (t.finalizadaEm) return t;
      const anterior = t.respostas[numero];
      if (t.modo === "treino" && anterior) return t;
      const respostas = { ...t.respostas };
      if (anterior === letra) delete respostas[numero];
      else respostas[numero] = letra;
      return { ...t, respostas };
    });
  }

  function riscar(numero: number, letra: Letra) {
    atualizarTentativa((t) => {
      const atuais = t.riscadas[numero] ?? [];
      const proximas = atuais.includes(letra) ? atuais.filter((l) => l !== letra) : [...atuais, letra];
      return { ...t, riscadas: { ...t.riscadas, [numero]: proximas } };
    });
  }

  function alternarMarcacao(chave: string) {
    atualizarTentativa((t) => ({
      ...t,
      marcadas: t.marcadas.includes(chave) ? t.marcadas.filter((c) => c !== chave) : [...t.marcadas, chave],
    }));
  }

  function atualizarDiscursiva(id: string, fn: (r: RespostaDiscursiva) => RespostaDiscursiva) {
    const questao = discursivaPorId.get(id);
    if (!questao) return;
    atualizarTentativa((t) => {
      const atual = t.discursivas[id] ?? { texto: "", correcao: questao.espelho.map(() => null) };
      return { ...t, discursivas: { ...t.discursivas, [id]: fn(atual) } };
    });
  }

  function corrigir(id: string, indice: number, fracao: FracaoCriterio) {
    atualizarDiscursiva(id, (r) => {
      const correcao = [...r.correcao];
      correcao[indice] = fracao;
      return { ...r, correcao };
    });
  }

  function pedirFinalizacao() {
    if (!tentativa) return;
    const emBranco = tentativa.itens.some((item) => item.tipo === "objetiva" && !tentativa.respostas[item.numero]);
    if (emBranco) setMapaAberto(true);
    else finalizar();
  }

  function revisar(itens: ItemRef[]) {
    if (itens.length > 0) setFase({ tipo: "revisao", itens, indice: 0 });
  }

  useEffect(() => {
    if (fase.tipo !== "respondendo" && fase.tipo !== "revisao") return;
    function onTecla(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null;
      if (alvo?.closest("textarea, input") || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "ArrowRight") ir(indiceVisivel + 1);
      else if (e.key === "ArrowLeft") ir(indiceVisivel - 1);
      else if (fase.tipo === "respondendo" && itemAtual?.tipo === "objetiva") {
        const letra = e.key.toUpperCase() as Letra;
        if (LETRAS.includes(letra)) responder(itemAtual.numero, letra);
      }
    }
    window.addEventListener("keydown", onTecla);
    return () => window.removeEventListener("keydown", onTecla);
  });

  if (!registro) {
    return (
      <div className="sim-pagina">
        <TopAppBar>
          <IconButton label="Voltar" onClick={onSair}>
            <ArrowBack />
          </IconButton>
        </TopAppBar>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Spinner label="Carregando suas tentativas" />
        </div>
      </div>
    );
  }

  if (fase.tipo === "inicio" || !tentativa) {
    return (
      <div className="sim-pagina">
        <TopAppBar>
          <IconButton label="Voltar" onClick={onSair}>
            <ArrowBack />
          </IconButton>
          <span className="m3-title-medium m3-appbar__title">{titulo}</span>
        </TopAppBar>
        <div ref={rolagemRef} className="sim-rolagem">
          <SimuladoInicio
            simulado={simulado}
            registro={registro}
            onIniciar={iniciar}
            onContinuar={() => setFase({ tipo: "respondendo" })}
            onVerResultado={() => setFase({ tipo: "resultado" })}
          />
        </div>
      </div>
    );
  }

  if (fase.tipo === "resultado") {
    const discursivasPendentes = tentativa.itens.filter(
      (item) => item.tipo === "discursiva" && !tentativa.discursivas[item.id]?.correcao.every((c) => c !== null),
    );
    return (
      <div className="sim-pagina">
        <TopAppBar>
          <IconButton label="Voltar ao início do simulado" onClick={() => setFase({ tipo: "inicio" })}>
            <ArrowBack />
          </IconButton>
          <span className="m3-title-medium m3-appbar__title">Resultado</span>
        </TopAppBar>
        <div ref={rolagemRef} className="sim-rolagem">
          <SimuladoResultado
            simulado={simulado}
            tentativa={tentativa}
            onRevisar={(apenasErros) =>
              revisar(
                apenasErros
                  ? calcularResultado(simulado, tentativa).erros.map((numero) => ({ tipo: "objetiva", numero }))
                  : tentativa.itens,
              )
            }
            onCorrigirDiscursivas={() => revisar(discursivasPendentes)}
            onRefazerErros={(numeros) => iniciar(tentativa.modo, { tipo: "erros", numeros }, "Refazer erros")}
            onNovo={() => setFase({ tipo: "inicio" })}
          />
        </div>
      </div>
    );
  }

  const emRevisao = fase.tipo === "revisao";
  const questao = itemAtual?.tipo === "objetiva" ? questaoPorNumero.get(itemAtual.numero) : undefined;
  const discursiva = itemAtual?.tipo === "discursiva" ? discursivaPorId.get(itemAtual.id) : undefined;
  const ultimo = indiceVisivel >= itensVisiveis.length - 1;
  const marcada = tentativa.marcadas.includes(chaveAtual);
  const respondidasTreino = tentativa.itens.filter(
    (item) => item.tipo === "objetiva" && tentativa.respostas[item.numero],
  ) as Array<{ tipo: "objetiva"; numero: number }>;
  const acertosTreino = respondidasTreino.filter(
    (item) => tentativa.respostas[item.numero] === questaoPorNumero.get(item.numero)?.gabarito,
  ).length;

  return (
    <div className="sim-pagina">
      <TopAppBar>
        <IconButton
          label={emRevisao ? "Voltar ao resultado" : "Pausar e voltar ao início do simulado"}
          onClick={() => setFase({ tipo: emRevisao ? "resultado" : "inicio" })}
        >
          <ArrowBack />
        </IconButton>
        <span className="m3-title-medium m3-appbar__title">
          {emRevisao ? "Revisão" : "Item"} {indiceVisivel + 1} de {itensVisiveis.length}
        </span>
        {!emRevisao && tentativa.modo === "prova" && <Cronometro acumuladoMs={tentativa.tempoMs} desde={desde} />}
        {!emRevisao && tentativa.modo === "treino" && respondidasTreino.length > 0 && (
          <span
            className="sim-status m3-label-large"
            aria-label={`${acertosTreino} acertos em ${respondidasTreino.length} respondidas`}
          >
            <Check size={18} />
            {acertosTreino}/{respondidasTreino.length}
          </span>
        )}
        {!emRevisao && (
          <IconButton
            label={marcada ? "Desmarcar revisão" : "Marcar para revisar"}
            tone={marcada ? "primary" : "default"}
            onClick={() => alternarMarcacao(chaveAtual)}
          >
            {marcada ? <Flag /> : <OutlinedFlag />}
          </IconButton>
        )}
        <IconButton label="Mapa de questões" onClick={() => setMapaAberto(true)}>
          <Apps />
        </IconButton>
      </TopAppBar>

      <div ref={rolagemRef} className="sim-rolagem">
        <div className="sim-conteudo">
          {questao && (
            <QuestaoObjetivaView
              key={questao.numero}
              questao={questao}
              secao={secaoPorId.get(questao.secao)}
              modo={emRevisao ? "revisao" : tentativa.modo}
              resposta={tentativa.respostas[questao.numero]}
              riscadas={tentativa.riscadas[questao.numero] ?? []}
              onResponder={(letra) => responder(questao.numero, letra)}
              onRiscar={(letra) => riscar(questao.numero, letra)}
            />
          )}
          {discursiva && (
            <QuestaoDiscursivaView
              key={discursiva.id}
              questao={discursiva}
              resposta={tentativa.discursivas[discursiva.id]}
              podeCorrigir={tentativa.modo === "treino" || Boolean(tentativa.finalizadaEm)}
              orientacaoEspelho={simulado.orientacaoEspelho}
              onTexto={(texto) => atualizarDiscursiva(discursiva.id, (r) => ({ ...r, texto }))}
              onCorrigir={(indice, fracao) => corrigir(discursiva.id, indice, fracao)}
            />
          )}
          {!questao && !discursiva && (
            <p className="m3-body-large sim-muted">Esta questão não existe mais nesta versão do simulado.</p>
          )}
        </div>
      </div>

      <div className="sim-rodape">
        <Button variant="text" disabled={indiceVisivel === 0} onClick={() => ir(indiceVisivel - 1)}>
          Anterior
        </Button>
        {!ultimo ? (
          <Button onClick={() => ir(indiceVisivel + 1)}>Próxima</Button>
        ) : emRevisao ? (
          <Button onClick={() => setFase({ tipo: "resultado" })}>Ver resultado</Button>
        ) : (
          <Button onClick={pedirFinalizacao}>Finalizar</Button>
        )}
      </div>

      {mapaAberto && (
        <MapaQuestoes
          simulado={simulado}
          tentativa={tentativa}
          itens={itensVisiveis}
          indiceAtual={indiceVisivel}
          revelar={emRevisao || Boolean(tentativa.finalizadaEm)}
          onIr={ir}
          onFinalizar={emRevisao || tentativa.finalizadaEm ? undefined : finalizar}
          onClose={() => setMapaAberto(false)}
        />
      )}
    </div>
  );
}
