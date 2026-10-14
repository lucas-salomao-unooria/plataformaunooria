import { FeedbackAlert } from "@edu/ui/ds";
import { apiDoServidor } from "@/lib/api-servidor";
import { CAMINHO_DAS_IMAGENS_DO_BANCO, type ImagensDoBancoPadrao } from "@/lib/juri-estadual-tipos";
import { ImagensDoBancoDoJuri } from "./imagens-do-banco";

/**
 * AS IMAGENS DO BANCO PADRÃO DO JÚRI ESTADUAL (exp06ef1b): uma por projeto do
 * banco padrão (quarenta), geradas pela conta da Unooria e usadas por toda
 * atividade que nasce do banco — o atalho "Usar Banco Padrão Oficial" e o
 * fallback sem cota de IA. O projeto sem imagem segue com a arte desenhada da
 * missão, então a tela só mostra o que existe e gera o que falta.
 *
 * Mora debaixo de Recursos porque é conteúdo de um produto, não da rede: o
 * banco é o mesmo para todo contrato, e o storage é o registro (a api não tem
 * tabela). Só `admin` chega aqui — o middleware barra a área e o
 * `@Roles("admin")` da api barra as duas rotas (`GET`/`POST
 * /juri-estadual/banco-padrao/imagens`). A geração é do cliente, pelo BFF
 * (prefixo `juri-estadual`), num laço de até quatro por chamada.
 *
 * A carga inicial é do SERVIDOR: a tela abre com o progresso, não com esqueleto.
 */
export default async function ImagensDoJuriPage() {
  const inicial = await apiDoServidor<ImagensDoBancoPadrao>(CAMINHO_DAS_IMAGENS_DO_BANCO);

  /* Sem degradar para "0 de 40": "nenhuma imagem" e "a api não respondeu"
     seriam a MESMA tela, e a primeira leitura mandaria gerar as quarenta. */
  if (!inicial) {
    return (
      <FeedbackAlert
        type="error"
        title="As imagens do banco padrão não carregaram"
        description="A api não respondeu. Recarregue a página; se persistir, confira o serviço antes de gerar qualquer imagem."
      />
    );
  }

  return <ImagensDoBancoDoJuri inicial={inicial} />;
}
