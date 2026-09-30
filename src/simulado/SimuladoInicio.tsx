import { useMemo, useState } from "react";
import type { Escopo, Modo, RegistroSimulado, Simulado } from "./types";
import { formatarDuracao, itensDoEscopo, minutosSugeridos, porcentagem } from "./scoring";
import { Button, Card } from "@/components";

interface OpcaoEscopo {
  chave: string;
  escopo: Escopo;
  titulo: string;
  detalhe: string;
}

interface SimuladoInicioProps {
  simulado: Simulado;
  registro: RegistroSimulado;
  onIniciar: (modo: Modo, escopo: Escopo, titulo: string) => void;
  onContinuar: () => void;
  onVerResultado: () => void;
}

const MODOS: Array<{ modo: Modo; titulo: string; detalhe: string }> = [
  { modo: "treino", titulo: "Treino", detalhe: "Correção a cada questão, com justificativa na hora" },
  { modo: "prova", titulo: "Prova", detalhe: "Cronômetro e correção só no final, como pede o simulado" },
];

function resumoQuantidade(objetivas: number, discursivas: number): string {
  const partes = [];
  if (objetivas > 0) partes.push(`${objetivas} ${objetivas === 1 ? "objetiva" : "objetivas"}`);
  if (discursivas > 0) partes.push(`${discursivas} ${discursivas === 1 ? "discursiva" : "discursivas"}`);
  return partes.join(" · ");
}

