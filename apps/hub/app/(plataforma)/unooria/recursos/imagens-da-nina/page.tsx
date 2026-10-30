import { FeedbackAlert } from "@edu/ui/ds";
import { apiDoServidor } from "@/lib/api-servidor";
import { CAMINHO_DAS_IMAGENS_DO_BANCO, type ImagensDoBancoPadrao } from "@/lib/nina-noticia-tipos";
import { ImagensDoBancoDaNina } from "./imagens-do-banco";

/**
 * AS IMAGENS DO BANCO PADRÃO DE NINA E A NOTÍCIA QUE DESAPARECEU (exp03ef1b,
 * ADR-199): as seis — as quatro da Feira de Troca de Livros (mural, portal,
 * telão e cartaz) e as duas CENAS FIXAS do caso novo (o Desafio Extra saiu
 * na ADR-201), iguais para todas as turmas. Molde: `../imagens-do-juri/`.
 *
 * Gerá-las aqui é ADIANTAR o trabalho: a professora que usa o banco padrão
 * gera as que faltam no preparo dela (com a quota dela as quatro da feira; na
 * conta da plataforma as cenas fixas), e a próxima turma acha o arquivo pelo
 * hash. Sem esta tela, as cenas fixas só nasciam por uma rota sem interface, e
 * dev ficou sem foto nenhuma.
 *
 * Só `admin` chega aqui — o middleware barra a área e o `@Roles("admin")` da
 * api barra as duas rotas (`GET`/`POST /nina-noticia/banco-padrao/imagens`). A
 * geração é do cliente, pelo BFF (prefixo `nina-noticia`). A carga inicial é
 * do SERVIDOR: a tela abre com o progresso, não com esqueleto.
 */
export default async function ImagensDaNinaPage() {
  const inicial = await apiDoServidor<ImagensDoBancoPadrao>(CAMINHO_DAS_IMAGENS_DO_BANCO);

  /* Sem degradar para "0 de 8": "nenhuma imagem" e "a api não respondeu"
     seriam a MESMA tela, e a primeira leitura mandaria gerar as oito. */
  if (!inicial) {
    return (
      <FeedbackAlert
        type="error"
        title="As imagens do banco padrão não carregaram"
        description="A api não respondeu. Recarregue a página; se persistir, confira o serviço antes de gerar qualquer imagem."
      />
    );
  }

  return <ImagensDoBancoDaNina inicial={inicial} />;
}
