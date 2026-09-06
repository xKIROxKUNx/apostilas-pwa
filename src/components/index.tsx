import { useEffect, useLayoutEffect, useRef } from "react";
import "./ui.css";

type ButtonVariant = "filled" | "tonal" | "text";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

export function Button({
  variant = "filled",
  fullWidth,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`m3-btn m3-btn--${variant} m3-interactive m3-label-large${
        fullWidth ? " m3-btn--full" : ""
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  tone?: "default" | "primary" | "error";
}

export function IconButton({ label, tone = "default", className = "", children, ...rest }: IconButtonProps) {
  return (
    <button
      className={`m3-icon-btn m3-interactive${
        tone === "default" ? "" : ` m3-icon-btn--${tone}`
      } ${className}`}
      aria-label={label}
      title={label}
      {...rest}
    >
      {children}
    </button>
  );
}

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "elevated" | "filled" | "primary";
  radius?: "md" | "lg" | "xl";
  interactive?: boolean;
}

export function Card({
  variant = "elevated",
  radius = "lg",
  interactive,
  className = "",
  children,
  ...rest
}: CardProps) {
  const r = radius === "lg" ? "" : ` m3-card--r-${radius}`;
  return (
    <div
      className={`m3-card m3-card--${variant}${r}${interactive ? " m3-interactive" : ""} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "placeholder"> {
  label: string;
  error?: boolean;
  supportingText?: string;
  trailing?: React.ReactNode;
}

export function TextField({
  label,
  error,
  supportingText,
  trailing,
  id,
  className = "",
  ...rest
}: TextFieldProps) {
  const generated = useRef(`f${Math.random().toString(36).slice(2, 9)}`);
  const fieldId = id ?? generated.current;

  return (
    <div className={`m3-field${error ? " m3-field--error" : ""} ${className}`}>
      {
        }
      <input id={fieldId} className="m3-field__input" placeholder=" " {...rest} />
      <label htmlFor={fieldId} className="m3-field__label">
        {label}
      </label>
      {trailing ? <div className="m3-field__trailing">{trailing}</div> : null}
      {supportingText ? (
        <span className="m3-field__support m3-body-small">{supportingText}</span>
      ) : null}
    </div>
  );
}

const ITEM_MIN_H = 56;

interface BottomSheetProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function BottomSheet({ title, onClose, children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const grabRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    sheetRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const alvos = sheetRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!alvos || alvos.length === 0) return;
      const primeiro = alvos[0];
      const ultimo = alvos[alvos.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      anterior?.focus?.();
    };
  }, [onClose]);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    const alvo = body?.querySelector<HTMLElement>("[data-sheet-active]");
    if (!body || !alvo) return;
    const alvoRect = alvo.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    body.scrollTop += alvoRect.top - bodyRect.top - ITEM_MIN_H;
  }, []);

  useEffect(() => {
    const sheet = sheetRef.current;
    const grab = grabRef.current;
    const body = bodyRef.current;
    if (!sheet || !grab) return;

    let inicioY = 0;
    let delta = 0;
    let arrastando = false;

    const limiar = () => Math.min(sheet.getBoundingClientRect().height * 0.25, 120);

    function podeIniciar(alvo: EventTarget | null) {
      if (grab && alvo instanceof Node && grab.contains(alvo)) return true;
      if (body && alvo instanceof Node && body.contains(alvo)) return body.scrollTop <= 0;
      return false;
    }

    function onStart(e: TouchEvent) {
      if (e.touches.length !== 1) return;
      if (!podeIniciar(e.target)) return;
      inicioY = e.touches[0].clientY;
      delta = 0;
      arrastando = true;
      sheet!.style.transition = "none";
    }

    function onMove(e: TouchEvent) {
      if (!arrastando || e.touches.length !== 1) return;
      const d = e.touches[0].clientY - inicioY;

      if (d <= 0) {
        if (delta === 0) arrastando = false;
        return;
      }

      if (e.cancelable) e.preventDefault();
      delta = d;
      sheet!.style.transform = `translateY(${d}px)`;
    }

    function onEnd() {
      if (!arrastando) return;
      arrastando = false;
      sheet!.style.transition = "";
      if (delta > limiar()) {
        onClose();
      } else {
        sheet!.style.transform = "";
      }
      delta = 0;
    }

    sheet.addEventListener("touchstart", onStart, { passive: false });
    sheet.addEventListener("touchmove", onMove, { passive: false });
    sheet.addEventListener("touchend", onEnd);
    sheet.addEventListener("touchcancel", onEnd);
    return () => {
      sheet.removeEventListener("touchstart", onStart);
      sheet.removeEventListener("touchmove", onMove);
      sheet.removeEventListener("touchend", onEnd);
      sheet.removeEventListener("touchcancel", onEnd);
    };
  }, [onClose]);

  return (
    <div className="m3-scrim" onClick={onClose}>
      <div
        ref={sheetRef}
        className="m3-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div ref={grabRef} className="m3-sheet__grab">
          <div className="m3-sheet__handle" />
          <h2 className="m3-sheet__title m3-title-large">{title}</h2>
        </div>
        <div ref={bodyRef} className="m3-sheet__body">
          {children}
        </div>
      </div>
    </div>
  );
}

export function ListItem({
  className = "",
  selected,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      className={`m3-list-item m3-interactive${selected ? " m3-list-item--selected" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Divider({ className = "" }: { className?: string }) {
  return <hr className={`m3-divider ${className}`} />;
}

export function Spinner({ size = 32, label }: { size?: number; label?: string }) {
  return (
    <div
      className="m3-spinner"
      style={{ width: size, height: size, borderWidth: Math.max(2, Math.round(size / 11)) }}
      role={label ? "status" : undefined}
      aria-label={label}
    />
  );
}

export function Snackbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="m3-snackbar m3-body-medium" role="status" aria-live="polite">
      {children}
    </div>
  );
}

export function TopAppBar({
  raised,
  className = "",
  children,
}: {
  raised?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <header className={`m3-appbar${raised ? " m3-appbar--raised" : ""} ${className}`}>
      {children}
    </header>
  );
}
