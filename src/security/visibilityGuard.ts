export type VisibilityState = "visible" | "hidden";

type Listener = (state: VisibilityState) => void;

class VisibilityGuard {
  private listeners = new Set<Listener>();
  private currentState: VisibilityState = "visible";
  private started = false;

  start(): void {
    if (this.started) return;
    this.started = true;

    document.addEventListener("visibilitychange", this.handleChange);
    window.addEventListener("blur", this.handleBlur);
    window.addEventListener("focus", this.handleFocus);
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    document.removeEventListener("visibilitychange", this.handleChange);
    window.removeEventListener("blur", this.handleBlur);
    window.removeEventListener("focus", this.handleFocus);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.currentState);
    return () => this.listeners.delete(listener);
  }

  get state(): VisibilityState {
    return this.currentState;
  }

  private handleChange = (): void => {
    this.setState(document.hidden ? "hidden" : "visible");
  };

  private handleBlur = (): void => {
    this.setState("hidden");
  };

  private handleFocus = (): void => {
    if (!document.hidden) this.setState("visible");
  };

  private setState(next: VisibilityState): void {
    if (next === this.currentState) return;
    this.currentState = next;
    this.listeners.forEach((l) => l(next));
  }
}

export const visibilityGuard = new VisibilityGuard();
