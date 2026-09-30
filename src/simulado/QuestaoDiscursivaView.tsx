import { useState } from "react";
import type { FracaoCriterio, QuestaoDiscursiva, RespostaDiscursiva } from "./types";
import { descreverReferencia, notaDiscursiva } from "./scoring";
import { ChipDificuldade } from "./partes";
import RichText from "./RichText";
import { Button } from "@/components";

const OPCOES: Array<{ valor: FracaoCriterio; rotulo: string }> = [
  { valor: 1, rotulo: "Integral" },
  { valor: 0.5, rotulo: "Metade" },
  { valor: 0, rotulo: "Zero" },
];

interface QuestaoDiscursivaViewProps {
  questao: QuestaoDiscursiva;
  resposta?: RespostaDiscursiva;
  podeCorrigir: boolean;
  orientacaoEspelho?: string | null;
  onTexto: (texto: string) => void;
  onCorrigir: (indice: number, fracao: FracaoCriterio) => void;
}

export default function QuestaoDiscursivaView({
  questao,
  resposta,
  podeCorrigir,
  orientacaoEspelho,
  onTexto,
  onCorrigir,
}: QuestaoDiscursivaViewProps) {
  const jaCorrigindo = resposta?.correcao.some((c) => c !== null) ?? false;
  const [mostrarEspelho, setMostrarEspelho] = useState(jaCorrigindo);
  const nota = notaDiscursiva(questao, resposta);
  const campoId = `resposta-${questao.id}`;

  return (
    <article className="sim-questao">
      <div className="sim-questao__meta">
        <span className="m3-title-medium">Discursiva {questao.id}</span>
        <ChipDificuldade dificuldade={questao.dificuldade} />
        <span className="sim-chip sim-chip--neutro">{questao.pontos} pontos</span>
        {podeCorrigir && mostrarEspelho && <span className="m3-body-small sim-muted">{questao.tema}</span>}
      </div>

      {questao.caso && (
        <div className="sim-caso">
          <span className="sim-caso__rotulo m3-label-medium">Caso clínico</span>
          <RichText className="sim-texto m3-body-medium" html={questao.caso} />
        </div>
      )}

      <RichText className="sim-texto m3-body-large" html={questao.enunciado} />

      <label htmlFor={campoId} className="m3-label-large sim-muted">
        Sua resposta (opcional, fica salva neste aparelho)
      </label>
      <textarea
        id={campoId}
        className="sim-textarea"
        value={resposta?.texto ?? ""}
        onChange={(e) => onTexto(e.target.value)}
        placeholder="Escreva frases completas: o espelho pontua conceito e justificativa."
      />

      {!podeCorrigir ? (
        <p className="m3-body-small sim-muted">O espelho de correção fica disponível quando você finalizar o simulado.</p>
      ) : !mostrarEspelho ? (
        <Button variant="tonal" onClick={() => setMostrarEspelho(true)}>
          Ver espelho de correção
        </Button>
      ) : (
        <section className="sim-card m3-card m3-card--filled" aria-label="Espelho de correção">
          <p className="m3-title-small">Espelho de correção</p>
          {orientacaoEspelho && <RichText className="sim-texto m3-body-small sim-muted" html={orientacaoEspelho} />}
          {questao.espelho.map((criterio, i) => (
            <div key={i} className="sim-criterio">
              <RichText className="sim-texto m3-body-medium" html={criterio.texto} />
              <span className="m3-label-medium sim-muted">
                {criterio.pontos} {criterio.pontos === 1 ? "ponto" : "pontos"}
              </span>
              <div className="sim-segmentado" role="radiogroup" aria-label={`Pontuação do critério ${i + 1}`}>
                {OPCOES.map(({ valor, rotulo }) => (
                  <button
                    key={rotulo}
                    type="button"
                    role="radio"
                    aria-checked={resposta?.correcao[i] === valor}
                    onClick={() => onCorrigir(i, valor)}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="m3-title-medium">
            {nota === null
              ? "Pontue todos os critérios para ver a nota."
              : `Nota: ${nota.toLocaleString("pt-BR")} de ${questao.pontos}`}
          </p>
          {questao.referencia && (
            <p className="m3-label-medium sim-muted">Para revisar: {descreverReferencia(questao.referencia)}</p>
          )}
        </section>
      )}
    </article>
  );
}
