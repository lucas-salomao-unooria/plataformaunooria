import type { NewspaperSlot, NewspaperSlotMarker } from "@edu/ui/ds";
import { MEIO_PARA_MEDIUM } from "../../lib/meios";
import type { Vagas } from "../../lib/regras";
import { EREV } from "../../lib/textos";
import type { IdDeNoticia, NoticiaPublica, TipoDePista, VagaMarcada } from "../../lib/tipos";

/**
 * A notícia como VAGA da `NewspaperPage`. A imagem entra só com `url` E `alt`
 * (o tipo do DS recusa imagem sem descrição); sem `url` — o professor ainda não
 * gerou as imagens —, a vaga sai só com o texto, e a missão roda igual.
 */
export function vagaDaPagina(noticia: NoticiaPublica, marker?: NewspaperSlotMarker): NewspaperSlot {
  const base = {
    id: noticia.id,
    headline: noticia.manchete,
    summary: noticia.resumo,
    medium: MEIO_PARA_MEDIUM[noticia.meio],
    marker,
  };
  const url = noticia.imagem?.url;
  const alt = noticia.imagem?.alt;
  return url && alt ? { ...base, imageSrc: url, imageAlt: alt } : base;
}

/** O marcador que a Chave põe numa vaga: o pilar que falta, ou "verificada". Nunca só cor. */
export function marcadorDoPilar(pilar: TipoDePista | null): NewspaperSlotMarker {
  return pilar === null ? { tone: "ok", label: EREV.verificada } : { tone: "alert", label: EREV.marcador[pilar] };
}

/** O mapa notícia → pilar em falta, a partir das vagas marcadas que a api devolveu. */
export function mapaDeMarcadores(vagas: readonly VagaMarcada[]): ReadonlyMap<IdDeNoticia, TipoDePista | null> {
  return new Map(vagas.map((v) => [v.noticiaId, v.pilarEmFalta]));
}

/**
 * As três vagas da página, na ordem, com o marcador de quem o tem. Uma vaga
 * trocada na revisão perde o marcador: ele era da notícia da 1ª edição, e dizer
 * alguma coisa da notícia NOVA seria a tela corrigindo a escolha no lugar da
 * criança (quem checa agora é ela, pelas pistas).
 */
export function vagasDaPagina(
  vagas: Vagas,
  porId: ReadonlyMap<IdDeNoticia, NoticiaPublica>,
  marcadores?: ReadonlyMap<IdDeNoticia, TipoDePista | null>,
): (NewspaperSlot | null)[] {
  return vagas.map((id) => {
    const noticia = id ? porId.get(id) : undefined;
    if (!noticia) return null;
    const pilar = marcadores?.get(noticia.id);
    return vagaDaPagina(noticia, pilar === undefined ? undefined : marcadorDoPilar(pilar));
  });
}