export default function SimuladoInicio({
  simulado,
  registro,
  onIniciar,
  onContinuar,
  onVerResultado,
}: SimuladoInicioProps) {
  const [modo, setModo] = useState<Modo>("treino");
  const [escolha, setEscolha] = useState("tudo");

  const opcoes = useMemo(() => {
    const lista: Array<{ grupo: string; itens: OpcaoEscopo[] }> = [];
    const descrever = (escopo: Escopo) => {
      const itens = itensDoEscopo(simulado, escopo);
      const objetivas = itens.filter((i) => i.tipo === "objetiva").length;
      const tempo = formatarDuracao(minutosSugeridos(simulado, itens) * 60_000);
      return `${resumoQuantidade(objetivas, itens.length - objetivas)} · ~${tempo}`;
    };

    const completo: OpcaoEscopo = {
      chave: "tudo",
      escopo: { tipo: "tudo" },
      titulo: "Simulado completo",
      detalhe: descrever({ tipo: "tudo" }),
    };
    lista.push({ grupo: "Completo", itens: [completo] });

    if (simulado.blocos.length > 0) {
      lista.push({
        grupo: "Blocos sugeridos pelo autor",
        itens: simulado.blocos.map((b) => ({
          chave: `bloco:${b.id}`,
          escopo: { tipo: "bloco", id: b.id },
          titulo: `${b.titulo} — ${b.descricao}`,
          detalhe: descrever({ tipo: "bloco", id: b.id }),
        })),
      });
    }

    lista.push({
      grupo: "Por caso",
      itens: simulado.secoes.map((s) => ({
        chave: `secao:${s.id}`,
        escopo: { tipo: "secao", id: s.id },
        titulo: s.titulo,
        detalhe: descrever({ tipo: "secao", id: s.id }),
      })),
    });

    const ultimos = registro.historico[0]?.erros ?? [];
    if (ultimos.length > 0) {
      lista.push({
        grupo: "Revisão",
        itens: [
          {
            chave: "erros",
            escopo: { tipo: "erros", numeros: ultimos },
            titulo: "Refazer os erros da última tentativa",
            detalhe: descrever({ tipo: "erros", numeros: ultimos }),
          },
        ],
      });
    }
    return lista;
  }, [simulado, registro.historico]);

  const selecionada = opcoes.flatMap((g) => g.itens).find((o) => o.chave === escolha) ?? opcoes[0].itens[0];
  const emAndamento = registro.atual && !registro.atual.finalizadaEm ? registro.atual : null;
  const ultimaFinalizada = registro.atual?.finalizadaEm ? registro.atual : null;
  const porDificuldade = simulado.objetivas.reduce(
    (acc, q) => ({ ...acc, [q.dificuldade]: acc[q.dificuldade] + 1 }),
    { facil: 0, media: 0, dificil: 0 },
  );

  return (
    <div className="sim-conteudo">
      <Card variant="primary" radius="xl" className="sim-card">
        <p className="m3-title-large">{simulado.titulo}</p>
        <p className="m3-body-medium">
          {resumoQuantidade(simulado.objetivas.length, simulado.discursivas.length)}
          {simulado.tempoSugerido ? ` · tempo sugerido: ${simulado.tempoSugerido}` : ""}
        </p>
        <div className="sim-questao__meta">
          <span className="sim-chip sim-chip--facil">{porDificuldade.facil} fáceis</span>
          <span className="sim-chip sim-chip--media">{porDificuldade.media} médias</span>
          <span className="sim-chip sim-chip--dificil">{porDificuldade.dificil} difíceis</span>
        </div>
      </Card>

      {emAndamento && (
        <Card variant="filled" className="sim-card">
          <p className="m3-title-small">Tentativa em andamento</p>
          <p className="m3-body-medium sim-muted">
            {emAndamento.escopoTitulo} · {emAndamento.modo === "treino" ? "Treino" : "Prova"} · item{" "}
            {emAndamento.indice + 1} de {emAndamento.itens.length}
          </p>
          <Button onClick={onContinuar}>Continuar de onde parei</Button>
        </Card>
      )}

      {ultimaFinalizada && (
        <Button variant="tonal" onClick={onVerResultado}>
          Ver resultado da última tentativa
        </Button>
      )}

      <h2 className="m3-title-medium sim-secao-titulo">Como você quer responder?</h2>
      <div className="sim-opcoes" role="radiogroup" aria-label="Modo">
        {MODOS.map((m) => (
          <button
            key={m.modo}
            type="button"
            role="radio"
            aria-checked={modo === m.modo}
            className="sim-opcao m3-interactive"
            onClick={() => setModo(m.modo)}
          >
            <span className="sim-opcao__radio" />
            <span className="sim-opcao__texto">
              <span className="m3-title-small">{m.titulo}</span>
              <span className="m3-body-small">{m.detalhe}</span>
            </span>
          </button>
        ))}
      </div>

      <h2 className="m3-title-medium sim-secao-titulo">O que responder?</h2>
      {opcoes.map((grupo) => (
        <div key={grupo.grupo} className="sim-opcoes" role="radiogroup" aria-label={grupo.grupo}>
          <span className="m3-label-medium sim-muted">{grupo.grupo}</span>
          {grupo.itens.map((o) => (
            <button
              key={o.chave}
              type="button"
              role="radio"
              aria-checked={selecionada.chave === o.chave}
              className="sim-opcao m3-interactive"
              onClick={() => setEscolha(o.chave)}
            >
              <span className="sim-opcao__radio" />
              <span className="sim-opcao__texto">
                <span className="m3-body-large">{o.titulo}</span>
                <span className="m3-body-small sim-muted">{o.detalhe}</span>
              </span>
            </button>
          ))}
        </div>
      ))}

      {emAndamento && (
        <p className="m3-body-small sim-muted">Começar agora substitui a tentativa em andamento.</p>
      )}
      <Button fullWidth onClick={() => onIniciar(modo, selecionada.escopo, selecionada.titulo)}>
        Começar
      </Button>

      {registro.historico.length > 0 && (
        <>
          <h2 className="m3-title-medium sim-secao-titulo">Últimas tentativas</h2>
          <Card variant="filled" className="sim-card">
            {registro.historico.slice(0, 5).map((h) => (
              <div key={h.id} className="sim-linha-barra__topo">
                <span className="m3-body-medium">
                  {new Date(h.finalizadaEm).toLocaleDateString("pt-BR")} · {h.escopoTitulo}
                  <span className="sim-muted"> · {h.modo === "treino" ? "Treino" : "Prova"}</span>
                </span>
                <span className="m3-label-large">{porcentagem(h)}%</span>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
