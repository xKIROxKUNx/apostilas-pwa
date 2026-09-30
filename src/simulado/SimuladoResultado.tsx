import type { Simulado, Tentativa } from "./types";
import { ROTULO_DIFICULDADE, calcularResultado, descreverReferencia, formatarDuracao, porcentagem } from "./scoring";
import { LinhaPlacar } from "./partes";
import RichText from "./RichText";
import { Button, Card } from "@/components";

interface SimuladoResultadoProps {
  simulado: Simulado;
  tentativa: Tentativa;
  onRevisar: (apenasErros: boolean) => void;
  onCorrigirDiscursivas: () => void;
  onRefazerErros: (numeros: number[]) => void;
  onNovo: () => void;
}

export default function SimuladoResultado({
  simulado,
  tentativa,
  onRevisar,
  onCorrigirDiscursivas,
  onRefazerErros,
  onNovo,
}: SimuladoResultadoProps) {
  const r = calcularResultado(simulado, tentativa);
  const temObjetivas = r.objetivas.total > 0;
  const prioritarios = r.capitulosComErro.filter((c) => c.erros >= 2);
  const isolados = r.capitulosComErro.length - prioritarios.length;
  const porCaso = simulado.agrupamento === "caso";
  const pendentes = r.discursivas.total - r.discursivas.corrigidas;

  return (
    <div className="sim-conteudo">
      <Card variant="primary" radius="xl" className="sim-card">
        <p className="m3-label-large">
          {tentativa.escopoTitulo} · {tentativa.modo === "treino" ? "Treino" : "Prova"} ·{" "}
          {formatarDuracao(tentativa.tempoMs)}
        </p>
        {temObjetivas ? (
          <>
            <p className="sim-placar-grande">{porcentagem(r.objetivas)}%</p>
            <p className="m3-body-large">
              {r.objetivas.acertos} de {r.objetivas.total} objetivas corretas
              {r.respondidas < r.objetivas.total ? ` · ${r.objetivas.total - r.respondidas} em branco` : ""}
            </p>
          </>
        ) : (
          <p className="m3-body-large">Esta tentativa só tinha questões discursivas.</p>
        )}
      </Card>

      {temObjetivas && (
        <Card variant="filled" className="sim-card">
          <p className="m3-title-small">Por dificuldade</p>
          {(["facil", "media", "dificil"] as const)
            .filter((d) => r.porDificuldade[d].total > 0)
            .map((d) => (
              <LinhaPlacar key={d} rotulo={ROTULO_DIFICULDADE[d]} placar={r.porDificuldade[d]} />
            ))}
          {simulado.orientacaoGabarito && (
            <RichText className="sim-texto m3-body-small sim-muted" html={simulado.orientacaoGabarito} />
          )}
        </Card>
      )}

      {r.porGrupo.length > 0 && (
        <Card variant="filled" className="sim-card">
          <p className="m3-title-small">{porCaso ? "Por caso" : "Por capítulo"}</p>
          {r.porGrupo.map((g) => {
            const fraca = porcentagem(g.placar) < simulado.limiarPontoFraco;
            return (
              <LinhaPlacar
                key={g.id}
                rotulo={`${g.id} · ${g.titulo}`}
                placar={g.placar}
                fraca={fraca}
                detalhe={fraca ? "ponto fraco" : undefined}
              />
            );
          })}
          <p className="m3-body-small sim-muted">
            Abaixo de {simulado.limiarPontoFraco}% (em vermelho) é o ponto fraco prioritário: releia{" "}
            {porCaso ? "a apostila inteira desse caso" : "o capítulo inteiro"}, não só as questões.
          </p>
        </Card>
      )}

      {r.parteI.total > 0 && r.parteII.total > 0 && (
        <Card variant="filled" className="sim-card">
          <p className="m3-title-small">{porCaso ? "Casos isolados × integrados" : "Capítulos × casos integrados"}</p>
          <LinhaPlacar rotulo={porCaso ? "Parte I · por caso" : "Parte I · por capítulo"} placar={r.parteI} />
          <LinhaPlacar rotulo="Parte II · casos integrados" placar={r.parteII} />
          {simulado.orientacaoPosCorrecao && (
            <RichText className="sim-texto m3-body-small sim-muted" html={simulado.orientacaoPosCorrecao} />
          )}
        </Card>
      )}

      {r.capitulosComErro.length > 0 && (
        <Card variant="filled" className="sim-card">
          <p className="m3-title-small">Onde reler</p>
          {prioritarios.length > 0 ? (
            prioritarios.map((c) => (
              <div key={c.referencia} className="sim-linha-barra__topo">
                <span className="m3-body-medium">{descreverReferencia(c.referencia)}</span>
                <span className="m3-label-large">{c.erros} erros</span>
              </div>
            ))
          ) : (
            <p className="m3-body-medium">Nenhum capítulo concentra dois ou mais erros.</p>
          )}
          <p className="m3-body-small sim-muted">
            Dois ou mais erros no mesmo capítulo apontam lacuna de conteúdo: releia o capítulo inteiro.
            {isolados === 1 ? " Outro capítulo teve um erro." : ""}
            {isolados > 1 ? ` Outros ${isolados} capítulos tiveram um erro cada.` : ""}
          </p>
        </Card>
      )}

      {r.discursivas.total > 0 && (
        <Card variant="filled" className="sim-card">
          <p className="m3-title-small">Discursivas</p>
          <p className="m3-body-medium">
            {r.discursivas.corrigidas} de {r.discursivas.total} corrigidas pelo espelho
            {r.discursivas.maximo > 0
              ? ` · ${r.discursivas.pontos.toLocaleString("pt-BR")} de ${r.discursivas.maximo} pontos (${porcentagem({
                  acertos: r.discursivas.pontos,
                  total: r.discursivas.maximo,
                })}%)`
              : ""}
          </p>
          <p className="m3-body-small sim-muted">
            Elas medem explicação de mecanismo e são avaliadas à parte das objetivas.
          </p>
          {pendentes > 0 && (
            <Button variant="tonal" onClick={onCorrigirDiscursivas}>
              Corrigir discursivas ({pendentes})
            </Button>
          )}
        </Card>
      )}

      {simulado.orientacaoCorrecao && (
        <Card variant="filled" className="sim-card">
          <p className="m3-title-small">Como usar o resultado</p>
          <RichText className="sim-texto m3-body-medium" html={simulado.orientacaoCorrecao} />
        </Card>
      )}

      <div className="sim-acoes">
        {r.erros.length > 0 && <Button onClick={() => onRevisar(true)}>Revisar erros ({r.erros.length})</Button>}
        {temObjetivas && (
          <Button variant="tonal" onClick={() => onRevisar(false)}>
            Revisar todas as questões
          </Button>
        )}
        {r.erros.length > 0 && (
          <Button variant="tonal" onClick={() => onRefazerErros(r.erros)}>
            Refazer só os erros
          </Button>
        )}
        <Button variant="text" onClick={onNovo}>
          Voltar ao início do simulado
        </Button>
      </div>
    </div>
  );
}
