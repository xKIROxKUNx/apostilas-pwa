import type { ItemRef, Simulado, Tentativa } from "./types";
import { chaveItem } from "./scoring";
import { BottomSheet, Button } from "@/components";

interface MapaQuestoesProps {
  simulado: Simulado;
  tentativa: Tentativa;
  itens: ItemRef[];
  indiceAtual: number;
  revelar: boolean;
  onIr: (indice: number) => void;
  onFinalizar?: () => void;
  onClose: () => void;
}

export default function MapaQuestoes({
  simulado,
  tentativa,
  itens,
  indiceAtual,
  revelar,
  onIr,
  onFinalizar,
  onClose,
}: MapaQuestoesProps) {
  const gabarito = new Map(simulado.objetivas.map((q) => [q.numero, q.gabarito]));
  const marcadas = new Set(tentativa.marcadas);
  const emBranco = itens.filter((item) => item.tipo === "objetiva" && !tentativa.respostas[item.numero]).length;

  function classe(item: ItemRef, indice: number): string {
    const classes = ["sim-mapa__item", "m3-interactive"];
    if (indice === indiceAtual) classes.push("sim-mapa__item--atual");
    if (item.tipo === "objetiva") {
      const resposta = tentativa.respostas[item.numero];
      if (resposta && (revelar || tentativa.modo === "treino")) {
        classes.push(resposta === gabarito.get(item.numero) ? "sim-mapa__item--certa" : "sim-mapa__item--errada");
      } else if (resposta) {
        classes.push("sim-mapa__item--respondida");
      } else if (revelar) {
        classes.push("sim-mapa__item--errada");
      }
    } else {
      const r = tentativa.discursivas[item.id];
      if (r && (r.texto.trim() || r.correcao.some((c) => c !== null))) classes.push("sim-mapa__item--respondida");
    }
    return classes.join(" ");
  }

  return (
    <BottomSheet title="Questões" onClose={onClose}>
      <div className="sim-legenda m3-body-small">
        {tentativa.modo === "prova" && !revelar ? <span>Azul: respondida</span> : <span>Verde: certa · Vermelho: errada</span>}
        <span>Ponto dourado: marcada para revisar</span>
      </div>
      <div className="sim-mapa">
        {itens.map((item, indice) => (
          <button
            key={chaveItem(item)}
            type="button"
            className={classe(item, indice)}
            data-sheet-active={indice === indiceAtual ? "" : undefined}
            onClick={() => onIr(indice)}
            aria-label={`Ir para ${item.tipo === "objetiva" ? `questão ${item.numero}` : `discursiva ${item.id}`}`}
          >
            {chaveItem(item)}
            {marcadas.has(chaveItem(item)) && <span className="sim-mapa__marca" />}
          </button>
        ))}
      </div>
      {onFinalizar && (
        <div style={{ padding: "0 24px 8px", display: "flex", flexDirection: "column", gap: 8 }}>
          {emBranco > 0 && (
            <p className="m3-body-small sim-muted">
              {emBranco} {emBranco === 1 ? "objetiva está em branco e conta" : "objetivas estão em branco e contam"} como erro.
            </p>
          )}
          <Button fullWidth onClick={onFinalizar}>
            Finalizar e ver resultado
          </Button>
        </div>
      )}
    </BottomSheet>
  );
}
