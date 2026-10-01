import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import "@fontsource/poppins/latin-300.css";
import "@fontsource/poppins/latin-400.css";
import "@fontsource/poppins/latin-500.css";
import "@fontsource/poppins/latin-600.css";
import "@fontsource/poppins/latin-700.css";
import "@fontsource/poppins/latin-ext-300.css";
import "@fontsource/poppins/latin-ext-400.css";
import "@fontsource/poppins/latin-ext-500.css";
import "@fontsource/poppins/latin-ext-600.css";
import "@fontsource/poppins/latin-ext-700.css";
import "@fontsource/lora/latin-400.css";
import "@fontsource/lora/latin-400-italic.css";
import "@fontsource/lora/latin-600.css";
import "@fontsource/lora/latin-700.css";
import "@fontsource/lora/latin-ext-400.css";
import "@fontsource/lora/latin-ext-400-italic.css";
import "@fontsource/lora/latin-ext-600.css";
import "@fontsource/lora/latin-ext-700.css";
import { useApostilas } from "@/state/ApostilasContext";
import { useAuth } from "@/state/AuthContext";
import SubscriptionExpiredScreen from "@/screens/SubscriptionExpiredScreen";
import { CamadaPrivacidade, MensagemConteudo, useAcessoConteudo, useProtecaoConteudo } from "@/screens/conteudoProtegido";
import { downloadApostilaHtml } from "@/firebase/apostilaHtmlService";
import { isStorageDenied, toFriendlyMessage } from "@/firebase/errorMessages";
import LeitorApostila from "@/apostila/LeitorApostila";
import ImpressaoApostila from "@/apostila/ImpressaoApostila";
import { useTelaCheiaNaPaisagem } from "@/apostila/telaCheia";
import { rotaDoConteudo } from "@/types/domain";

export default function LeituraScreen() {
  const { apostilaId } = useParams<{ apostilaId: string }>();
  const navigate = useNavigate();
  const { findApostila } = useApostilas();
  const { user } = useAuth();

  const apostila = apostilaId ? findApostila(apostilaId) : undefined;
  const accessState = useAcessoConteudo(apostila);
  const oculto = useProtecaoConteudo();

  const [html, setHtml] = useState<string | null>(null);
  const [erro, setErro] = useState<Error | null>(null);
  const [negadoPeloServidor, setNegadoPeloServidor] = useState(false);
  const [imprimindo, setImprimindo] = useState(false);

  useEffect(() => {
    const iniciar = () => setImprimindo(true);
    const terminar = () => setImprimindo(false);
    window.addEventListener("beforeprint", iniciar);
    window.addEventListener("afterprint", terminar);
    window.addEventListener("focus", terminar);
    return () => {
      window.removeEventListener("beforeprint", iniciar);
      window.removeEventListener("afterprint", terminar);
      window.removeEventListener("focus", terminar);
    };
  }, []);

  const imprimir = async () => {
    setImprimindo(true);
    await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 3000))]);
    window.print();
  };

  useEffect(() => {
    if (!apostila || apostila.tipo !== "html" || accessState !== "allowed") return;
    let cancelled = false;
    downloadApostilaHtml(apostila.urlConteudo)
      .then((texto) => {
        if (!cancelled) setHtml(texto);
      })
      .catch((err) => {
        if (cancelled) return;
        if (isStorageDenied(err)) {
          setNegadoPeloServidor(true);
          return;
        }
        setErro(err instanceof Error ? err : new Error(String(err)));
      });
    return () => {
      cancelled = true;
    };
  }, [apostila, accessState]);

  const voltar = () => navigate("/home");
  const imersivo = useTelaCheiaNaPaisagem(voltar);

  if (apostila && apostila.tipo !== "html") {
    return <Navigate to={rotaDoConteudo(apostila)} replace />;
  }

  if (negadoPeloServidor) {
    return <SubscriptionExpiredScreen />;
  }

  if (accessState === "checking") {
    return <MensagemConteudo onBack={voltar}>Verificando acesso…</MensagemConteudo>;
  }

  if (!apostila) {
    return <MensagemConteudo onBack={voltar}>Apostila não encontrada. Volte para a Home e tente novamente.</MensagemConteudo>;
  }

  if (accessState === "denied") {
    return <MensagemConteudo onBack={voltar}>Você não tem acesso a este conteúdo.</MensagemConteudo>;
  }

  if (erro) {
    return <MensagemConteudo onBack={voltar}>Erro ao carregar a apostila: {toFriendlyMessage(erro)}</MensagemConteudo>;
  }

  if (html === null) {
    return (
      <MensagemConteudo onBack={voltar} carregando>
        Carregando apostila…
      </MensagemConteudo>
    );
  }

  return (
    <>
      <LeitorApostila
        titulo={apostila.titulo}
        html={html}
        escopoArmazenamento={`${user?.uid ?? "anon"}:${apostila.id}`}
        imersivo={imersivo}
        marcaDagua={user?.email ?? undefined}
        onSair={voltar}
        onImprimir={() => void imprimir()}
      />
      <ImpressaoApostila
        html={html}
        titulo={apostila.titulo}
        componente={apostila.componenteCurricular}
        email={user?.email ?? ""}
      />
      {user?.email && (
        <div className="ap-marca-dagua" aria-hidden>
          {user.email}
        </div>
      )}
      {oculto && !imprimindo && <CamadaPrivacidade />}
    </>
  );
}
