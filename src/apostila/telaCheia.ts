import { useEffect, useRef, useState, type RefObject } from "react";

const LIMIAR_BARRA_PX = 24;
const JANELA_INTERACAO_MS = 1000;
const ALVOS_INTERATIVOS = "button, a, input, textarea, select, [role='slider']";

function paisagem(): boolean {
  const tipo = screen.orientation?.type;
  return tipo ? tipo.startsWith("landscape") : matchMedia("(orientation: landscape)").matches;
}

function toque(): boolean {
  return matchMedia("(pointer: coarse)").matches;
}

function telaCheiaDisponivel(): boolean {
  return document.fullscreenEnabled === true && typeof document.documentElement.requestFullscreen === "function";
}

function emTelaCheia(): boolean {
  return Boolean(document.fullscreenElement);
}

export function useTelaCheiaNaPaisagem(aoVoltar: () => void): boolean {
  const aoVoltarRef = useRef(aoVoltar);
  aoVoltarRef.current = aoVoltar;
  const [imersivo, setImersivo] = useState(false);

  useEffect(() => {
    if (!toque()) return;
    const disponivel = telaCheiaDisponivel();
    let saindo = false;
    let interrompido = false;

    const atualizar = () => setImersivo(emTelaCheia() || (!disponivel && paisagem()));

    const entrar = () => {
      if (!disponivel || emTelaCheia() || document.visibilityState !== "visible") return;
      document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
    };

    const sair = () => {
      if (!emTelaCheia()) return;
      saindo = true;
      document.exitFullscreen().catch(() => {
        saindo = false;
      });
    };

    const aoGirar = () => {
      if (paisagem()) entrar();
      else sair();
      atualizar();
    };

    const aoMudarTelaCheia = () => {
      if (emTelaCheia()) {
        saindo = false;
        interrompido = false;
      } else if (saindo) {
        saindo = false;
      } else if (!interrompido && document.visibilityState === "visible" && paisagem()) {
        aoVoltarRef.current();
      }
      atualizar();
    };

    const interromper = () => {
      interrompido = true;
    };

    const aoMudarVisibilidade = () => {
      if (document.visibilityState === "hidden") interromper();
    };

    const aoTocar = (e: PointerEvent) => {
      if (emTelaCheia()) {
        interrompido = false;
        return;
      }
      if (!paisagem() || (e.target instanceof Element && e.target.closest(ALVOS_INTERATIVOS))) return;
      entrar();
    };

    const orientacao = screen.orientation;
    if (orientacao) orientacao.addEventListener("change", aoGirar);
    else window.addEventListener("orientationchange", aoGirar);
    document.addEventListener("fullscreenchange", aoMudarTelaCheia);
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    window.addEventListener("blur", interromper);
    window.addEventListener("beforeprint", interromper);
    window.addEventListener("pointerup", aoTocar, true);

    if (paisagem()) entrar();
    atualizar();

    return () => {
      if (orientacao) orientacao.removeEventListener("change", aoGirar);
      else window.removeEventListener("orientationchange", aoGirar);
      document.removeEventListener("fullscreenchange", aoMudarTelaCheia);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
      window.removeEventListener("blur", interromper);
      window.removeEventListener("beforeprint", interromper);
      window.removeEventListener("pointerup", aoTocar, true);
      sair();
    };
  }, []);

  return imersivo;
}

export function useBarraRecolhivel(rolagemRef: RefObject<HTMLElement | null>, ativo: boolean): boolean {
  const [oculta, setOculta] = useState(false);

  useEffect(() => {
    const r = rolagemRef.current;
    if (!ativo || !r) {
      setOculta(false);
      return;
    }
    let ultimo = r.scrollTop;
    let acumulado = 0;
    let interagiuEm = -Infinity;

    const marcarInteracao = () => {
      interagiuEm = performance.now();
    };

    const aoRolar = () => {
      const topo = r.scrollTop;
      const delta = topo - ultimo;
      ultimo = topo;
      if (topo <= LIMIAR_BARRA_PX) {
        acumulado = 0;
        setOculta(false);
        return;
      }
      if (performance.now() - interagiuEm > JANELA_INTERACAO_MS) {
        acumulado = 0;
        return;
      }
      acumulado = Math.sign(delta) === Math.sign(acumulado) ? acumulado + delta : delta;
      if (acumulado > LIMIAR_BARRA_PX) setOculta(true);
      else if (acumulado < -LIMIAR_BARRA_PX) setOculta(false);
    };

    const interacoes = ["touchstart", "touchmove", "wheel", "keydown"] as const;
    for (const tipo of interacoes) r.addEventListener(tipo, marcarInteracao, { passive: true });
    r.addEventListener("scroll", aoRolar, { passive: true });
    return () => {
      for (const tipo of interacoes) r.removeEventListener(tipo, marcarInteracao);
      r.removeEventListener("scroll", aoRolar);
    };
  }, [rolagemRef, ativo]);

  return oculta;
}
