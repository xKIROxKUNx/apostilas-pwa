import { useCallback, useEffect, useRef, useState } from "react";
import type { Stroke, StrokePoint } from "@/types/domain";
import { loadStrokes, saveStrokes, resetKnownStrokeCount } from "./annotationsStore";

const SAVE_DEBOUNCE_MS = 700;

export function useAnnotations(apostilaId: string) {
  const [strokes, setStrokes] = useState<Record<number, Stroke[]>>({});
  const [loaded, setLoaded] = useState(false);

  const undoStackRef = useRef<number[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;

  useEffect(() => {
    let cancelled = false;
    loadStrokes(apostilaId).then((loadedPages) => {
      if (cancelled) return;
      setStrokes(loadedPages);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [apostilaId]);

  const flushSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    void saveStrokes(apostilaId, strokesRef.current);
  }, [apostilaId]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void saveStrokes(apostilaId, strokesRef.current);
    }, SAVE_DEBOUNCE_MS);
  }, [apostilaId]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) flushSave();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      flushSave();
    };
  }, [flushSave]);

  const addStroke = useCallback(
    (pageIndex: number, points: StrokePoint[], color: string, width: number) => {
      if (points.length < 2) return;
      setStrokes((prev) => {
        const pageList = prev[pageIndex] ?? [];
        return { ...prev, [pageIndex]: [...pageList, { points, color, width }] };
      });
      undoStackRef.current.push(pageIndex);
      setCanUndo(true);
      scheduleSave();
    },
    [scheduleSave],
  );

  const undoLastStroke = useCallback(() => {
    const pageIndex = undoStackRef.current.pop();
    if (pageIndex === undefined) return;
    setStrokes((prev) => {
      const list = prev[pageIndex];
      if (!list || list.length === 0) return prev;
      const next = { ...prev };
      const newList = list.slice(0, -1);
      if (newList.length === 0) {
        delete next[pageIndex];
      } else {
        next[pageIndex] = newList;
      }
      return next;
    });
    setCanUndo(undoStackRef.current.length > 0);
    scheduleSave();
  }, [scheduleSave]);

  const clearAll = useCallback(() => {
    setStrokes({});
    undoStackRef.current = [];
    setCanUndo(false);
    resetKnownStrokeCount(apostilaId);
    scheduleSave();
  }, [apostilaId, scheduleSave]);

  const hasAnyStrokes = Object.values(strokes).some((list) => list.length > 0);

  return { strokes, loaded, addStroke, undoLastStroke, canUndo, clearAll, hasAnyStrokes };
}
