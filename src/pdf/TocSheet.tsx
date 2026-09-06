import type { TocEntry } from "@/types/domain";
import { BottomSheet, Divider, ListItem } from "@/components";
import { chapterIndexForPage } from "./usePdfDocument";

interface TocSheetProps {
  entries: TocEntry[];
  currentPageIndex: number;
  onEntryClick: (pageIndex: number) => void;
  onClose: () => void;
}

export default function TocSheet({
  entries,
  currentPageIndex,
  onEntryClick,
  onClose,
}: TocSheetProps) {
  const atual = chapterIndexForPage(entries, currentPageIndex);

  return (
    <BottomSheet title="Sumário" onClose={onClose}>
      {entries.length === 0 ? (
        <p className="m3-body-medium m3-sheet__empty">
          Nenhum sumário disponível para este PDF.
        </p>
      ) : (
        entries.map((entry, i) => (
          <div key={i} data-sheet-active={i === atual ? "" : undefined}>
            {i > 0 && <Divider />}
            <ListItem
              onClick={() => onEntryClick(entry.pageIndex)}
              style={{ paddingLeft: 24 + entry.depth * 16 }}
            >
              <span
                className={entry.depth === 0 ? "m3-title-small" : "m3-body-large"}
                style={{ color: entry.depth === 0 ? "var(--md-primary)" : "var(--md-on-surface)" }}
              >
                {entry.title}
              </span>
              <span className="m3-body-small" style={{ color: "var(--md-on-surface-variant)" }}>
                Página {entry.pageIndex + 1}
              </span>
            </ListItem>
          </div>
        ))
      )}
    </BottomSheet>
  );
}
