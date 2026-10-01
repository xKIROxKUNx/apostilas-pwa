import { Spinner } from "./index";

export function TelaCarregando({ texto, sobreposta }: { texto: string; sobreposta?: boolean }) {
  return (
    <div className={`tela-carregando${sobreposta ? " tela-carregando--sobreposta" : ""}`} role="status" aria-live="polite">
      <h1 className="m3-headline-medium tela-carregando__titulo">Apostilas</h1>
      <Spinner size={28} />
      <p className="m3-body-medium tela-carregando__texto">{texto}</p>
    </div>
  );
}
