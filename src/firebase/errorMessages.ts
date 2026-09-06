import { DeviceBindingError } from "@/types/domain";

export function toFriendlyMessage(error: unknown): string {
  if (error instanceof DeviceBindingError) {
    return error.message;
  }

  const code = (error as { code?: string })?.code ?? "";

  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "E-mail ou senha inválidos. Verifique suas credenciais.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
    case "auth/network-request-failed":
      return "Sem conexão com a internet. Verifique sua rede e tente novamente.";
    case "storage/object-not-found":
      return "Apostila não encontrada no servidor.";
    case "storage/unauthorized":
    case "storage/unauthenticated":
      return "Você não tem permissão para acessar este conteúdo.";
    case "storage/retry-limit-exceeded":
      return "Falha no download. Verifique sua conexão.";
    case "permission-denied":
      return "Você não tem permissão para acessar estes dados.";
    case "unavailable":
      return "Servidor indisponível. Verifique sua conexão.";
    default:
      break;
  }

  if (!navigator.onLine) {
    return "Sem conexão com a internet. Verifique sua rede e tente novamente.";
  }

  return error instanceof Error
    ? error.message || "Ocorreu um erro inesperado. Tente novamente."
    : "Ocorreu um erro inesperado. Tente novamente.";
}
