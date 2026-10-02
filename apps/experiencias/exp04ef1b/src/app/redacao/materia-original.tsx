import { NEWS_MEDIUM_LABELS, NewsArticle } from "@edu/ui/ds";
import { MEIO_PARA_MEDIUM, PECA_DO_MEIO } from "../../lib/meios";
import type { NoticiaPublica } from "../../lib/tipos";
import { MensagemEncaminhada } from "../pecas/mensagem-encaminhada";
import { PostDeRedeSocial } from "../pecas/post-de-rede-social";

/**
 * A matéria no formato ORIGINAL, dentro da gaveta — e o único lugar da missão
 * onde três seções do DS se encontram na mesma tela, cada uma na SUA peça
 * (ADR-117, `PECA_DO_MEIO`):
 *
 * - jornal, rádio, telejornal, blog, portal e mural: o `NewsArticle` da seção
 *   `unooria` (a redação desenha o recorte, o boletim transcrito, o quadro…);
 * - rede social: o `PostCard` do `unoovista` (`pecas/post-de-rede-social.tsx`);
 * - mensagem: o `MessageBubble` do `unoochat` (`pecas/mensagem-encaminhada.tsx`).
 *
 * O `veiculo` vai no cabeçalho da peça (o nome do jornal, a conta do post), e é
 * o que a criança leria no recorte de verdade; o que ele É — canal oficial,
 * perfil anônimo — é a pista de FONTE, que ela revela à parte.
 */
export function MateriaOriginal({ noticia, aoFalharMidia }: { noticia: NoticiaPublica; aoFalharMidia: () => void }) {
  const peca = PECA_DO_MEIO[noticia.meio];

  if (peca.secao === "unoovista") return <PostDeRedeSocial noticia={noticia} aoFalharMidia={aoFalharMidia} />;

  if (peca.secao === "unoochat") {
    const url = noticia.imagem?.url;
    return (
      <MensagemEncaminhada
        remetente={noticia.falante ?? noticia.veiculo}
        texto={noticia.corpo}
        imagem={url && noticia.imagem ? { url, alt: noticia.imagem.alt } : null}
        rotulo={NEWS_MEDIUM_LABELS[MEIO_PARA_MEDIUM[noticia.meio]]}
      />
    );
  }

  const url = noticia.imagem?.url ?? undefined;
  return (
    <NewsArticle
      medium={peca.medium}
      headline={noticia.manchete}
      masthead={noticia.veiculo}
      imageSrc={url}
      imageAlt={url ? noticia.imagem?.alt : undefined}
      caption={noticia.legenda ?? undefined}
      speaker={peca.medium === "radio" ? (noticia.falante ?? undefined) : undefined}
      headingLevel={3}
    >
      {noticia.corpo
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((paragrafo, i) => (
          <p key={i}>{paragrafo}</p>
        ))}
    </NewsArticle>
  );
}
