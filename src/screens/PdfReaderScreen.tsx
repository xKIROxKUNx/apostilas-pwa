import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApostilas } from "@/state/ApostilasContext";
import { useAuth } from "@/state/AuthContext";
import { useSubscription } from "@/state/useSubscription";
import SubscriptionExpiredScreen from "@/screens/SubscriptionExpiredScreen";
import { usePdfDocument } from "@/pdf/usePdfDocument";
import { useAnnotations } from "@/pdf/useAnnotations";
import { downloadPdfBytes } from "@/firebase/pdfService";
import { isStorageDenied, toFriendlyMessage } from "@/firebase/errorMessages";
import { maxCachedPagesForDevice } from "@/pdf/memoryCalibration";
import { computeRenderScale } from "@/pdf/renderScale";
import PdfPage from "@/pdf/PdfPage";
import FastScroller from "@/pdf/FastScroller";
import TocSheet from "@/pdf/TocSheet";
import SearchSheet from "@/pdf/SearchSheet";
import { useZoom } from "@/pdf/useZoom";
import { usePdfSearch } from "@/pdf/usePdfSearch";
import { canOpenApostilaAnyDevice } from "@/security/wasm/accessGuard";
import { getOrCreateDeviceId } from "@/security/deviceId";
import {
  getReadingPosition,
  saveReadingPosition,
  type ReadingPosition,
} from "@/state/localPrefs";
import { antiCopyGuard } from "@/security/antiCopyGuard";
import { visibilityGuard } from "@/security/visibilityGuard";
import { devtoolsGuard } from "@/security/devtoolsGuard";
import { createPortal } from "react-dom";
import { drawWatermark } from "@/security/watermark";
import type { Stroke } from "@/types/domain";
import { Button, Card, IconButton, Spinner, TopAppBar } from "@/components";
import {
  ArrowBack,
  Close,
  Delete,
  Edit,
  FormatListBulleted,
  KeyboardArrowDown,
  KeyboardArrowUp,
  PanTool,
  Print,
  Search,
  Toc,
  Undo,
  ZoomOutMap,
} from "@/components/icons";

const POSITION_SAVE_DEBOUNCE_MS = 500;

const NO_STROKES: Stroke[] = [];

const PRINT_RELEASE_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

const READER_INK =
  getComputedStyle(document.documentElement).getPropertyValue("--reader-ink").trim() || "#d9453f";

