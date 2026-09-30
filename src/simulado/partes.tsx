import { useEffect, useState } from "react";
import type { Dificuldade } from "./types";
import { ROTULO_DIFICULDADE, formatarDuracao, porcentagem, type Placar } from "./scoring";
import { Timer } from "@/components/icons";

export function ChipDificuldade({ dificuldade }: { dificuldade: Dificuldade }) {
  return <span className={`sim-chip sim-chip--${dificuldade}`}>{ROTULO_DIFICULDADE[dificuldade]}</span>;
}

export function LinhaPlacar({
  rotulo,
  placar,
  fraca,
  detalhe,
}: {
  rotulo: string;
  placar: Placar;
  fraca?: boolean;
  detalhe?: string;
}) {
  const pct = porcentagem(placar);
  return (
    <div className="sim-linha-barra">
      <div className="sim-linha-barra__topo">
        <span className="m3-body-medium">
          {rotulo}
          {detalhe ? <span className="sim-muted"> · {detalhe}</span> : null}
        </span>
        <span className="m3-label-large" style={{ whiteSpace: "nowrap" }}>
          {placar.acertos}/{placar.total} · {pct}%
        </span>
      </div>
      <div className={`sim-barra${fraca ? " sim-barra--fraca" : ""}`} role="presentation">
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Cronometro({ acumuladoMs, desde }: { acumuladoMs: number; desde: number | null }) {
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    if (desde === null) return;
    const id = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [desde]);

  const total = acumuladoMs + (desde === null ? 0 : Math.max(0, agora - desde));
  const segundos = Math.floor(total / 1000);
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  const texto = h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;

  return (
    <span className="sim-status m3-label-large" aria-label={`Tempo: ${formatarDuracao(total)}`}>
      <Timer size={18} />
      {texto}
    </span>
  );
}
