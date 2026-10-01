import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { IconButton } from "@/components";
import { Close } from "@/components/icons";

const MARGEM_PX = 12;
const ESCALA_MAXIMA = 5;
const TOQUE_DISTANCIA_PX = 10;
const TOQUE_DURACAO_MS = 250;
const ANIMACAO_MS = 220;
const ATENUACAO_RODA = 0.002;
const PROPORCAO_LARGA = 1.3;
const ESPERA_VOLTAR_MS = 400;

interface Tamanho {
  w: number;
  h: number;
}

interface Vista {
  s: number;
  x: number;
  y: number;
}

interface Ponto {
  x: number;
  y: number;
}

interface Gesto {
  inicio: number;
  origem: Ponto;
  toque: boolean;
  vista: Vista;
  distancia: number;
  meio: Ponto;
}

function proporcaoDe(midia: Element | null): number {
  if (midia instanceof SVGSVGElement) {
    const caixa = midia.viewBox.baseVal;
    if (caixa && caixa.width > 0 && caixa.height > 0) return caixa.width / caixa.height;
  }
  if (midia instanceof HTMLImageElement && midia.naturalWidth > 0 && midia.naturalHeight > 0) {
    return midia.naturalWidth / midia.naturalHeight;
  }
  const r = midia?.getBoundingClientRect();
  return r && r.width > 0 && r.height > 0 ? r.width / r.height : 4 / 3;
}

function limitar(v: Vista, base: Tamanho, palco: Tamanho): Vista {
  const w = base.w * v.s;
  const h = base.h * v.s;
  const x = w <= palco.w ? (palco.w - w) / 2 : Math.min(0, Math.max(palco.w - w, v.x));
  const y = h <= palco.h ? (palco.h - h) / 2 : Math.min(0, Math.max(palco.h - h, v.y));
  return { s: v.s, x, y };
}

function baseDe(palco: Tamanho, proporcao: number): Tamanho {
  const w = Math.max(Math.min(palco.w - 2 * MARGEM_PX, (palco.h - 2 * MARGEM_PX) * proporcao), 1);
  return { w, h: w / proporcao };
}

