import { PostCard } from "@edu/ui/ds-insta";
import { ERROS } from "../../lib/textos";
import type { NoticiaPublica } from "../../lib/tipos";

/**
 * A matéria original de uma notícia que veio de REDE SOCIAL — o `PostCard` da
 * seção `instanooria` (ADR-117: a peça fala na voz de onde veio, porque um post
 * que não parece post não ensina a reconhecer post). Este arquivo importa SÓ a
 * ponte `@edu/ui/ds-insta`: a peça é do clone, a moldura em volta é da redação.
 *
 * **A peça, e só ela.** Nada da barra, das abas nem do fundo do app. E também
 * nada do que o PDF §1 tira da redação: sem `Actions` (curtir, comentar,
 * compartilhar), sem `Likes` — a contagem de curtidas viraria pista falsa de
 * confiabilidade —, e sem `Timestamp`: a DATA é uma pista que a criança revela à
 * parte, e o carimbo do post a entregaria antes da hora.
 *
 * `theme="light"` fixa o tema no próprio cartão (`data-insta-theme`): a folha
 * da seção troca os tokens do `:root` para o escuro quando o sistema está em
 * modo escuro, e a redação em volta é clara.
 */
export function PostDeRedeSocial({ noticia, aoFalharMidia }: { noticia: NoticiaPublica; aoFalharMidia: () => void }) {
  const url = noticia.imagem?.url ?? undefined;
  return (
    <div className="peca-instanooria">
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
