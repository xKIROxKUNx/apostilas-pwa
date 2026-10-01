import { useRef } from "react";
import { useTheme } from "@/state/ThemeContext";
import { useFocoModal } from "./index";
import { DarkMode, LightMode, Logout, Refresh } from "./icons";

interface MenuLateralProps {
  nome: string;
  onFechar: () => void;
  onSair: () => void;
}

export function MenuLateral({ nome, onFechar, onSair }: MenuLateralProps) {
  const painelRef = useRef<HTMLDivElement>(null);
  const { resolved, toggle } = useTheme();
  useFocoModal(painelRef, onFechar);

  const escuro = resolved === "dark";

  return (
    <div className="m3-drawer-fundo" onClick={onFechar}>
      <div
        ref={painelRef}
        className="m3-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="m3-drawer__cabecalho">
          <p className="m3-title-large">Apostilas</p>
          <p className="m3-body-medium m3-drawer__nome">{nome}</p>
        </div>
        <button className="m3-drawer__item m3-interactive m3-label-large" onClick={() => location.reload()}>
          <Refresh />
          Atualizar a página
        </button>
        <button className="m3-drawer__item m3-interactive m3-label-large" onClick={toggle}>
          {escuro ? <LightMode /> : <DarkMode />}
          {escuro ? "Mudar para o tema claro" : "Mudar para o tema escuro"}
        </button>
        <button className="m3-drawer__item m3-interactive m3-label-large" onClick={onSair}>
          <Logout />
          Sair
        </button>
      </div>
    </div>
  );
}
