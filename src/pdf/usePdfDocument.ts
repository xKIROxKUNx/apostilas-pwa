import "./pdfWorkerSetup";
import { useEffect, useState } from "react";
import { getDocument, type PDFDocumentProxy } from "pdfjs-dist";
import type { TocEntry } from "@/types/domain";

export type PdfDocState =
  | { status: "loading" }
  | { status: "error"; error: Error }
  | {
      status: "ready";
      doc: PDFDocumentProxy;
      pageCount: number;
      toc: TocEntry[];
      aspectRatios: number[];
    };

async function extractToc(doc: PDFDocumentProxy): Promise<TocEntry[]> {
  const outline = await doc.getOutline();
  if (!outline || outline.length === 0) return [];

  const entries: TocEntry[] = [];

  async function walk(items: typeof outline, depth: number): Promise<void> {
    for (const item of items) {
      try {
        let dest = item.dest;
        if (typeof dest === "string") {
          dest = await doc.getDestination(dest);
        }
        if (Array.isArray(dest) && dest[0] != null) {
          const pageIndex = await doc.getPageIndex(dest[0]);
          entries.push({ title: item.title || "Sem título", pageIndex, depth });
        }
      } catch {
      }
      if (item.items?.length) {
        await walk(item.items, depth + 1);
      }
    }
  }

  await walk(outline, 0);

  const roots = entries.filter((e) => e.depth === 0);
  if (roots.length === 1) {
    const children = entries.filter((e) => e.depth > 0).map((e) => ({ ...e, depth: e.depth - 1 }));
    if (children.length > 0) return children;
  }

  return entries;
}

export function usePdfDocument(bytes: ArrayBuffer | null): PdfDocState {
  const [state, setState] = useState<PdfDocState>({ status: "loading" });

  useEffect(() => {
    if (!bytes) return;
    let cancelled = false;
    setState({ status: "loading" });

    (async () => {
      try {
        const loadingTask = getDocument({ data: bytes.slice(0) });
        const doc = await loadingTask.promise;
        if (cancelled) return;
        const toc = await extractToc(doc);
        if (cancelled) return;

        const aspectRatios: number[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: 1 });
          aspectRatios.push(viewport.width / viewport.height);
        }
        if (cancelled) return;

        setState({ status: "ready", doc, pageCount: doc.numPages, toc, aspectRatios });
      } catch (err) {
        if (cancelled) return;
        setState({ status: "error", error: err instanceof Error ? err : new Error(String(err)) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bytes]);

  return state;
}

export function chapterIndexForPage(toc: TocEntry[], pageIndex: number): number {
  if (toc.length === 0) return -1;
  let best = -1;
  for (let i = 0; i < toc.length; i++) {
    if (toc[i].pageIndex > pageIndex) continue;
    if (best === -1 || toc[i].pageIndex > toc[best].pageIndex) best = i;
  }
  return best === -1 ? 0 : best;
}

export function chapterTitleForPage(toc: TocEntry[], pageIndex: number): string | null {
  const i = chapterIndexForPage(toc, pageIndex);
  return i === -1 ? null : toc[i].title;
}
