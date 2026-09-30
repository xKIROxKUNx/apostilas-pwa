import { useEffect, useRef } from "react";
import type { Letra, QuestaoObjetiva, Secao } from "./types";
import { descreverReferencia } from "./scoring";
import { ChipDificuldade } from "./partes";
import RichText from "./RichText";
import { IconButton } from "@/components";
import { Block, Check, Close } from "@/components/icons";

interface QuestaoObjetivaViewProps {
  questao: QuestaoObjetiva;
  secao?: Secao;
  modo: "treino" | "prova" | "revisao";
  resposta?: Letra;
  riscadas: Letra[];
  onResponder: (letra: Letra) => void;
  onRiscar: (letra: Letra) => void;
}

export default function QuestaoObjetivaView({
  questao,
  secao,
  modo,
  resposta,
  riscadas,
  onResponder,
  onRiscar,
}: QuestaoObjetivaViewProps) {
  const revelado = modo === "revisao" || (modo === "treino" && resposta !== undefined);
  const acertou = resposta === questao.gabarito;
  const feedbackRef = useRef<HTMLDivElement>(null);
  const respostaInicial = useRef(resposta);

  useEffect(() => {
    if (modo !== "treino" || resposta === undefined || resposta === respostaInicial.current) return;
    feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [modo, resposta]);

  function classeAlternativa(letra: Letra): string {
    const classes = ["sim-alt", "m3-interactive"];
    if (revelado) {
      if (letra === questao.gabarito) classes.push("sim-alt--certa");
      else if (letra === resposta) classes.push("sim-alt--errada");
      else classes.push("sim-alt--apagada");
    } else {
      if (letra === resposta) classes.push("sim-alt--selecionada");
      if (riscadas.includes(letra)) classes.push("sim-alt--riscada");
    }
    return classes.join(" ");
  }

  return (
    <article className="sim-questao">
      <div className="sim-questao__meta">
        <span className="m3-title-medium">Questão {questao.numero}</span>
        <ChipDificuldade dificuldade={questao.dificuldade} />
        {revelado && <span className="m3-body-small sim-muted">{questao.tema}</span>}
      </div>

      {secao?.casoIntegrado && (
        <details className="sim-caso" open>
          <summary className="m3-label-large">
            {secao.casoIntegrado.titulo}
            {secao.casoIntegrado.casos ? ` · ${secao.casoIntegrado.casos}` : ""}
          </summary>
          <RichText className="sim-texto sim-caso__texto m3-body-medium" html={secao.casoIntegrado.texto} />
        </details>
      )}

      {questao.caso && (
        <div className="sim-caso">
          <span className="sim-caso__rotulo m3-label-medium">Caso clínico</span>
          <RichText className="sim-texto m3-body-medium" html={questao.caso} />
        </div>
      )}

      <RichText className="sim-texto m3-body-large" html={questao.enunciado} />

      <div className="sim-alts" role="radiogroup" aria-label={`Alternativas da questão ${questao.numero}`}>
        {questao.alternativas.map(({ letra, texto }) => {
          const riscada = riscadas.includes(letra);
          return (
            <div key={letra} className="sim-alt-linha">
              <button
                type="button"
                role="radio"
                aria-checked={resposta === letra}
                className={classeAlternativa(letra)}
                disabled={revelado}
                onClick={() => onResponder(letra)}
              >
                <span className="sim-alt__letra">{letra}</span>
                <RichText as="span" className="sim-alt__texto sim-texto" html={texto} />
                {revelado && letra === questao.gabarito && (
                  <span className="sim-alt__icone">
                    <Check size={20} />
                  </span>
                )}
                {revelado && letra === resposta && !acertou && (
                  <span className="sim-alt__icone">
                    <Close size={20} />
                  </span>
                )}
              </button>
              {!revelado && (
                <IconButton
                  label={riscada ? `Desfazer risco da alternativa ${letra}` : `Riscar alternativa ${letra}`}
                  className="sim-riscar"
                  aria-pressed={riscada}
                  onClick={() => onRiscar(letra)}
                >
                  <Block size={20} />
                </IconButton>
              )}
            </div>
          );
        })}
      </div>

      {revelado && (
        <div
          ref={feedbackRef}
          className={`sim-feedback ${
            resposta === undefined ? "sim-feedback--neutro" : acertou ? "sim-feedback--certo" : "sim-feedback--errado"
          }`}
          role="status"
        >
          <p className="m3-title-small">
            {resposta === undefined
              ? `Em branco · resposta correta: ${questao.gabarito}`
              : acertou
                ? "Você acertou"
                : `Resposta correta: ${questao.gabarito}`}
          </p>
          <RichText className="sim-texto m3-body-medium" html={questao.justificativa} />
          {questao.referencia && (
            <p className="m3-label-medium">Para revisar: {descreverReferencia(questao.referencia)}</p>
          )}
        </div>
      )}
    </article>
  );
}
