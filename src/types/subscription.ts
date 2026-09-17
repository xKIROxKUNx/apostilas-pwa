const FUSO = "America/Bahia";
const MS_POR_DIA = 86_400_000;
const MAX_TIMEOUT_MS = 2_147_483_647;

export const DIAS_AVISO = 7;
export const DIAS_ALERTA = 3;

export interface SubscriptionStatus {
  expirada: boolean;
  diasRestantes: number | null;
}

const formatador = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function diaCalendario(instante: Date): number {
  let ano = 0;
  let mes = 1;
  let dia = 1;
  for (const parte of formatador.formatToParts(instante)) {
    if (parte.type === "year") ano = Number(parte.value);
    else if (parte.type === "month") mes = Number(parte.value);
    else if (parte.type === "day") dia = Number(parte.value);
  }
  return Math.round(Date.UTC(ano, mes - 1, dia) / MS_POR_DIA);
}

export function subscriptionStatus(
  expiraEm: Date | null,
  agora: Date,
  nivelAcesso: number,
): SubscriptionStatus {
  if (!expiraEm || nivelAcesso === 5) {
    return { expirada: false, diasRestantes: null };
  }
  return {
    expirada: agora.getTime() >= expiraEm.getTime(),
    diasRestantes: diaCalendario(new Date(expiraEm.getTime() - 1)) - diaCalendario(agora),
  };
}

export function msAteExpirar(expiraEm: Date, agora: Date): number {
  return Math.min(expiraEm.getTime() - agora.getTime(), MAX_TIMEOUT_MS);
}

export function textoDiasRestantes(dias: number): string {
  if (dias <= 0) return "vence hoje";
  if (dias === 1) return "resta 1 dia";
  return `restam ${dias} dias`;
}
