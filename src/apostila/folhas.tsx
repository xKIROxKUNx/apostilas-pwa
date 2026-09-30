import type { TituloApostila } from "./prepararApostila";
import type { Ocorrencia } from "./buscaApostila";
import { BottomSheet, Button, Divider, ListItem } from "@/components";

export function SumarioApostila({
  titulos,
  atualId,
  onIr,
  onClose,
}: {
  titulos: TituloApostila[];
  atualId: string | null;
  onIr: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet title="Sumário" onClose={onClose}>
      {titulos.length === 0 ? (
        <p className="m3-body-medium m3-sheet__empty">Nenhum sumário disponível.</p>
      ) : (
        titulos.map((t, i) => (
          <div key={t.id} data-sheet-active={t.id === atualId ? "" : undefined}>
            {i > 0 && t.nivel === 0 && <Divider />}
            <ListItem
              selected={t.id === atualId}
              onClick={() => onIr(t.id)}
              style={{ paddingLeft: 24 + t.nivel * 20, minHeight: t.nivel === 0 ? 56 : 44 }}
            >
              <span
                className={t.nivel === 0 ? "m3-title-small" : "m3-body-medium"}
                style={{ color: t.nivel === 0 ? "var(--md-primary)" : "var(--md-on-surface)" }}
              >
                {t.titulo}
              </span>
            </ListItem>
          </div>
        ))
      )}
    </BottomSheet>
  );
}

export function ResultadosBusca({
  ocorrencias,
  capitulos,
  atual,
  onEscolher,
  onClose,
}: {
  ocorrencias: Ocorrencia[];
  capitulos: (string | null)[];
  atual: number;
  onEscolher: (indice: number) => void;
  onClose: () => void;
}) {
  const titulo = ocorrencias.length > 0 ? `Resultados (${ocorrencias.length})` : "Resultados";
  return (
    <BottomSheet title={titulo} onClose={onClose}>
      {ocorrencias.length === 0 ? (
        <p className="m3-body-medium m3-sheet__empty">Nenhuma ocorrência encontrada.</p>
      ) : (
        ocorrencias.map((o, i) => (
          <div key={i} data-sheet-active={i === atual ? "" : undefined}>
            {i > 0 && <Divider />}
            <ListItem selected={i === atual} onClick={() => onEscolher(i)}>
              {capitulos[i] && (
                <span
                  className="m3-label-medium"
                  style={{ color: i === atual ? "var(--md-primary)" : "var(--md-on-surface-variant)" }}
                >
                  {capitulos[i]}
                </span>
              )}
              <span className="m3-body-medium" style={{ color: "var(--md-on-surface-variant)" }}>
                {o.trecho.slice(0, o.destaqueInicio)}
                <strong style={{ color: "var(--md-on-surface)", fontWeight: 700 }}>
                  {o.trecho.slice(o.destaqueInicio, o.destaqueFim)}
                </strong>
                {o.trecho.slice(o.destaqueFim)}
              </span>
            </ListItem>
          </div>
        ))
      )}
    </BottomSheet>
  );
}

export function AjusteTexto({
  escala,
  minimo,
  maximo,
  onMenor,
  onMaior,
  onPadrao,
  onClose,
}: {
  escala: number;
  minimo: boolean;
  maximo: boolean;
  onMenor: () => void;
  onMaior: () => void;
  onPadrao: () => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet title="Tamanho do texto" onClose={onClose}>
      <div className="ap-ajuste">
        <Button variant="tonal" onClick={onMenor} disabled={minimo} aria-label="Diminuir o texto">
          <span style={{ fontSize: 14 }}>A−</span>
        </Button>
        <span className="m3-title-medium ap-ajuste__valor">{Math.round(escala * 100)}%</span>
        <Button variant="tonal" onClick={onMaior} disabled={maximo} aria-label="Aumentar o texto">
          <span style={{ fontSize: 20 }}>A+</span>
        </Button>
      </div>
      <div style={{ padding: "0 24px 12px" }}>
        <Button variant="text" fullWidth onClick={onPadrao} disabled={escala === 1}>
          Voltar ao padrão
        </Button>
      </div>
    </BottomSheet>
  );
}
