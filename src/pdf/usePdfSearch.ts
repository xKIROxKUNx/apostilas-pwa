import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  buildTextIndex,
  highlightsForPage,
  searchIndex,
  type HighlightRect,
  type PdfTextIndex,
  type SearchHit,
} from "./pdfTextIndex";

const SEARCH_DEBOUNCE_MS = 250;

const NO_HIGHLIGHTS: HighlightRect[][] = [];

export function usePdfSearch(doc: PDFDocumentProxy | null) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);

  const indexRef = useRef<PdfTextIndex | null>(null);
  const [indexVersion, setIndexVersion] = useState(0);

  useEffect(() => {
    indexRef.current = null;
    setIndexVersion(0);
    setQuery("");
    setResults([]);
    setCurrentIndex(-1);
  }, [doc]);

  useEffect(() => {
    if (!doc || query.trim().length === 0) {
      setResults([]);
      setCurrentIndex(-1);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);

    const timer = setTimeout(async () => {
      try {
        if (!indexRef.current) {
          const built = await buildTextIndex(doc);
          if (cancelled) return;
          indexRef.current = built;
          setIndexVersion((v) => v + 1);
        }
        if (cancelled) return;
        const hits = searchIndex(indexRef.current, query);
        setResults(hits);
        setCurrentIndex(hits.length > 0 ? 0 : -1);
      } catch {
        if (!cancelled) {
          setResults([]);
          setCurrentIndex(-1);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [doc, query]);

  const highlights = useMemo(() => {
    const map = new Map<number, HighlightRect[][]>();
    const index = indexRef.current;
    if (!index || query.trim().length === 0) return map;
    for (const pageIndex of new Set(results.map((r) => r.pageIndex))) {
      map.set(pageIndex, highlightsForPage(index, pageIndex, query));
    }
    return map;
  }, [results, query, indexVersion]);

  const highlightsForPageIndex = useCallback(
    (pageIndex: number) => highlights.get(pageIndex) ?? NO_HIGHLIGHTS,
    [highlights],
  );

  const currentHitTarget = useMemo(() => {
    const hit = results[currentIndex];
    if (!hit) return null;
    const rect = highlights.get(hit.pageIndex)?.[hit.ordinalInPage]?.[0];
    return { pageIndex: hit.pageIndex, topFraction: rect?.top ?? null };
  }, [results, currentIndex, highlights]);

  const currentHighlightForPage = useCallback(
    (pageIndex: number): number | null => {
      const hit = results[currentIndex];
      if (!hit || hit.pageIndex !== pageIndex) return null;
      return hit.ordinalInPage;
    },
    [results, currentIndex],
  );

  const moveToHit = useCallback(
    (delta: number): number | null => {
      if (results.length === 0) return null;
      const next = (((currentIndex + delta) % results.length) + results.length) % results.length;
      setCurrentIndex(next);
      return results[next].pageIndex;
    },
    [results, currentIndex],
  );

  const selectHit = useCallback(
    (index: number): number | null => {
      const hit = results[index];
      if (!hit) return null;
      setCurrentIndex(index);
      return hit.pageIndex;
    },
    [results],
  );

  const clear = useCallback(() => {
    setQuery("");
    setResults([]);
    setCurrentIndex(-1);
    setSearching(false);
  }, []);

  return {
    query,
    setQuery,
    results,
    searching,
    currentIndex,
    currentHitTarget,
    highlightsForPageIndex,
    currentHighlightForPage,
    moveToHit,
    selectHit,
    clear,
  };
}
