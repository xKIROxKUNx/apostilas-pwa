import { Util } from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { findOccurrences, snippetAround, type Match } from "./textSearch";

export interface HighlightRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface SearchHit {
  pageIndex: number;
  ordinalInPage: number;
  snippet: string;
  matchStart: number;
  matchEnd: number;
}

interface PageText {
  text: string;
  runs: RunRange[];
}

interface RunRange {
  start: number;
  length: number;
  tx: number[];
  width: number;
  viewportWidth: number;
  viewportHeight: number;
}

async function extractPage(doc: PDFDocumentProxy, pageIndex: number): Promise<PageText> {
  const page = await doc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();

  let text = "";
  const runs: RunRange[] = [];

  for (const item of content.items) {
    if (!("str" in item)) continue;
    if (item.str.length > 0) {
      runs.push({
        start: text.length,
        length: item.str.length,
        tx: Util.transform(viewport.transform, item.transform),
        width: item.width,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
      });
      text += item.str;
    }
    if (item.hasEOL) text += "\n";
  }

  return { text, runs };
}

function rectForRunSlice(run: RunRange, from: number, to: number): HighlightRect | null {
  const [a, b, c, d, e, f] = run.tx;
  const vw = run.viewportWidth;
  const vh = run.viewportHeight;
  if (!vw || !vh) return null;

  const advanceLen = Math.hypot(a, b);
  const ascentLen = Math.hypot(c, d);
  if (advanceLen === 0 || ascentLen === 0) return null;

  const dirX = a / advanceLen;
  const dirY = b / advanceLen;
  const upX = c / ascentLen;
  const upY = d / ascentLen;

  const startOffset = (from / run.length) * run.width;
  const endOffset = (to / run.length) * run.width;

  const x0 = e + dirX * startOffset;
  const y0 = f + dirY * startOffset;
  const x1 = e + dirX * endOffset;
  const y1 = f + dirY * endOffset;
  const hx = upX * ascentLen;
  const hy = upY * ascentLen;

  const xs = [x0, x1, x0 + hx, x1 + hx];
  const ys = [y0, y1, y0 + hy, y1 + hy];

  const rect: HighlightRect = {
    left: Math.min(...xs) / vw,
    right: Math.max(...xs) / vw,
    top: Math.min(...ys) / vh,
    bottom: Math.max(...ys) / vh,
  };

  return isSane(rect) ? rect : null;
}

function isSane(r: HighlightRect): boolean {
  return (
    r.left >= 0 && r.left <= 1 && r.right >= 0 && r.right <= 1 &&
    r.top >= 0 && r.top <= 1 && r.bottom >= 0 && r.bottom <= 1 &&
    r.right > r.left && r.bottom > r.top
  );
}

export function rectsForMatch(pageText: PageText, match: Match): HighlightRect[] {
  const out: HighlightRect[] = [];
  for (const run of pageText.runs) {
    const runEnd = run.start + run.length;
    const from = Math.max(match.start, run.start);
    const to = Math.min(match.end, runEnd);
    if (from >= to) continue;
    const rect = rectForRunSlice(run, from - run.start, to - run.start);
    if (rect) out.push(rect);
  }
  return out;
}

export type PdfTextIndex = PageText[];

export async function buildTextIndex(doc: PDFDocumentProxy): Promise<PdfTextIndex> {
  const pages: PageText[] = [];
  for (let i = 0; i < doc.numPages; i++) {
    pages.push(await extractPage(doc, i));
  }
  return pages;
}

export function searchIndex(index: PdfTextIndex, query: string): SearchHit[] {
  const hits: SearchHit[] = [];
  index.forEach((pageText, pageIndex) => {
    findOccurrences(pageText.text, query).forEach((match, ordinalInPage) => {
      const snippet = snippetAround(pageText.text, match);
      hits.push({
        pageIndex,
        ordinalInPage,
        snippet: snippet.text,
        matchStart: snippet.matchStart,
        matchEnd: snippet.matchEnd,
      });
    });
  });
  return hits;
}

export function highlightsForPage(
  index: PdfTextIndex,
  pageIndex: number,
  query: string,
): HighlightRect[][] {
  const pageText = index[pageIndex];
  if (!pageText) return [];
  return findOccurrences(pageText.text, query).map((m) => rectsForMatch(pageText, m));
}
