import { useEffect, useRef } from "react";
import { Snackbar } from "@edu/ui/ds";
import type { EtapaDaMissao } from "../lib/regras";
import { telemetria } from "../lib/telemetria";
import { ERROS } from "../lib/textos";
import type { AvisoDeConexao } from "./conexao";

/**
 * Os avisos globais — sem sinal, muitos pedidos (429), sessão pausada e a
 * rodada nova (409 `rodada-mudou`) — na voz da REDAÇÃO ("Conexão com a gráfica
 * oscilou…"), nunca "erro 500" nem "falha na API".
 *
 * A redação é da Unooria (ADR-117), então o aviso é o `Snackbar` da seção
 * `unooria`: região VIVA (`role="status"`), fora do fluxo e sem bloquear — a
 * criança continua lendo a mesa enquanto a chamada se repete. Ele fica montado
 * só enquanto há aviso; o `duration={0}` impede que suma sozinho com a rede
 * ainda fora, e sem `X` porque fechar não traz a rede de volta.
 *
 * O da sessão tem a ação "Tentar novamente": quem renova o token é o hub, e o
 * toque só encurta a espera da próxima tentativa (`conexao.revalidar`).
 */
const CODIGO_DO_AVISO = {
  rede: "sem-sinal",
  limite: "muitas-requisicoes",
  sessao: "sessao-expirada",
} as const;

export function Avisos({
  aviso,
  etapa,
  rodadaNova = false,
  aoRevalidar,
  aoFecharRodada,
}: {
  aviso: AvisoDeConexao;
  etapa: EtapaDaMissao;
  /** A releitura trouxe OUTRA sessão: o professor zerou a turma ou trocou o pacote (`rodada-mudou`). */
  rodadaNova?: boolean;
  aoRevalidar: () => void;
  aoFecharRodada?: () => void;
}) {
  /* EVT-U05 uma vez por aviso ACESO, não a cada render nem a cada tentativa. */
  const ultimo = useRef<AvisoDeConexao>(null);
  useEffect(() => {
    if (aviso && aviso !== ultimo.current) telemetria.viuErro(CODIGO_DO_AVISO[aviso], etapa);
    ultimo.current = aviso;
  }, [aviso, etapa]);

  if (!aviso) {
    /* A rodada nova é INFORMAÇÃO, não falha: a tela já mostra a mesa nova, e o
       aviso some sozinho (5 s, o padrão do `Snackbar`). */
    return rodadaNova ? (
      <div className="jornal__avisos">
        <Snackbar severity="info" title={ERROS.rodadaMudou} onClose={aoFecharRodada} />
      </div>
    ) : null;
  }
  return (
    <div className="jornal__avisos">
      {aviso === "rede" ? (
        <Snackbar severity="warning" title={ERROS.semSinal} duration={0} showClose={false} />
      ) : aviso === "limite" ? (
        <Snackbar severity="warning" title={ERROS.muitasRequisicoes} duration={0} showClose={false} />
      ) : (
        <Snackbar
          severity="warning"
          title={ERROS.sessaoExpirada}
          duration={0}
          showClose={false}
          actionLabel={ERROS.tentarNovamente}
          onAction={aoRevalidar}
        />
      )}
    </div>
  );
}
