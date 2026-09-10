import { FeedbackAlert } from "@edu/ui/ds";
import { apiDoServidor } from "@/lib/api-servidor";
import { PainelDeRecursos } from "./painel-de-recursos";
import type { EscolaDoEscopo, Painel } from "./tipos";

/**
 * O PAINEL DE RECURSOS DA UNOORIA (ADR-87/88): o que cada rede tem, e o que
 * está no ar dentro de cada produto.
 *
 * Só `admin` chega aqui — o middleware barra a área e o `@Roles("admin")` da api
 * barra as rotas. É a primeira capacidade que `admin` tem e `gestor_contrato`
 * não, e é decisão comercial: ligar e desligar produto é da fornecedora.
 *
 * A carga inicial é do SERVIDOR (a tela abre com dado, não com esqueleto); o
 * resto é do cliente, porque cada mudança precisa reler o painel — o teto do
 * produto muda o estado de todas as experiências dentro dele, e recarregar a
 * página inteira a cada clique perderia o escopo escolhido.
 */
export default async function RecursosPage({
  searchParams,
}: {
  searchParams: Promise<{ escolaId?: string }>;
}) {
  const { escolaId } = await searchParams;

  const [painel, escolas] = await Promise.all([
    apiDoServidor<Painel>(
      escolaId ? `/recursos/painel?escolaId=${encodeURIComponent(escolaId)}` : "/recursos/painel",
    ),
    apiDoServidor<EscolaDoEscopo[]>("/escolas"),
  ]);

  /* A api fora do ar aqui não degrada: sem o painel não há o que ligar nem
     desligar, e um painel meio carregado convidaria a decidir sobre estado que
     não se conhece — no escopo-contrato isso é uma alavanca de incidente. */
  if (!painel) {
    return (
      <FeedbackAlert
        type="error"
        title="O painel não carregou"
        description="A api não respondeu. Recarregue a página; se persistir, confira o serviço antes de mexer em qualquer interruptor."
      />
    );
  }

  /**
   * O `key` REMONTA o painel quando o escopo muda, e sem ele a tela MENTE.
   *
   * `PainelDeRecursos` guarda o painel em `useState(inicial)` para poder
   * reler sozinho depois de cada mudança. Mas `useState` só usa o valor
   * inicial na MONTAGEM: trocar de escopo faz `router.push`, o servidor
   * devolve o painel da escola nova — e o componente, não remontado, continua
   * exibindo o do escopo anterior.
   *
   * O custo não é cosmético: o `escolaId` que as escritas usam sai do painel
   * em estado. Com o estado velho, escolher uma ESCOLA e desligar um produto
   * gravava a linha no CONTRATO — a rede inteira, com a tela dizendo que era
   * a escola. Foi medido: a suíte e2e do `admin` derrubou o produto para todas
   * as escolas enquanto afirmava operar numa.
   *
   * É a mesma doutrina do `<EscopoDaEscola>` (ADR-85): quando o escopo é
   * insumo de tudo o que a tela mostra, trocar de escopo REMONTA o miolo em vez
   * de tentar sincronizar estado.
   */
  return (
    <PainelDeRecursos
      key={painel.escopo.escolaId ?? "contrato"}
      inicial={painel}
      escolas={escolas ?? []}
    />
  );
}
