import { FeedbackAlert } from "@edu/ui/ds";
import { apiDoServidor } from "@/lib/api-servidor";
import { PainelDeQuotas } from "./painel-de-quotas";
import type { QuotasDeIa } from "./tipos";

/**
 * O USO DE IA DA REDE (ADR-105): o teto diário de tokens de cada perfil.
 *
 * Só `admin` chega aqui — o middleware barra a área e o `@Roles("admin")` da
 * api barra as rotas. É a segunda capacidade que `admin` tem e
 * `gestor_contrato` não (a primeira é o interruptor, ADR-88), e pela mesma
 * razão: quanto de IA uma rede pode gastar por dia é decisão comercial da
 * fornecedora, não de quem administra o contrato do lado do cliente.
 *
 * A AJUDA (quem atende, as instruções e os minutos) tem item próprio no menu,
 * `/unooria/ajuda` (ADR-165): no fim desta página ninguém a achava.
 *
 * A carga inicial é do SERVIDOR (a tela abre com dado, não com esqueleto); o
 * resto é do cliente, porque cada mudança relê as quotas e o histórico sem
 * recarregar a página.
 */
export default async function UsoDeIaPage() {
  const dados = await apiDoServidor<QuotasDeIa>("/recursos/quotas-de-ia");

  /* A api fora do ar aqui não degrada: sem o valor atual não há o que alterar,
     e um campo vazio convidaria a gravar um número sobre um estado que não se
     conhece — e a quota vale para a rede inteira. */
  if (!dados) {
    return (
      <FeedbackAlert
        type="error"
        title="As quotas não carregaram"
        description="A api não respondeu. Recarregue a página; se persistir, confira o serviço antes de alterar qualquer teto."
      />
    );
  }

  return <PainelDeQuotas inicial={dados.quotas} />;
}
