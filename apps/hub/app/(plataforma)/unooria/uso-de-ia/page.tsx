import { FeedbackAlert } from "@edu/ui/ds";
import { apiDoServidor } from "@/lib/api-servidor";
import { PainelDaAjuda } from "./painel-da-ajuda";
import { PainelDeQuotas } from "./painel-de-quotas";
import type { ConfiguracaoDaAjuda, LimitesDaAjuda, QuotasDeIa } from "./tipos";

/**
 * O USO DE IA DA REDE (ADR-105): o teto diário de tokens de cada perfil.
 *
 * Só `admin` chega aqui — o middleware barra a área e o `@Roles("admin")` da
 * api barra as rotas. É a segunda capacidade que `admin` tem e
 * `gestor_contrato` não (a primeira é o interruptor, ADR-88), e pela mesma
 * razão: quanto de IA uma rede pode gastar por dia é decisão comercial da
 * fornecedora, não de quem administra o contrato do lado do cliente.
 *
 * Embaixo, a AJUDA: quem atende — o mascote ou o avatar em vídeo (ADR-158) — e
 * os MINUTOS (ADR-132): a Ajuda fica fora da quota de tokens, e o que limita o
 * custo dela é o tempo de conversa.
 *
 * A carga inicial é do SERVIDOR (a tela abre com dado, não com esqueleto); o
 * resto é do cliente, porque cada mudança relê as quotas e o histórico sem
 * recarregar a página.
 */
export default async function UsoDeIaPage() {
  const [dados, ajuda, atendente] = await Promise.all([
    apiDoServidor<QuotasDeIa>("/recursos/quotas-de-ia"),
    apiDoServidor<LimitesDaAjuda>("/recursos/limites-da-ajuda"),
    apiDoServidor<ConfiguracaoDaAjuda>("/recursos/configuracao-da-ajuda"),
  ]);

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

  return (
    <div className="flex flex-col gap-12">
      <PainelDeQuotas inicial={dados.quotas} />
      {ajuda ? (
        <PainelDaAjuda inicial={ajuda.limites} configuracao={atendente} />
      ) : (
        <FeedbackAlert
          type="error"
          title="Os limites da Ajuda não carregaram"
          description="A api não respondeu. Recarregue a página antes de alterar qualquer limite."
        />
      )}
    </div>
  );
}
