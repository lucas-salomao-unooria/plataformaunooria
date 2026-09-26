import { FeedbackAlert } from "@edu/ui/ds";
import { apiDoServidor } from "@/lib/api-servidor";
import { ListaDeArquivadas } from "./lista-de-arquivadas";
import type { Arquivadas } from "./tipos";

/**
 * ARQUIVADOS (ADR-116): as experiências tiradas do produto sem serem apagadas.
 *
 * Uma experiência é arquivada quando uma missão nova toma o código dela — o
 * código é derivado da série e da unidade (ADR-110), e não cabem duas missões na
 * mesma unidade. Em vez de apagar, tudo o que era dela ganha o prefixo `backup-`
 * e os dados ficam. Esta tela SÓ LISTA: ninguém joga uma experiência arquivada,
 * e desarquivar é uma migração.
 *
 * Só `admin` chega aqui — o middleware barra a área e o `@Roles("admin")` da api
 * barra a rota. A carga é do SERVIDOR: a tela abre com dado, não com esqueleto.
 */
export default async function ArquivadosPage() {
  const dados = await apiDoServidor<Arquivadas>("/recursos/arquivadas");

  /* Sem degradar para lista vazia: "nada arquivado" e "a api não respondeu"
     seriam a MESMA tela, e a primeira leitura esconderia o erro. */
  if (!dados) {
    return (
      <FeedbackAlert
        type="error"
        title="As experiências arquivadas não carregaram"
        description="A api não respondeu. Recarregue a página; se persistir, confira o serviço antes de concluir que não há nada arquivado."
      />
    );
  }

  return <ListaDeArquivadas arquivadas={dados.arquivadas} />;
}
