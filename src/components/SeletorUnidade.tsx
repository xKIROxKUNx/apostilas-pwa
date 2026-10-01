import { useEffect, useRef, useState } from "react";
import { Check, ExpandMore } from "./icons";

interface SeletorUnidadeProps {
  unidades: number[];
  selecionada: number;
  onSelecionar: (unidade: number) => void;
}

export function SeletorUnidade({ unidades, selecionada, onSelecionar }: SeletorUnidadeProps) {
  const [aberto, setAberto] = useState(false);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const itens = () => Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitemradio]") ?? []);
    itens().find((item) => item.getAttribute("aria-checked") === "true")?.focus();

    function fechar() {
      setAberto(false);
      botaoRef.current?.focus();
    }

    function onTecla(e: KeyboardEvent) {
      if (e.key === "Escape" || e.key === "Tab") {
        e.preventDefault();
        fechar();
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const lista = itens();
      const atual = lista.indexOf(document.activeElement as HTMLButtonElement);
      const passo = e.key === "ArrowDown" ? 1 : -1;
      lista[(atual + passo + lista.length) % lista.length]?.focus();
    }

    document.addEventListener("keydown", onTecla, true);
    return () => document.removeEventListener("keydown", onTecla, true);
  }, [aberto]);

  return (
    <div className="m3-seletor">
      <button
        ref={botaoRef}
        className="m3-chip-alvo"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={`Unidade ${selecionada}. Trocar unidade`}
        onClick={() => setAberto((v) => !v)}
      >
        <span className="m3-chip m3-interactive">
          Unidade {selecionada}
          <ExpandMore size={18} />
        </span>
      </button>
      {aberto && (
        <>
          <div className="m3-menu-fundo" onClick={() => setAberto(false)} />
          <div ref={menuRef} className="m3-menu" role="menu" aria-label="Unidades">
            {unidades.map((unidade) => (
              <button
                key={unidade}
                className="m3-menu__item m3-interactive m3-label-large"
                role="menuitemradio"
                aria-checked={unidade === selecionada}
                onClick={() => {
                  onSelecionar(unidade);
                  setAberto(false);
                  botaoRef.current?.focus();
                }}
              >
                <span className="m3-menu__marca">{unidade === selecionada && <Check size={20} />}</span>
                Unidade {unidade}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
