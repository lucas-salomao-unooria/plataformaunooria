import { FeedbackAlert } from "@edu/ui/ds";
import { apiDoServidor } from "@/lib/api-servidor";
import { PainelDeProspeccao } from "./painel-de-prospeccao";
import type { Cadastros } from "./tipos";

/**
 * PROSPECÇÃO (ADR-107): quem pediu contato pelo formulário do site público.
 *
 * Só `admin` chega aqui — o middleware barra a área e o `@Roles("admin")` da
 * api barra as rotas. É a terceira capacidade que `admin` tem e
 * `gestor_contrato` não (ADR-88), e a razão é a mesma das outras duas: quem
 * procurou a Unooria antes de existir contrato é o funil comercial da
 * fornecedora. O `gestor_contrato` é o cliente — esta lista é sobre ele, não
 * para ele.
 *
 * A carga inicial é do SERVIDOR (a tela abre com dado, não com esqueleto); o
 * "Atualizar" e o download do CSV são do cliente.
 */
export default async function ProspeccaoPage() {
  const dados = await apiDoServidor<Cadastros>("/prospeccao/cadastros");

  /* Sem degradar para lista vazia: "nenhum cadastro ainda" e "a api não
     respondeu" são a MESMA tela, e a primeira leitura mandaria procurar
     defeito no formulário do site em vez de na api. */
  if (!dados) {
    return (
      <FeedbackAlert
        type="error"
        title="Os cadastros não carregaram"
        description="A api não respondeu. Recarregue a página; se persistir, confira o serviço antes de concluir que ninguém se cadastrou."
      />
    );
  }

  return <PainelDeProspeccao inicial={dados} />;
}
