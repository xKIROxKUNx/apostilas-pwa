export interface UserProfile {
  email: string;
  nivelAcesso: number;
  deviceIds: string[];
}

export interface Apostila {
  id: string;
  titulo: string;
  componenteCurricular: string;
  urlPdf: string;
  nivelRequerido: number;
}

export type AsyncResult<T> =
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };

export const AsyncResult = {
  loading: <T>(): AsyncResult<T> => ({ status: "loading" }),
  success: <T>(data: T): AsyncResult<T> => ({ status: "success", data }),
  error: <T>(error: Error): AsyncResult<T> => ({ status: "error", error }),
};

export class DeviceBindingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeviceBindingError";
  }
}

export interface StrokePoint {
  x: number;
  y: number;
}

export interface Stroke {
  points: StrokePoint[];
  color: string;
  width: number;
}

export interface TocEntry {
  title: string;
  pageIndex: number;
  depth: number;
  topFraction?: number;
}

export interface ChapterNavInfo {
  previousTitle: string | null;
  currentTitle: string | null;
  nextTitle: string | null;
}

export type SessionState = "checking" | "valid" | "invalid";

export function toRoleName(nivel: number): string {
  switch (nivel) {
    case 1:
      return "Básico";
    case 2:
      return "Plus";
    case 3:
      return "Premium";
    case 4:
      return "Apoiador";
    case 5:
      return "Administrador";
    default:
      return `Nível ${nivel}`;
  }
}

export function hasAccess(userLevel: number, requiredLevel: number): boolean {
  return userLevel >= requiredLevel;
}
