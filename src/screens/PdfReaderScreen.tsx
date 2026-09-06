import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApostilas } from "@/state/ApostilasContext";
import { useAuth } from "@/state/AuthContext";
import { usePdfDocument } from "@/pdf/usePdfDocument";
import { useAnnotations } from "@/pdf/useAnnotations";
import { downloadPdfBytes } from "@/firebase/pdfService";
import { toFriendlyMessage } from "@/firebase/errorMessages";
import { maxCachedPagesForDevice } from "@/pdf/memoryCalibration";
import PdfPage from "@/pdf/PdfPage";
import FastScroller from "@/pdf/FastScroller";
import TocSheet from "@/pdf/TocSheet";
import SearchSheet from "@/pdf/SearchSheet";
import { useZoom } from "@/pdf/useZoom";
import { usePdfSearch } from "@/pdf/usePdfSearch";
import { canOpenApostilaAnyDevice } from "@/security/wasm/accessGuard";
import { getOrCreateDeviceId } from "@/security/deviceId";
import { antiCopyGuard } from "@/security/antiCopyGuard";
import { visibilityGuard } from "@/security/visibilityGuard";
import { devtoolsGuard } from "@/security/devtoolsGuard";
import { IconButton, Spinner, TopAppBar } from "@/components";
import {
  ArrowBack,
  Close,
  Delete,
  Edit,
  FormatListBulleted,
  KeyboardArrowDown,
  KeyboardArrowUp,
  PanTool,
  Search,
  Toc,
  Undo,
  ZoomOutMap,
} from "@/components/icons";

const READER_INK =
  getComputedStyle(document.documentElement).getPropertyValue("--reader-ink").trim() || "#d9453f";

export default function PdfReaderScreen() {
  const { apostilaId } = useParams<{ apostilaId: string }>();
  const navigate = useNavigate();
  const { findApostila, userProfile, loading: apostilasLoading } = useApostilas();
  const { user } = useAuth();

  const apostila = apostilaId ? findApostila(apostilaId) : undefined;

  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [downloadError, setDownloadError] = useState<Error | null>(null);
  const [accessState, setAccessState] = useState<"checking" | "allowed" | "denied">("checking");
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [devtoolsSuspected, setDevtoolsSuspected] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (apostilasLoading) return;
    if (!apostila || !userProfile) {
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
  }, [apostila, userProfile, apostilasLoading]);

  useEffect(() => {
    if (!apostila || accessState !== "allowed") return;
    let cancelled = false;
    downloadPdfBytes(apostila.urlPdf)
      .then((bytes) => {
        if (!cancelled) setPdfBytes(bytes);
      })
      .catch((err) => {
        if (!cancelled) setDownloadError(err instanceof Error ? err : new Error(String(err)));
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
  const [renderSet, setRenderSet] = useState<Set<number>>(new Set());

  const handlePageVisible = useCallback(
    (pageIndex: number) => {
      const order = accessOrderRef.current;
      const existingIdx = order.indexOf(pageIndex);
      if (existingIdx !== -1) order.splice(existingIdx, 1);
      order.push(pageIndex);
      while (order.length > maxCachedPages) order.shift();

      setRenderSet(new Set(order));
    },
    [maxCachedPages],
  );

  function seekToPage(pageIndex: number) {
    const el = pageRefs.current.get(pageIndex);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function seekToHit(pageIndex: number, topFraction: number | null) {
    const el = pageRefs.current.get(pageIndex);
    const scroller = containerRef.current;
    if (!el || !scroller) return;
    if (topFraction === null) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const pageRect = el.getBoundingClientRect();
    const viewRect = scroller.getBoundingClientRect();
    const delta =
      pageRect.top - viewRect.top + topFraction * pageRect.height - viewRect.height / 3;
    scroller.scrollBy({ top: delta, behavior: "smooth" });
  }

  const [currentPage, setCurrentPage] = useState(0);
  useEffect(() => {
    const container = containerRef.current;
    if (!container || docState.status !== "ready") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          const idx = Number((visible.target as HTMLElement).dataset.pageIndex);
          if (!Number.isNaN(idx)) setCurrentPage(idx);
        }
      },
      { threshold: [0.5] },
    );
    pageRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [docState.status]);

  const { zoom, zoomSettled, resetZoom } = useZoom(
    containerRef,
    contentRef,
    docState.status === "ready",
    !isDrawingMode,
  );
  const search = usePdfSearch(docState.status === "ready" ? docState.doc : null);

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
      });
    }
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [docState.status]);

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

  const watermarkText = user?.email ?? "";

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
                  strokes={annotations.strokes[pageIndex] ?? []}
                  watermarkText={watermarkText}
                  highlights={search.highlightsForPageIndex(pageIndex)}
                  currentHighlight={search.currentHighlightForPage(pageIndex)}
                  zoomSettled={zoomSettled}
                  onStroke={(points) => annotations.addStroke(pageIndex, points, READER_INK, 3)}
                  onVisible={handlePageVisible}
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
          onEntryClick={(pageIndex) => {
            seekToPage(pageIndex);
            setShowToc(false);
          }}
        />
      )}

      {                                                                                   }
      {hidden && (
        <div style={styles.privacyOverlay}>
          <p className="m3-body-large" style={{ color: "var(--md-on-surface-variant)" }}>Conteúdo oculto</p>
        </div>
      )}

      {devtoolsSuspected && (
        <div className="m3-body-small" style={styles.devtoolsBanner}>
          Ferramentas de desenvolvedor detectadas — algumas proteções de conteúdo podem estar desativadas.
        </div>
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
};
