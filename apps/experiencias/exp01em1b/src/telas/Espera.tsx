import { EmptyState } from "@edu/ui/ds";
import { Casca } from "../componentes/Casca";
import { TEXTOS } from "../lib/textos";

/**
 * O FUNDO das travas (E4-SIS-01 e E5-SIS-01): o módulo em segundo plano,
 * debaixo da camada de espera (`componentes/Janelas.tsx#Espera`) que o
 * despachante põe por cima. O passo do servidor é o próximo (a bancada, a
 * publicação); o que segura é a fase da turma.
 */
export function FundoDeEspera({ etapa, equipe }: { etapa: 4 | 5; equipe: { nome: string } | null }) {
  return (
    <Casca cabecalho={{ titulo: TEXTOS.geral.unooria, tag: TEXTOS.espera.etapa(etapa) }} equipe={equipe}>
      <p className="escola__texto escola__texto--suave">{etapa === 4 ? TEXTOS.espera.fundoE4 : TEXTOS.espera.fundoE5}</p>
    </Casca>
  );
}

/** Sem pacote no ar: a missão nasce vazia até o professor homologar o pacote e liberar a atividade. */
export function SemPacote() {
  return (
    <Casca cabecalho={{ titulo: TEXTOS.e1.cabecalho, tag: TEXTOS.e1.tagPadrao }} equipe={null}>
      <EmptyState title={TEXTOS.espera.tag} description={TEXTOS.espera.texto} />
    </Casca>
  );
}
