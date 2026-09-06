export const DEVICE_SLOTS = ["deviceId", "deviceId2", "deviceId3"] as const;

export type DeviceSlot = (typeof DEVICE_SLOTS)[number];

export type BindingDecision =
  | { tipo: "ja-vinculado"; campo: DeviceSlot }
  | { tipo: "reivindicar"; campo: DeviceSlot }
  | { tipo: "negado" };

export function decideBinding(
  dados: Record<string, unknown>,
  deviceIdAtual: string,
  combina: (a: string, b: string) => boolean,
): BindingDecision {
  for (const campo of DEVICE_SLOTS) {
    const existe = Object.prototype.hasOwnProperty.call(dados, campo);

    if (!existe) {
      if (campo === "deviceId") return { tipo: "reivindicar", campo };
      return { tipo: "negado" };
    }

    const valor = dados[campo];
    const ocupado = typeof valor === "string" && valor !== "";

    if (!ocupado) return { tipo: "reivindicar", campo };
    if (combina(deviceIdAtual, valor as string)) return { tipo: "ja-vinculado", campo };
  }

  return { tipo: "negado" };
}

export function boundDeviceIds(dados: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const campo of DEVICE_SLOTS) {
    const valor = dados[campo];
    if (typeof valor === "string" && valor !== "") out.push(valor);
  }
  return out;
}
