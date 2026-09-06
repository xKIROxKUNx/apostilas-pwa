const BLOCKED_KEY_COMBOS: Array<(e: KeyboardEvent) => boolean> = [
  (e) => (e.ctrlKey || e.metaKey) && ["c", "s", "p", "u"].includes(e.key.toLowerCase()),
  (e) =>
    (e.ctrlKey || e.metaKey) &&
    e.shiftKey &&
    ["i", "j", "c"].includes(e.key.toLowerCase()),
  (e) => e.key === "F12",
  (e) => e.key === "PrintScreen",
];

export interface AntiCopyOptions {
  onSuspectedScreenshot?: () => void;
  root?: HTMLElement;
}

class AntiCopyGuard {
  private active = false;
  private root: HTMLElement | null = null;
  private onSuspectedScreenshot?: () => void;

  start(options: AntiCopyOptions = {}): void {
    if (this.active) return;
    this.active = true;
    this.root = options.root ?? document.body;
    this.onSuspectedScreenshot = options.onSuspectedScreenshot;

    this.root.classList.add("no-select", "no-callout");
    document.addEventListener("contextmenu", this.handleContextMenu);
    document.addEventListener("dragstart", this.handleDragStart);
    document.addEventListener("keydown", this.handleKeyDown, { capture: true });
    document.addEventListener("selectstart", this.handleSelectStart);
    document.addEventListener("copy", this.handleCopy);
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.root?.classList.remove("no-select", "no-callout");
    document.removeEventListener("contextmenu", this.handleContextMenu);
    document.removeEventListener("dragstart", this.handleDragStart);
    document.removeEventListener("keydown", this.handleKeyDown, { capture: true });
    document.removeEventListener("selectstart", this.handleSelectStart);
    document.removeEventListener("copy", this.handleCopy);
    this.root = null;
  }

  private handleContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  private handleDragStart = (e: DragEvent): void => {
    e.preventDefault();
  };

  private handleSelectStart = (e: Event): void => {
    e.preventDefault();
  };

  private handleCopy = (e: ClipboardEvent): void => {
    e.preventDefault();
    e.clipboardData?.setData("text/plain", "");
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "PrintScreen") {
      this.onSuspectedScreenshot?.();
      return;
    }
    if (BLOCKED_KEY_COMBOS.some((matches) => matches(e))) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
}

export const antiCopyGuard = new AntiCopyGuard();