export default function PdfReaderScreen() {
  const { apostilaId } = useParams<{ apostilaId: string }>();
  const navigate = useNavigate();
  const { findApostila, userProfile, loading: apostilasLoading } = useApostilas();
  const { user } = useAuth();
  const watermarkText = user?.email ?? "";
  const { expirada } = useSubscription();

  const apostila = apostilaId ? findApostila(apostilaId) : undefined;

  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [downloadError, setDownloadError] = useState<Error | null>(null);
  const [negadoPeloServidor, setNegadoPeloServidor] = useState(false);
  const [accessState, setAccessState] = useState<"checking" | "allowed" | "denied">("checking");
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [devtoolsSuspected, setDevtoolsSuspected] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printPages, setPrintPages] = useState<string[]>([]);
  const [printProgress, setPrintProgress] = useState<{ current: number; total: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const searchInputRef = useRef<HTMLInputElement>(null);
  const printRunRef = useRef(0);
  const printPagesRef = useRef<string[]>([]);
  printPagesRef.current = printPages;

  useEffect(() => {
    if (apostilasLoading) return;
    if (!apostila || !userProfile || expirada) {
      setAccessState("denied");
      return;
    }
    let cancelled = false;
    (async () => {
      const deviceId = await getOrCreateDeviceId();
      const allowed = canOpenApostilaAnyDevice(
        userProfile.nivelAcesso,
        apostila.nivelRequerido,
        deviceId,
        userProfile.deviceIds,
      );
      if (!cancelled) setAccessState(allowed ? "allowed" : "denied");
    })();
    return () => {
      cancelled = true;
    };
  }, [apostila, userProfile, apostilasLoading, expirada]);

  useEffect(() => {
    if (!apostila || accessState !== "allowed") return;
    let cancelled = false;
    downloadPdfBytes(apostila.urlPdf)
      .then((bytes) => {
        if (!cancelled) setPdfBytes(bytes);
      })
      .catch((err) => {
        if (cancelled) return;
        if (isStorageDenied(err)) {
          setNegadoPeloServidor(true);
          return;
        }
        setDownloadError(err instanceof Error ? err : new Error(String(err)));
      });
    return () => {
      cancelled = true;
    };
  }, [apostila, accessState]);

  const docState = usePdfDocument(pdfBytes);

  const annotations = useAnnotations(`${user?.uid ?? "anon"}:${apostilaId ?? "unknown"}`);

  useEffect(() => {
    document.documentElement.classList.add("reader-open");
    return () => document.documentElement.classList.remove("reader-open");
  }, []);

  useEffect(() => {
    antiCopyGuard.start();
    visibilityGuard.start();
    devtoolsGuard.start();
    const unsubVisibility = visibilityGuard.subscribe((state) => setHidden(state === "hidden"));
    const unsubDevtools = devtoolsGuard.subscribe(setDevtoolsSuspected);
    return () => {
      antiCopyGuard.stop();
      visibilityGuard.stop();
      devtoolsGuard.stop();
      unsubVisibility();
      unsubDevtools();
    };
  }, []);

  const maxCachedPages = useMemo(() => maxCachedPagesForDevice(), []);
  const accessOrderRef = useRef<number[]>([]);
  const visiblePagesRef = useRef<Set<number>>(new Set());
  const [renderSet, setRenderSet] = useState<Set<number>>(new Set());

  const handleVisibilityChange = useCallback(
    (pageIndex: number, isIntersecting: boolean) => {
      const visible = visiblePagesRef.current;
      const order = accessOrderRef.current;

      if (isIntersecting) {
        visible.add(pageIndex);
        const existingIdx = order.indexOf(pageIndex);
        if (existingIdx !== -1) order.splice(existingIdx, 1);
        order.push(pageIndex);
      } else {
        visible.delete(pageIndex);
      }

      while (order.length > maxCachedPages) {
        const evictable = order.findIndex((p) => !visible.has(p));
        if (evictable === -1) break;
        order.splice(evictable, 1);
      }

      setRenderSet(new Set(order));
    },
    [maxCachedPages],
  );

  function contentOffset(): number {
    return contentRef.current?.offsetTop ?? 0;
  }

  function pageIndexForOffset(offset: number): number {
    const pages = pageRefs.current;
    const count = pages.size;
    if (count === 0) return 0;
    const base = contentOffset();
    let low = 0;
    let high = count - 1;
    let best = 0;
    while (low <= high) {
      const mid = (low + high) >> 1;
      const el = pages.get(mid);
      if (!el) break;
      if (el.offsetTop - base <= offset) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return best;
  }

  function scrollToTarget(pageIndex: number, fraction: number | null, smooth: boolean) {
    const el = pageRefs.current.get(pageIndex);
    const scroller = containerRef.current;
    if (!el || !scroller) return;
    const pageTop = el.offsetTop - contentOffset();
    const top =
      fraction === null
        ? pageTop
        : pageTop + fraction * el.offsetHeight - scroller.clientHeight / 2;
    scroller.scrollTo({ top: Math.max(top, 0), behavior: smooth ? "smooth" : "auto" });
  }

  function seekToPage(pageIndex: number, topFraction?: number) {
    scrollToTarget(pageIndex, topFraction ?? null, true);
  }

  function seekToHit(pageIndex: number, topFraction: number | null) {
    scrollToTarget(pageIndex, topFraction, true);
  }

  const [currentPage, setCurrentPage] = useState(0);

  const { zoom, resetZoom } = useZoom(
    containerRef,
    contentRef,
    docState.status === "ready",
    !isDrawingMode,
    pageRefs,
  );
  const search = usePdfSearch(docState.status === "ready" ? docState.doc : null);

  const positionScope = `${user?.uid ?? "anon"}:${apostilaId ?? "unknown"}`;
  const positionScopeRef = useRef(positionScope);
  positionScopeRef.current = positionScope;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredRef = useRef(false);

  function currentReadingPosition(): ReadingPosition | null {
    const scroller = containerRef.current;
    if (!scroller || pageRefs.current.size === 0) return null;
    const pageIndex = pageIndexForOffset(scroller.scrollTop);
    const el = pageRefs.current.get(pageIndex);
    if (!el || el.offsetHeight <= 0) return null;
    const pageTop = el.offsetTop - contentOffset();
    return { pageIndex, fraction: (scroller.scrollTop - pageTop) / el.offsetHeight };
  }

  const [scrollFraction, setScrollFraction] = useState(0);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let frame = 0;
    function onScroll() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const el = containerRef.current;
        if (!el) return;
        const range = el.scrollHeight - el.clientHeight;
        setScrollFraction(range > 0 ? Math.min(Math.max(el.scrollTop / range, 0), 1) : 0);
        setCurrentPage(pageIndexForOffset(el.scrollTop + el.clientHeight / 2));

        if (!restoredRef.current) return;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          const position = currentReadingPosition();
          if (position) void saveReadingPosition(positionScopeRef.current, position);
        }, POSITION_SAVE_DEBOUNCE_MS);
      });
    }
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [docState.status]);

  useEffect(() => {
    if (docState.status !== "ready" || restoredRef.current) return;
    let cancelled = false;
    (async () => {
      const saved = await getReadingPosition(positionScopeRef.current);
      if (cancelled) return;
      if (saved && saved.pageIndex > 0 && saved.pageIndex < docState.pageCount) {
        const el = pageRefs.current.get(saved.pageIndex);
        const scroller = containerRef.current;
        if (el && scroller) {
          scroller.scrollTo({
            top: Math.max(el.offsetTop - contentOffset() + saved.fraction * el.offsetHeight, 0),
            behavior: "auto",
          });
        }
      }
      restoredRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [docState.status]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      const scroller = containerRef.current;
      if (!restoredRef.current || !scroller || pageRefs.current.size === 0) return;
      const pageIndex = pageIndexForOffset(scroller.scrollTop);
      const el = pageRefs.current.get(pageIndex);
      if (!el || el.offsetHeight <= 0) return;
      const pageTop = el.offsetTop - contentOffset();
      void saveReadingPosition(positionScopeRef.current, {
        pageIndex,
        fraction: (scroller.scrollTop - pageTop) / el.offsetHeight,
      });
    };
  }, []);

  useEffect(() => {
    if (isSearching) searchInputRef.current?.focus();
  }, [isSearching]);

  const hitTarget = search.currentHitTarget;
  useEffect(() => {
    if (!hitTarget) return;
    seekToHit(hitTarget.pageIndex, hitTarget.topFraction);
  }, [hitTarget]);

  function closeSearch() {
    setIsSearching(false);
    setShowSearchResults(false);
    search.clear();
  }

  const cleanupUrls = useCallback((list: string[]) => {
    for (const url of list) URL.revokeObjectURL(url);
  }, []);

  const disarmPrintReleaseRef = useRef<(() => void) | null>(null);

  const releasePrintPages = useCallback(() => {
    disarmPrintReleaseRef.current?.();
    disarmPrintReleaseRef.current = null;
    cleanupUrls(printPagesRef.current);
    printPagesRef.current = [];
    setPrintPages([]);
  }, [cleanupUrls]);

  const armPrintRelease = useCallback(() => {
    disarmPrintReleaseRef.current?.();
    const onInteraction = () => releasePrintPages();
    for (const type of PRINT_RELEASE_EVENTS) {
      window.addEventListener(type, onInteraction, { capture: true, passive: true });
    }
    disarmPrintReleaseRef.current = () => {
      for (const type of PRINT_RELEASE_EVENTS) {
        window.removeEventListener(type, onInteraction, { capture: true });
      }
    };
  }, [releasePrintPages]);

  const handleCancelPrint = useCallback(() => {
    printRunRef.current++;
    setPrintProgress(null);
  }, []);

  useEffect(() => {
    return () => {
      printRunRef.current++;
      disarmPrintReleaseRef.current?.();
      cleanupUrls(printPagesRef.current);
    };
  }, [cleanupUrls]);

  const handlePrint = useCallback(async () => {
    if (docState.status !== "ready" || isPrinting || printProgress !== null) return;

    const total = docState.pageCount;
    if (total <= 0) return;

    const run = ++printRunRef.current;
    const aborted = () => printRunRef.current !== run;

    releasePrintPages();
    setPrintProgress({ current: 0, total });

    const urls: string[] = [];

    try {
      for (let i = 0; i < total; i++) {
        if (aborted()) {
          cleanupUrls(urls);
          return;
        }

        setPrintProgress({ current: i + 1, total });

        const page = await docState.doc.getPage(i + 1);
        if (aborted()) {
          page.cleanup();
          cleanupUrls(urls);
          return;
        }

        try {
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = computeRenderScale(baseViewport.width, baseViewport.height, 1600);
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) throw new Error("Canvas context unavailable");

          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          await page.render({ canvasContext: ctx, viewport, intent: "print" }).promise;
          if (aborted()) {
            canvas.width = 0;
            canvas.height = 0;
            cleanupUrls(urls);
            return;
          }

          const pageStrokes = annotations.strokes[i];
          if (pageStrokes && pageStrokes.length > 0) {
            for (const stroke of pageStrokes) {
              if (stroke.points.length < 2) continue;
              ctx.beginPath();
              ctx.moveTo(stroke.points[0].x * canvas.width, stroke.points[0].y * canvas.height);
              for (const p of stroke.points.slice(1)) {
                ctx.lineTo(p.x * canvas.width, p.y * canvas.height);
              }
              ctx.strokeStyle = stroke.color;
              ctx.lineWidth = Math.max(1, stroke.width * (canvas.width / 800));
              ctx.lineCap = "round";
              ctx.lineJoin = "round";
              ctx.stroke();
            }
          }

          if (watermarkText) {
            drawWatermark(ctx, canvas.width, canvas.height, {
              text: watermarkText,
              padding: Math.max(24, Math.round(canvas.width * 0.03)),
            });
          }

          const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, "image/jpeg", 0.95),
          );
          canvas.width = 0;
          canvas.height = 0;

          if (!blob) throw new Error("Print page generation failed");
          if (aborted()) {
            cleanupUrls(urls);
            return;
          }

          urls.push(URL.createObjectURL(blob));
        } finally {
          page.cleanup();
        }

        await new Promise((r) => setTimeout(r, 0));
      }

      if (aborted()) {
        cleanupUrls(urls);
        return;
      }

      printPagesRef.current = urls;
      setPrintPages(urls);
      setIsPrinting(true);

      await new Promise<void>((resolve) => {
        let attempts = 0;
        const checkReady = () => {
          if (aborted()) {
            resolve();
            return;
          }
          attempts++;
          const portal = document.getElementById("print-portal");
          const imgs = portal ? Array.from(portal.querySelectorAll("img")) : [];
          if (imgs.length === urls.length) {
            Promise.all(
              imgs.map((img) =>
                img.complete
                  ? undefined
                  : new Promise<void>((done) => {
                      img.addEventListener("load", () => done(), { once: true });
                      img.addEventListener("error", () => done(), { once: true });
                    }),
              ),
            ).then(() => resolve());
            return;
          }
          if (attempts > 120) {
            resolve();
            return;
          }
          requestAnimationFrame(checkReady);
        };
        requestAnimationFrame(checkReady);
      });

      if (aborted()) {
        setIsPrinting(false);
        releasePrintPages();
        return;
      }

      setPrintProgress(null);

      const finishPrinting = () => {
        window.removeEventListener("afterprint", finishPrinting);
        window.removeEventListener("focus", finishPrinting);
        setIsPrinting(false);
        if (!aborted()) armPrintRelease();
      };
      window.addEventListener("afterprint", finishPrinting);
      window.addEventListener("focus", finishPrinting);

      try {
        window.print();
      } catch {
        finishPrinting();
      }
    } catch {
      if (printPagesRef.current === urls) releasePrintPages();
      else cleanupUrls(urls);
      if (!aborted()) {
        setIsPrinting(false);
        setPrintProgress(null);
      }
    }
  }, [
    docState,
    isPrinting,
    printProgress,
    annotations.strokes,
    watermarkText,
    cleanupUrls,
    releasePrintPages,
    armPrintRelease,
  ]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        void handlePrint();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlePrint]);

  if (negadoPeloServidor) {
    return <SubscriptionExpiredScreen />;
  }

  if (apostilasLoading || accessState === "checking") {
    return <ReaderMessage onBack={() => navigate("/home")}>Verificando acesso…</ReaderMessage>;
  }

  if (!apostila) {
    return (
      <ReaderMessage onBack={() => navigate("/home")}>
        Apostila não encontrada. Volte para a Home e tente novamente.
      </ReaderMessage>
    );
  }

  if (accessState === "denied") {
    return (
      <ReaderMessage onBack={() => navigate("/home")}>
        Você não tem acesso a este conteúdo.
      </ReaderMessage>
    );
  }

  if (downloadError) {
    return (
      <ReaderMessage onBack={() => navigate("/home")}>
        Erro ao carregar PDF: {toFriendlyMessage(downloadError)}
      </ReaderMessage>
    );
  }

  if (docState.status === "error") {
    return (
      <ReaderMessage onBack={() => navigate("/home")}>
        Erro ao carregar PDF: {toFriendlyMessage(docState.error)}
      </ReaderMessage>
    );
  }

  return (
    <div style={styles.page}>
      <TopAppBar>
        {isSearching ? (
          <>
            <IconButton label="Fechar busca" onClick={closeSearch}>
              <Close />
            </IconButton>
            <input
              ref={searchInputRef}
              value={search.query}
              onChange={(e) => search.setQuery(e.target.value)}
              placeholder="Buscar…"
              className="m3-body-large"
              style={styles.searchInput}
              aria-label="Buscar no documento"
            />
            {search.results.length > 0 ? (
              <>
                <span className="m3-label-large" style={styles.hitCounter}>
                  {search.currentIndex + 1}/{search.results.length}
                </span>
                <IconButton
                  label="Ocorrência anterior"
                  onClick={() => search.moveToHit(-1)}
                >
                  <KeyboardArrowUp />
                </IconButton>
                <IconButton
                  label="Próxima ocorrência"
                  onClick={() => search.moveToHit(1)}
                >
                  <KeyboardArrowDown />
                </IconButton>
                <IconButton
                  label="Todos os resultados"
                  onClick={() => setShowSearchResults(true)}
                >
                  <FormatListBulleted />
                </IconButton>
              </>
            ) : (
              <span className="m3-label-large" style={styles.hitCounter}>
                {search.searching ? <Spinner size={18} /> : search.query.trim() ? "0" : ""}
              </span>
            )}
          </>
        ) : (
          <>
            <IconButton label="Voltar" onClick={() => navigate("/home")}>
              <ArrowBack />
            </IconButton>
            <span className="m3-title-medium m3-appbar__title" style={styles.pageCounter}>
              {docState.status === "ready"
                ? `Página ${currentPage + 1} de ${docState.pageCount}`
                : "Apostilas"}
            </span>
            {isDrawingMode && annotations.canUndo && (
              <IconButton label="Desfazer" onClick={annotations.undoLastStroke}>
                <Undo />
              </IconButton>
            )}
            {isDrawingMode && annotations.hasAnyStrokes && (
              <IconButton label="Limpar anotações" tone="error" onClick={annotations.clearAll}>
                <Delete />
              </IconButton>
            )}
            {zoom !== 1 && (
              <IconButton label="Restaurar zoom" onClick={resetZoom}>
                <ZoomOutMap />
              </IconButton>
            )}
            <IconButton
              label="Imprimir"
              onClick={() => void handlePrint()}
              disabled={docState.status !== "ready" || printProgress !== null || isPrinting}
            >
              <Print />
            </IconButton>
            <IconButton label="Buscar" onClick={() => setIsSearching(true)}>
              <Search />
            </IconButton>
            <IconButton label="Sumário" onClick={() => setShowToc(true)}>
              <Toc />
            </IconButton>
            <IconButton
              label={isDrawingMode ? "Modo leitura" : "Modo desenho"}
              tone={isDrawingMode ? "primary" : "default"}
              onClick={() => setIsDrawingMode((v) => !v)}
            >
              {isDrawingMode ? <PanTool /> : <Edit />}
            </IconButton>
          </>
        )}
      </TopAppBar>

      {
        }
      <div style={styles.readerBody}>
        <div ref={containerRef} className="reader-scroll" style={styles.scrollArea}>
        {docState.status !== "ready" && (
          <div style={styles.centerMsg}>
            <Spinner label="Carregando documento" />
          </div>
        )}
        {
          }
        <div ref={contentRef} style={{ width: `${zoom * 100}%`, margin: "0 auto" }}>
          {docState.status === "ready" &&
            Array.from({ length: docState.pageCount }, (_, i) => i).map((pageIndex) => (
              <div
                key={pageIndex}
                ref={(el) => {
                  if (el) pageRefs.current.set(pageIndex, el);
                  else pageRefs.current.delete(pageIndex);
                }}
                data-page-index={pageIndex}
              >
                <PdfPage
                  doc={docState.doc}
                  pageIndex={pageIndex}
                  aspectRatio={docState.aspectRatios[pageIndex] ?? 0.77}
                  shouldRender={renderSet.has(pageIndex)}
                  isDrawingMode={isDrawingMode}
                  strokes={annotations.strokes[pageIndex] ?? NO_STROKES}
                  watermarkText={watermarkText}
                  highlights={search.highlightsForPageIndex(pageIndex)}
                  currentHighlight={search.currentHighlightForPage(pageIndex)}
                  onStroke={(points) => annotations.addStroke(pageIndex, points, READER_INK, 3)}
                  onVisibilityChange={handleVisibilityChange}
                />
              </div>
            ))}
          </div>
        </div>

        {docState.status === "ready" && !isDrawingMode && (
          <FastScroller
            pageCount={docState.pageCount}
            toc={docState.toc}
            scrollFraction={scrollFraction}
            onSeek={seekToPage}
          />
        )}
      </div>

      {showSearchResults && (
        <SearchSheet
          results={search.results}
          currentIndex={search.currentIndex}
          searching={search.searching}
          onResultClick={(index) => {
            search.selectHit(index);
            setShowSearchResults(false);
          }}
          onClose={() => setShowSearchResults(false)}
        />
      )}

      {showToc && docState.status === "ready" && (
        <TocSheet
          entries={docState.toc}
          currentPageIndex={currentPage}
          onClose={() => setShowToc(false)}
          onEntryClick={(pageIndex, topFraction) => {
            seekToPage(pageIndex, topFraction);
            setShowToc(false);
          }}
        />
      )}

      {hidden && !isPrinting && !printProgress && (
        <div style={styles.privacyOverlay}>
          <p className="m3-body-large" style={{ color: "var(--md-on-surface-variant)" }}>Conteúdo oculto</p>
        </div>
      )}

      {devtoolsSuspected && (
        <div className="m3-body-small" style={styles.devtoolsBanner}>
          Ferramentas de desenvolvedor detectadas — algumas proteções de conteúdo podem estar desativadas.
        </div>
      )}

      {printProgress && (
        <div className="m3-scrim" style={styles.printScrim}>
          <Card variant="elevated" style={styles.printCard}>
            <h2 className="m3-title-medium" style={styles.printTitle}>
              Preparando impressão
            </h2>
            <Spinner size={36} />
            <span className="m3-body-medium" style={styles.printSubtitle}>
              Página {Math.max(1, printProgress.current)} de {printProgress.total}…
            </span>
            <Button variant="text" onClick={handleCancelPrint}>
              Cancelar
            </Button>
          </Card>
        </div>
      )}

      {printPages.length > 0 &&
        createPortal(
          <div id="print-portal">
            {printPages.map((url, idx) => (
              <div key={idx} className="print-page-container">
                <img
                  src={url}
                  className="print-page"
                  alt={`Página ${idx + 1}`}
                />
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

function ReaderMessage({ children, onBack }: { children: React.ReactNode; onBack: () => void }) {
  return (
    <div style={styles.page}>
      <TopAppBar>
        <IconButton label="Voltar" onClick={onBack}>
          <ArrowBack />
        </IconButton>
      </TopAppBar>
      <div style={styles.centerMsg}>
        <p className="m3-body-large" style={{ color: "var(--md-error)", textAlign: "center", padding: 24 }}>{children}</p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    height: "100dvh",
    display: "flex",
    flexDirection: "column",
    background: "var(--md-surface-container)",
  },
  readerBody: {
    flex: 1,
    minHeight: 0,
    position: "relative",
    display: "flex",
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    margin: "0 4px",
    background: "none",
    border: "none",
    color: "var(--md-on-surface)",
    padding: "8px 4px",
    outline: "none",
  },
  hitCounter: {
    color: "var(--md-on-surface-variant)",
    padding: "0 4px",
    display: "flex",
    alignItems: "center",
  },
  pageCounter: { color: "var(--md-on-surface-variant)" },
  scrollArea: {
    flex: 1,
    minWidth: 0,
    overflowY: "auto",
    overflowX: "auto",
    touchAction: "pan-x pan-y",
    padding: `0 0 calc(32px + env(safe-area-inset-bottom, 0px))`,
  },
  centerMsg: {
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  privacyOverlay: {
    position: "fixed",
    inset: 0,
    background: "var(--md-surface)",
    backdropFilter: "blur(24px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: "var(--z-privacy)" as unknown as number,
  },
  devtoolsBanner: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    background: "var(--md-error-container)",
    color: "var(--md-on-error-container)",
    padding: `10px 16px calc(10px + env(safe-area-inset-bottom, 0px))`,
    textAlign: "center",
    zIndex: "var(--z-banner)" as unknown as number,
  },
  printScrim: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: "var(--z-sheet)" as unknown as number,
  },
  printCard: {
    width: "min(88vw, 340px)",
    padding: "24px 20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
    textAlign: "center",
  },
  printTitle: {
    margin: 0,
    color: "var(--md-on-surface)",
  },
  printSubtitle: {
    color: "var(--md-on-surface-variant)",
  },
};
