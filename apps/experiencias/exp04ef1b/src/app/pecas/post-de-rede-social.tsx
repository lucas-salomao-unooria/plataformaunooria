import { PostCard } from "@edu/ui/ds-unoovista";
import { ERROS } from "../../lib/textos";
import type { NoticiaPublica } from "../../lib/tipos";

/**
 * A matéria original de uma notícia que veio de REDE SOCIAL — o `PostCard` da
 * seção `unoovista` (ADR-117: a peça fala na voz de onde veio, porque um post
 * que não parece post não ensina a reconhecer post; ADR-136: a rede é a
 * Unoovista, não o clone do Instagram). Este arquivo importa SÓ a ponte
 * `@edu/ui/ds-unoovista`: a peça é da rede, a moldura em volta é da redação.
 *
 * **A peça, e só ela.** Nada da barra, das abas nem do fundo do app. E também
 * nada do que o PDF §1 tira da redação: sem `Actions` (curtir, comentar,
 * compartilhar), sem `Likes` — a contagem de curtidas viraria pista falsa de
 * confiabilidade —, e sem `Timestamp`: a DATA é uma pista que a criança revela à
 * parte, e o carimbo do post a entregaria antes da hora.
 *
 * `theme="light"` fixa o tema no próprio cartão. O `:root` da seção já é claro
 * (ela não segue o modo escuro do sistema, ao contrário do Instanooria), mas o
 * cartão sem `theme` herda o `data-unv-theme` de quem estiver em volta, e
 * a redação em volta é clara.
 */
export function PostDeRedeSocial({ noticia, aoFalharMidia }: { noticia: NoticiaPublica; aoFalharMidia: () => void }) {
  const url = noticia.imagem?.url ?? undefined;
  return (
    <div className="peca-unoovista">
      <PostCard theme="light">
        <PostCard.Header username={noticia.veiculo} />
        {url ? (
          <PostCard.Media
            src={url}
            alt={noticia.imagem?.alt ?? noticia.manchete}
            errorLabel={ERROS.midia}
            onMediaError={aoFalharMidia}
          />
        ) : (
          /* Sem fotografia (o professor ainda não gerou as imagens, ou a
             notícia não tem): o slide de TEXTO, como um post só de texto. */
          <PostCard.Media alt={noticia.imagem?.alt ?? noticia.manchete}>
            <div className="post-desenhado">
              <p className="post-desenhado__texto">{noticia.manchete}</p>
            </div>
          </PostCard.Media>
        )}
        <PostCard.Caption username={noticia.veiculo}>
          {url ? `${noticia.manchete} ${noticia.corpo}` : noticia.corpo}
        </PostCard.Caption>
      </PostCard>
    </div>
  );
}