function semAnimacao(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface FiguraAmpliadaProps {
  origem: Element;
  marcaDagua?: string;
  onFechar: () => void;
}

export default function FiguraAmpliada({ origem, marcaDagua, onFechar }: FiguraAmpliadaProps) {
  const midia = useMemo(() => (origem.matches("svg, img") ? origem : origem.querySelector("svg, img")), [origem]);
  const legenda = useMemo(() => origem.querySelector("figcaption"), [origem]);
  const proporcao = useMemo(() => proporcaoDe(midia), [midia]);

  const camadaRef = useRef<HTMLDivElement>(null);
  const palcoRef = useRef<HTMLDivElement>(null);
  const quadroRef = useRef<HTMLDivElement>(null);
  const legendaRef = useRef<HTMLParagraphElement>(null);
  const fecharRef = useRef<HTMLDivElement>(null);
  const ponteiros = useRef(new Map<number, Ponto>());
  const gesto = useRef<Gesto | null>(null);
  const toqueValido = useRef(false);
  const fechando = useRef(false);
  const voltando = useRef(false);

  const [palco, setPalco] = useState<Tamanho | null>(null);
  const [vista, setVista] = useState<Vista | null>(null);
  const vistaRef = useRef(vista);
  vistaRef.current = vista;

  const base = useMemo(() => (palco ? baseDe(palco, proporcao) : null), [palco, proporcao]);

  const terminar = useCallback(() => {
    if (fechando.current) return;
    fechando.current = true;
    let feito = false;
    const concluir = () => {
      if (feito) return;
      feito = true;
      onFechar();
    };
    const quadro = quadroRef.current;
    const camada = camadaRef.current;
    const destino = midia?.getBoundingClientRect();
    const visivel = destino && destino.bottom > 0 && destino.top < window.innerHeight && destino.width > 0;
    if (!quadro || !camada || semAnimacao() || document.hidden) {
      concluir();
      return;
    }
    camada.classList.add("ap-figura-ampliada--saindo");
    setTimeout(concluir, ANIMACAO_MS + 80);
    if (!visivel) return;
    const atual = quadro.getBoundingClientRect();
    const animacao = quadro.animate(
      [
        { transform: "none" },
        {
          transform: `translate(${destino.left - atual.left}px, ${destino.top - atual.top}px) scale(${destino.width / atual.width}, ${destino.height / atual.height})`,
        },
      ],
      { duration: ANIMACAO_MS, easing: "cubic-bezier(0.3, 0, 0.8, 0.15)", fill: "forwards" },
    );
    animacao.onfinish = concluir;
    animacao.oncancel = concluir;
  }, [midia, onFechar]);

  const pedirFechar = useCallback(() => {
    if (fechando.current || voltando.current) return;
    if ((history.state as { apFigura?: boolean } | null)?.apFigura) {
      voltando.current = true;
      history.back();
      setTimeout(terminar, ESPERA_VOLTAR_MS);
    } else {
      terminar();
    }
  }, [terminar]);

  useEffect(() => {
    if (!(history.state as { apFigura?: boolean } | null)?.apFigura) {
      history.pushState({ ...(history.state as object | null), apFigura: true }, "");
    }
    window.addEventListener("popstate", terminar);
    return () => window.removeEventListener("popstate", terminar);
  }, [terminar]);

  useEffect(() => {
    const anterior = document.activeElement;
    const botao = () => fecharRef.current?.querySelector("button");
    botao()?.focus({ preventScroll: true });
    function onTecla(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        pedirFechar();
      } else if (e.key === "Tab") {
        e.preventDefault();
        botao()?.focus();
      }
    }
    document.addEventListener("keydown", onTecla, true);
    return () => {
      document.removeEventListener("keydown", onTecla, true);
      if (origem instanceof HTMLElement || origem instanceof SVGElement) origem.focus({ preventScroll: true });
      else if (anterior instanceof HTMLElement) anterior.focus({ preventScroll: true });
    };
  }, [origem, pedirFechar]);

  useLayoutEffect(() => {
    const quadro = quadroRef.current;
    if (!quadro || !midia) return;
    const copia = midia.cloneNode(true) as Element;
    copia.removeAttribute("id");
    copia.setAttribute("aria-hidden", "true");
    quadro.replaceChildren(copia);
  }, [midia]);

  useLayoutEffect(() => {
    const destino = legendaRef.current;
    if (!destino || !legenda) return;
    destino.replaceChildren(...Array.from(legenda.childNodes, (n) => n.cloneNode(true)));
  }, [legenda]);

  useLayoutEffect(() => {
    const el = palcoRef.current;
    if (!el) return;
    const medir = () => {
      const r = el.getBoundingClientRect();
      setPalco((p) => (p && p.w === r.width && p.h === r.height ? p : { w: r.width, h: r.height }));
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!palco || !base) return;
    setVista(limitar({ s: 1, x: 0, y: 0 }, base, palco));
  }, [palco, base]);

  const animouEntrada = useRef(false);
  useLayoutEffect(() => {
    const quadro = quadroRef.current;
    if (!quadro || !vista || animouEntrada.current) return;
    animouEntrada.current = true;
    const de = midia?.getBoundingClientRect();
    if (!de || de.width === 0 || semAnimacao()) return;
    const para = quadro.getBoundingClientRect();
    quadro.animate(
      [
        {
          transform: `translate(${de.left - para.left}px, ${de.top - para.top}px) scale(${de.width / para.width}, ${de.height / para.height})`,
        },
        { transform: "none" },
      ],
      { duration: ANIMACAO_MS, easing: "cubic-bezier(0.2, 0, 0, 1)" },
    );
  }, [vista, midia]);

  const local = useCallback((e: { clientX: number; clientY: number }): Ponto => {
    const r = palcoRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  }, []);

  const recomecar = useCallback((toque: boolean, inicio: number) => {
    const pts = Array.from(ponteiros.current.values());
    const [a, b] = pts;
    gesto.current = {
      inicio,
      toque,
      origem: a ?? { x: 0, y: 0 },
      vista: vistaRef.current ?? { s: 1, x: 0, y: 0 },
      distancia: a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 0,
      meio: a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : (a ?? { x: 0, y: 0 }),
    };
  }, []);

  const aplicar = useCallback(
    (v: Vista) => {
      if (!palco || !base) return;
      setVista(limitar(v, base, palco));
    },
    [palco, base],
  );

  function onPointerDown(e: React.PointerEvent) {
    if (fechando.current || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    ponteiros.current.set(e.pointerId, local(e));
    const primeiro = ponteiros.current.size === 1;
    recomecar(primeiro, primeiro ? e.timeStamp : (gesto.current?.inicio ?? e.timeStamp));
    if (!primeiro && gesto.current) gesto.current.toque = false;
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!ponteiros.current.has(e.pointerId)) return;
    ponteiros.current.set(e.pointerId, local(e));
    const g = gesto.current;
    if (!g) return;
    const pts = Array.from(ponteiros.current.values());
    if (pts.length === 1) {
      const dx = pts[0].x - g.origem.x;
      const dy = pts[0].y - g.origem.y;
      if (Math.hypot(dx, dy) > TOQUE_DISTANCIA_PX) g.toque = false;
      if (g.vista.s > 1) aplicar({ s: g.vista.s, x: g.vista.x + dx, y: g.vista.y + dy });
      return;
    }
    const [a, b] = pts;
    const distancia = Math.hypot(b.x - a.x, b.y - a.y);
    const meio = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (g.distancia <= 0) return;
    const s = Math.min(Math.max((g.vista.s * distancia) / g.distancia, 1), ESCALA_MAXIMA);
    const cx = (g.meio.x - g.vista.x) / g.vista.s;
    const cy = (g.meio.y - g.vista.y) / g.vista.s;
    aplicar({ s, x: meio.x - cx * s, y: meio.y - cy * s });
  }

  function onPointerFim(e: React.PointerEvent) {
    if (!ponteiros.current.delete(e.pointerId)) return;
    const g = gesto.current;
    if (ponteiros.current.size > 0) {
      recomecar(false, g?.inicio ?? e.timeStamp);
      return;
    }
    const rapido = e.pointerType === "mouse" || e.timeStamp - (g?.inicio ?? 0) <= TOQUE_DURACAO_MS;
    toqueValido.current = e.type === "pointerup" && !!g?.toque && rapido;
    gesto.current = null;
    if ((vistaRef.current?.s ?? 1) < 1.02) aplicar({ s: 1, x: 0, y: 0 });
  }

  function onRoda(e: WheelEvent) {
    e.preventDefault();
    const v = vistaRef.current;
    if (!v) return;
    const p = local(e);
    const s = Math.min(Math.max(v.s * Math.exp(-e.deltaY * ATENUACAO_RODA), 1), ESCALA_MAXIMA);
    const cx = (p.x - v.x) / v.s;
    const cy = (p.y - v.y) / v.s;
    aplicar({ s, x: p.x - cx * s, y: p.y - cy * s });
  }

  const onRodaRef = useRef(onRoda);
  onRodaRef.current = onRoda;
  useEffect(() => {
    const el = palcoRef.current;
    const camada = camadaRef.current;
    if (!el || !camada) return;
    const ouvinte = (e: WheelEvent) => onRodaRef.current(e);
    const bloquear = (e: Event) => e.preventDefault();
    el.addEventListener("wheel", ouvinte, { passive: false });
    camada.addEventListener("gesturestart", bloquear);
    camada.addEventListener("gesturechange", bloquear);
    return () => {
      el.removeEventListener("wheel", ouvinte);
      camada.removeEventListener("gesturestart", bloquear);
      camada.removeEventListener("gesturechange", bloquear);
    };
  }, []);

  const girar = !!palco && palco.h > palco.w && proporcao >= PROPORCAO_LARGA;

  const posicao: React.CSSProperties =
    base && vista
      ? { width: base.w * vista.s, height: base.h * vista.s, left: vista.x, top: vista.y }
      : { visibility: "hidden" };

  return (
    <div
      ref={camadaRef}
      className="ap-figura-ampliada"
      role="dialog"
      aria-modal="true"
      aria-label={origem.querySelector(".fig-num")?.textContent?.trim() || "Figura ampliada"}
    >
      <div
        ref={palcoRef}
        className="ap-figura-palco"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerFim}
        onPointerCancel={onPointerFim}
        onClick={() => {
          if (toqueValido.current) pedirFechar();
          toqueValido.current = false;
        }}
      >
        <div ref={quadroRef} className="ap-figura-quadro" style={posicao} />
      </div>
      <div className="ap-figura-rodape" onClick={pedirFechar}>
        {legenda && <p ref={legendaRef} className="m3-body-medium ap-figura-legenda" />}
        <p className="m3-body-small ap-figura-dica">
          <span className="ap-figura-dica--toque">
            {girar ? "Gire o celular para ver maior · " : ""}Toque para fechar · use dois dedos para ampliar
          </span>
          <span className="ap-figura-dica--mouse">Clique para fechar · role para ampliar</span>
        </p>
      </div>
      <div ref={fecharRef} className="ap-figura-fechar">
        <IconButton label="Fechar figura" onClick={pedirFechar}>
          <Close />
        </IconButton>
      </div>
      {marcaDagua && (
        <div className="ap-marca-dagua ap-marca-dagua--figura" aria-hidden>
          {marcaDagua}
        </div>
      )}
    </div>
  );
}
