import { META_DO_FUSO, fusoDaPlataforma } from "@edu/sdk";

/**
 * Como o FUSO da plataforma (ADR-99) chega ao NAVEGADOR.
 *
 * O hub é a única superfície que roda dos dois lados. No servidor o
 * `fusoDaPlataforma()` do `@edu/sdk` lê `process.env.FUSO_DA_PLATAFORMA`; no
 * navegador não existe `process.env`, e o que existe é este `<meta>`, escrito
 * pelo `generateMetadata` do layout raiz a partir da MESMA env, na MESMA
 * resposta HTTP. É isso que torna impossível os dois lados divergirem — e
 * divergir é exatamente o defeito que a ADR-98 fechou.
 *
 * **Por que não `NEXT_PUBLIC_FUSO_DA_PLATAFORMA`:** `NEXT_PUBLIC_*` é assado no
 * build. A mesma imagem pode servir mais de um contrato, e o valor ficaria
 * errado sem ninguém ver — a falha é muda, como a do fuso que ela substituiria.
 *
 * **Por que não um provider React:** um provider vale a partir do momento em
 * que o React o executa, e a ordem entre componentes irmãos é detalhe do
 * renderizador. O `<meta>` está no `<head>`, resolvido antes de a hidratação
 * começar. Consertar uma falha de hidratação com algo que a hidratação possa
 * quebrar é trocar um defeito por outro mais difícil de ver.
 *
 * Está em `lib/` e não inline no layout para poder ser TESTADO: o vitest do hub
 * cobre `lib/**`, e "configurável" sem teste é promessa.
 */
export function metadadosDoFuso(): Record<string, string> {
  return { [META_DO_FUSO]: fusoDaPlataforma() };
}
