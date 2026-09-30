import { useEffect, useRef, useState } from "react";

const OCULTAR_MS = 1500;
const ALTURA_POLEGAR = 26;

export interface MarcoRolagem {
  titulo: string;
  fracao: number;
}

interface BarraRolagemProps {
  fracao: number;
  marcos: MarcoRolagem[];
  onFracao: (fracao: number) => void;
}

function marcoEm(marcos: MarcoRolagem[], fracao: number): MarcoRolagem | null {
  let escolhido: MarcoRolagem | null = null;
  for (const m of marcos) {
    if (m.fracao <= fracao + 0.0005) escolhido = m;
    else break;
  }
  return escolhido;
}

export default function BarraRolagem({ fracao, marcos, onFracao }: BarraRolagemProps) {
  const trilhoRef = useRef<HTMLDivElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const [fracaoArraste, setFracaoArraste] = useState(0);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    setVisivel(true);
    if (arrastando) return;
    const id = setTimeout(() => setVisivel(false), OCULTAR_MS);
    return () => clearTimeout(id);
  }, [fracao, arrastando]);

  const atual = arrastando ? fracaoArraste : fracao;
  const marco = marcoEm(marcos, fracaoArraste);

  function mover(clientY: number) {
    const trilho = trilhoRef.current;
    if (!trilho) return;
    const rect = trilho.getBoundingClientRect();
    const util = Math.max(rect.height - ALTURA_POLEGAR, 1);
    const f = Math.min(Math.max((clientY - rect.top - ALTURA_POLEGAR / 2) / util, 0), 1);
    setFracaoArraste(f);
    onFracao(f);
  }

  return (
    <div style={{ ...estilos.envoltorio, opacity: visivel ? 1 : 0, pointerEvents: visivel ? "auto" : "none" }}>
      <div
        ref={trilhoRef}
        style={estilos.trilho}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture(e.pointerId);
          setArrastando(true);
          mover(e.clientY);
        }}
        onPointerMove={(e) => {
          if (arrastando) mover(e.clientY);
        }}
        onPointerUp={() => setArrastando(false)}
        onPointerCancel={() => setArrastando(false)}
      >
        <div style={estilos.linha} />
        <div
          style={{
            ...estilos.polegar,
            top: `calc(${atual} * (100% - ${ALTURA_POLEGAR}px))`,
            background: arrastando
              ? "var(--md-primary)"
              : "color-mix(in srgb, var(--md-primary) 55%, transparent)",
          }}
        />
      </div>
      {arrastando && (
        <div style={{ ...estilos.dica, top: `calc(${atual} * (100% - ${ALTURA_POLEGAR}px) + ${ALTURA_POLEGAR / 2}px)` }}>
          <p className="m3-label-medium" style={{ margin: 0, color: "var(--md-inverse-on-surface)" }}>
            {Math.round(atual * 100)}%
          </p>
          {marco && (
            <p className="m3-title-small" style={estilos.dicaTitulo}>
              {marco.titulo}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const estilos: Record<string, React.CSSProperties> = {
  envoltorio: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: 32,
    zIndex: "var(--z-scroller)" as unknown as number,
    transition: "opacity 200ms ease",
  },
  trilho: {
    position: "absolute",
    top: 12,
    bottom: 12,
    left: 0,
    right: 0,
    touchAction: "none",
  },
  linha: {
    position: "absolute",
    right: 3,
    top: 0,
    bottom: 0,
    width: 4,
    borderRadius: "var(--md-shape-full)",
    background: "var(--md-outline-variant)",
  },
  polegar: {
    position: "absolute",
    right: 0,
    width: 10,
    height: ALTURA_POLEGAR,
    borderRadius: "var(--md-shape-full)",
    boxShadow: "var(--md-elev-1)",
  },
  dica: {
    position: "absolute",
    right: 40,
    transform: "translateY(-50%)",
    background: "var(--md-inverse-surface)",
    borderRadius: "var(--md-shape-md)",
    padding: "10px 14px",
    boxShadow: "var(--md-elev-3)",
    minWidth: 140,
    maxWidth: 240,
  },
  dicaTitulo: {
    margin: "4px 0 0",
    color: "var(--md-inverse-on-surface)",
    fontWeight: 700,
  },
};
