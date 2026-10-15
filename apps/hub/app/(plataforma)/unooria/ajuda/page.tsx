import { FeedbackAlert } from "@edu/ui/ds";
import { apiDoServidor } from "@/lib/api-servidor";
import { PainelDaAjuda } from "./painel-da-ajuda";
import type { ConfiguracaoDaAjuda, LimitesDaAjuda } from "./tipos";

/**
 * A AJUDA DA REDE (ADR-132, ADR-158, ADR-165): quem atende — o mascote da
 * Unooria ou o atendente em vídeo —, a voz e a boca do mascote, as INSTRUÇÕES
 * de cada atendente (o "como responder" do prompt) e os minutos por pessoa.
 *
 * Só `admin` chega aqui (o middleware barra a área e o `@Roles("admin")` da api
 * barra as rotas): qual atendente a rede usa e quanto ele gasta é decisão da
 * fornecedora. Até a ADR-165 isto morava no fim de "Uso de IA", embaixo das
 * quotas e do histórico delas, e quem procurava não achava.
 */
export default async function AjudaPage() {
  const [limites, configuracao] = await Promise.all([
    apiDoServidor<LimitesDaAjuda>("/recursos/limites-da-ajuda"),
    apiDoServidor<ConfiguracaoDaAjuda>("/recursos/configuracao-da-ajuda"),
  ]);

  if (!limites) {
    return (
      <FeedbackAlert
        type="error"
        title="A Ajuda não carregou"
        description="A api não respondeu. Recarregue a página antes de alterar qualquer configuração."
      />
    );
  }

  return <PainelDaAjuda inicial={limites.limites} configuracao={configuracao} />;
}
