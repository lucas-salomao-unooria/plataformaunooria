import { exigirProdutoLigado } from "@/lib/recursos";

/**
 * O INTERRUPTOR DA REDE na porta do Como você está? (ADR-87).
 *
 * Layout e não página: ele cobre a app-91 embedada — rota nova
 * desta área nasce coberta, sem ninguém lembrar dela. É a mesma razão pela qual
 * a trilha é do layout (ADR-77), e o custo de esquecer aqui é pior: a rota fica
 * aberta e nada acusa.
 *
 * Esconder o card no hub é UX; a porta de verdade é do servidor
 * (`DisponibilidadeGuard` nas ferramentas, `exigirMissaoLiberada` nas missões).
 * Esta guarda existe para o professor não ver a tela de um produto que a rede
 * dele não tem — o endereço é adivinhável.
 *
 * Fragmento e não elemento: um `<div>` aqui mudaria o fluxo de altura que a
 * página de dentro monta com margens negativas.
 */
export default async function Layout({ children }: { children: React.ReactNode }) {
  await exigirProdutoLigado("bem-estar");
  return <>{children}</>;
}
