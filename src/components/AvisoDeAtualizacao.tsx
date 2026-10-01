import { useEffect, useState } from "react";
import { Button } from "./index";
import { aplicarAtualizacao, haVersaoMaisNova } from "@/state/atualizacao";

export function AvisoDeAtualizacao() {
  const [visivel, setVisivel] = useState(false);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    let ativo = true;
    void haVersaoMaisNova().then((nova) => {
      if (ativo && nova) setVisivel(true);
    });
    return () => {
      ativo = false;
    };
  }, []);

  if (!visivel) return null;

  const atualizar = async () => {
    setFalhou(false);
    if (!(await aplicarAtualizacao())) setFalhou(true);
  };

  return (
    <div className="m3-dialog-scrim">
      <div className="m3-dialog" role="alertdialog" aria-modal="true" aria-labelledby="aviso-atualizacao">
        <p id="aviso-atualizacao" className="m3-body-large">
          {falhou
            ? "Não foi possível baixar a atualização agora. Tente de novo em alguns minutos."
            : "Uma atualização está disponível, toque abaixo para atualizar"}
        </p>
        <Button fullWidth onClick={atualizar}>
          {falhou ? "Tentar de novo" : "Atualizar"}
        </Button>
      </div>
    </div>
  );
}
