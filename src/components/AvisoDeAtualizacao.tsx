import { useEffect, useState } from "react";
import { Button } from "./index";
import { aplicarAtualizacao, atualizacaoFalhou, haVersaoMaisNova } from "@/state/atualizacao";

export function AvisoDeAtualizacao() {
  const [visivel, setVisivel] = useState(false);
  const [falhou, setFalhou] = useState(atualizacaoFalhou);

  useEffect(() => {
    let ativo = true;
    let verificando = false;

    const verificar = async () => {
      if (verificando || document.visibilityState !== "visible") return;
      verificando = true;
      const nova = await haVersaoMaisNova();
      verificando = false;
      if (ativo && nova) setVisivel(true);
    };

    const aoMudarVisibilidade = () => {
      if (document.visibilityState === "visible") void verificar();
    };

    void verificar();
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    window.addEventListener("online", verificar);
    return () => {
      ativo = false;
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
      window.removeEventListener("online", verificar);
    };
  }, []);

  if (!visivel) return null;

  return (
    <div className="m3-dialog-scrim">
      <div className="m3-dialog" role="alertdialog" aria-modal="true" aria-labelledby="aviso-atualizacao">
        <p id="aviso-atualizacao" className="m3-body-large">
          {falhou
            ? "Não foi possível atualizar agora. Tente de novo em alguns minutos."
            : "Uma atualização está disponível, toque abaixo para atualizar"}
        </p>
        <Button
          fullWidth
          onClick={() => {
            setFalhou(false);
            void aplicarAtualizacao();
          }}
        >
          {falhou ? "Tentar de novo" : "Atualizar"}
        </Button>
      </div>
    </div>
  );
}
