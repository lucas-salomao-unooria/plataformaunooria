import { FeedbackAlert } from "@edu/ui/ds";
import { apiDoServidor } from "@/lib/api-servidor";
import { TelaDeCustos } from "./tela-de-custos";
import type { PainelDeCustos, PrecosDeIa } from "./tipos";

/**
 * CUSTOS DE IA (ADR-161): o FinOps da Unooria — quanto a IA desta rede custou,
 * em tokens, em dólar e em real (PTAX do Banco Central), por dia, produto,
 * modelo, modalidade e escola, e a tabela de preços de onde o custo sai.
 *
 * Só `admin` chega aqui — o middleware barra a área e o `@Roles("admin")` da
 * api barra as rotas. Pela razão da quota (ADR-105): é o custo variável da
 * fornecedora, e mostrá-lo à rede seria entregar a margem do contrato.
 *
 * A carga inicial é do SERVIDOR (os últimos 30 dias, que é o padrão da api);
 * trocar de período e gravar preço é do cliente.
 */
export default async function CustosDeIaPage() {
  const [painel, precos] = await Promise.all([
    apiDoServidor<PainelDeCustos>("/recursos/custos-de-ia"),
    apiDoServidor<PrecosDeIa>("/recursos/custos-de-ia/precos"),
  ]);

  /* Sem o painel não há o que mostrar, e um painel zerado diria "a IA não
     custou nada" — a leitura errada de "a api não respondeu". */
  if (!painel) {
    return (
      <FeedbackAlert
        type="error"
        title="Os custos não carregaram"
        description="A api não respondeu. Recarregue a página; se persistir, confira o serviço."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <TelaDeCustos painel={painel} precos={precos} />
      {!precos ? (
        <FeedbackAlert
          type="error"
          title="A tabela de preços não carregou"
          description="O painel acima usa os preços guardados na api; só a edição deles ficou indisponível. Recarregue a página para cadastrar um preço."
        />
      ) : null}
    </div>
  );
}
