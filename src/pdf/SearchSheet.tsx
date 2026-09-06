import type { SearchHit } from "./pdfTextIndex";
import { BottomSheet, Divider, ListItem, Spinner } from "@/components";

interface SearchSheetProps {
  results: SearchHit[];
  currentIndex: number;
  searching: boolean;
  onResultClick: (index: number) => void;
  onClose: () => void;
}

export default function SearchSheet({
  results,
  currentIndex,
  searching,
  onResultClick,
  onClose,
}: SearchSheetProps) {
  const titulo = results.length > 0 ? `Resultados (${results.length})` : "Resultados";

  return (
    <BottomSheet title={titulo} onClose={onClose}>
      {searching ? (
        <div className="m3-sheet__empty">
          <Spinner size={28} label="Procurando" />
        </div>
      ) : results.length === 0 ? (
        <p className="m3-body-medium m3-sheet__empty">Nenhuma ocorrência encontrada.</p>
      ) : (
        results.map((hit, i) => (
          <div key={`${hit.pageIndex}-${hit.ordinalInPage}`}>
            {i > 0 && <Divider />}
            <ListItem selected={i === currentIndex} onClick={() => onResultClick(i)}>
              <span
                className="m3-label-medium"
                style={{
                  color: i === currentIndex ? "var(--md-primary)" : "var(--md-on-surface-variant)",
                }}
              >
                Página {hit.pageIndex + 1}
              </span>
              <span className="m3-body-medium" style={{ color: "var(--md-on-surface-variant)" }}>
                {hit.snippet.slice(0, hit.matchStart)}
                <strong style={{ color: "var(--md-on-surface)", fontWeight: 700 }}>
                  {hit.snippet.slice(hit.matchStart, hit.matchEnd)}
                </strong>
                {hit.snippet.slice(hit.matchEnd)}
              </span>
            </ListItem>
          </div>
        ))
      )}
    </BottomSheet>
  );
}
