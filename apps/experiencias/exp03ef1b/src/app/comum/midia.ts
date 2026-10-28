import cenaMural from "../../assets/cenas/mural.svg";
import cenaPortal from "../../assets/cenas/portal.svg";
import cenaTelao from "../../assets/cenas/telao.svg";
import cenaCartaz from "../../assets/cenas/cartaz.svg";
import cenaCasoA from "../../assets/cenas/caso-a.svg";
import cenaCasoB from "../../assets/cenas/caso-b.svg";
import cenaExtra1 from "../../assets/cenas/extra-1.svg";
import cenaExtra2 from "../../assets/cenas/extra-2.svg";
import type { ImagemPublica } from "../../lib/tipos";

/**
 * A ilustração LOCAL de cada cena — o que a tela desenha quando a `midia` do
 * pacote não tem a imagem (`url: null`: ainda não gerada, ou falhou na
 * geração) e quando a foto não baixa duas vezes seguidas. As fotos de verdade
 * vêm da api (geradas pela IA no preparo, ou pelo `admin` no banco padrão).
 */
export const ILUSTRACAO = {
  mural: cenaMural,
  portal: cenaPortal,
  telao: cenaTelao,
  cartaz: cenaCartaz,
  "caso-a": cenaCasoA,
  "caso-b": cenaCasoB,
  "extra-1": cenaExtra1,
  "extra-2": cenaExtra2,
} as const;

export type Cena = keyof typeof ILUSTRACAO;

/** O endereço que a tela usa: a foto da api, ou a ilustração local quando não há (ou quando ela falhou). */
export function enderecoDaImagem(imagem: ImagemPublica, cena: Cena, usarIlustracao = false): string {
  return !usarIlustracao && imagem.url ? imagem.url : ILUSTRACAO[cena];
}

/**
 * Pré-carrega as fotos (spec §1: "Pré-carrega mídias"). Resolve com as URLs
 * que FALHARAM — vazio é tudo certo. URL nula não entra: ela já é a ilustração.
 */
export function preCarregar(urls: readonly (string | null)[]): Promise<string[]> {
  const reais = urls.filter((u): u is string => Boolean(u));
  return Promise.all(
    reais.map(
      (url) =>
        new Promise<string | null>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(null);
          img.onerror = () => resolve(url);
          img.src = url;
        }),
    ),
  ).then((r) => r.filter((u): u is string => u !== null));
}
