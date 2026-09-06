const CHECK_INTERVAL_MS = 1500;
const SIZE_THRESHOLD_PX = 160;

export type DevtoolsListener = (suspected: boolean) => void;

class DevtoolsGuard {
  private intervalId: number | null = null;
  private listeners = new Set<DevtoolsListener>();
  private lastState = false;

  start(): void {
    if (this.intervalId !== null) return;
    this.intervalId = window.setInterval(() => this.check(), CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  subscribe(listener: DevtoolsListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private sizeHeuristic(): boolean {
    const widthDelta = window.outerWidth - window.innerWidth;
    const heightDelta = window.outerHeight - window.innerHeight;
    return widthDelta > SIZE_THRESHOLD_PX || heightDelta > SIZE_THRESHOLD_PX;
  }

  private formatterHeuristic(): boolean {
    let inspected = false;
    const probe = {
      get devtoolsCheck() {
        inspected = true;
        return "";
      },
    };
    console.log("%c", probe);
    console.clear();
    return inspected;
  }

  private check(): void {
    const suspected = this.sizeHeuristic() && this.formatterHeuristic();
    if (suspected !== this.lastState) {
      this.lastState = suspected;
      this.listeners.forEach((l) => l(suspected));
    }
  }
}

export const devtoolsGuard = new DevtoolsGuard();
