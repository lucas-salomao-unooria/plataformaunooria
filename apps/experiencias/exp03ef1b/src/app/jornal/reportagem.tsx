import { ArticleCard, ButtonUjn, EmptyStateUjn, Figure, GalleryImage, ModalUjn, TagUjn } from "@edu/ui/ds-unoojornal";
import type { ReactNode } from "react";
import { E1 } from "../../lib/textos";

/**
 * A reportagem do jornal (E1, E3-02, E4-01, E4-04, E4-05): o `ArticleCard`
 * da seção, com a foto, o kicker do suporte e a manchete. Só
 * `@edu/ui/ds-unoojornal`.
 *
 * O `ArticleCard` não tem lugar para o selo nem para o ícone de lugar, então:
 * - o lugar ("Pátio escolar") vai no texto de rodapé (`readingTime`), e o pin
 *   entra por máscara CSS (`.reportagem__lugar`, compensação marcada);
 * - o selo ("Mesma feira", "Recuperada") é um `TagUjn` POSICIONADO sobre o
 *   canto do rodapé (`.reportagem__selo`) — compensação só de posição.
 *
 * `moldura`: `forte` (fio de 2px, o cartão já carimbado) ou `tracejada` (a
 * notícia que ainda não está na ficha: o telão no E4-05).
 */
export function CartaoDaReportagem({
  imagem,
  alt,
  kicker,
  manchete,
  lugar,
  chamada,
  selo,
  seloForte = false,
  moldura,
  aoAbrir,
}: {
  imagem: string;
  alt: string;
  kicker: string;
  manchete: string;
  lugar?: string;
  chamada?: string;
  selo?: ReactNode;
  seloForte?: boolean;
  moldura?: "forte" | "tracejada";
  aoAbrir?: () => void;
}) {
  const classes = ["reportagem", moldura ? `reportagem--${moldura}` : "", selo ? "reportagem--com-selo" : "", lugar ? "" : "reportagem--sem-lugar"]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classes}>
      <ArticleCard
        imageSrc={imagem}
        imageAlt={alt}
        kicker={kicker}
        title={manchete}
        readingTime={lugar}
        ctaLabel={chamada}
        onOpen={aoAbrir}
        className="reportagem__cartao"
      />
      {selo ? (
        <span className="reportagem__selo">
          <TagUjn variant={seloForte ? "accent" : "neutral"} size="md">
            {selo}
          </TagUjn>
        </span>
      ) : null}
    </div>
  );
}

/**
 * A foto ampliada (E1-ALU-01, modal aberto): o `ModalUjn` com a `Figure` da
 * reportagem e o CARTAZ como `GalleryImage` tocável — tocar no cartaz (ou em
 * "Confirmar Mesma Feira") acende o selo no cartão. Depois de 20 s sem tocar,
 * o cartaz pulsa (`pulsando`; `prefers-reduced-motion` troca a pulsação por um
 * contorno fixo).
 */
export function FotoAmpliada({
  aberta,
  suporte,
  foto,
  alt,
  legenda,
  cartaz,
  cartazAlt,
  cartazTexto,
  pulsando,
  aoConfirmar,
  aoFechar,
}: {
  aberta: boolean;
  suporte: string;
  foto: string;
  alt: string;
  legenda: string;
  cartaz: string;
  cartazAlt: string;
  cartazTexto: string;
  pulsando: boolean;
  aoConfirmar: () => void;
  aoFechar: () => void;
}) {
  return (
    <ModalUjn
      open={aberta}
      onClose={aoFechar}
      title={E1.modalTitulo(suporte)}
      closeLabel={E1.fechar}
      className="foto-ampliada"
      footer={
        <div className="foto-ampliada__rodape">
          <p className="foto-ampliada__apoio">{E1.modalApoio}</p>
          <ButtonUjn variant="primary" size="lg" className="alvo-64" onClick={aoConfirmar}>
            {E1.confirmar}
          </ButtonUjn>
        </div>
      }
    >
      <div className="foto-ampliada__corpo">
        <Figure src={foto} alt={alt} caption={legenda} className="foto-ampliada__foto" />
        <div className={`foto-ampliada__cartaz${pulsando ? " pulsa" : ""}`}>
          <GalleryImage src={cartaz} alt={`${cartazAlt} ${E1.cartazToque}`} caption={cartazTexto} aspectRatio="4:5" onOpen={aoConfirmar} />
        </div>
      </div>
    </ModalUjn>
  );
}

/** E1-SIS-01: a foto não baixou. Na voz do jornal; "Tentar carregar" pede de novo. */
export function ErroDeMidia({ aoTentar }: { aoTentar: () => void }) {
  return (
    <div className="erro-de-midia">
      <EmptyStateUjn
        icon="gallery"
        title={E1.erroMidia}
        description={E1.erroMidiaApoio}
        action={
          <ButtonUjn variant="primary" size="lg" className="alvo-64" onClick={aoTentar}>
            {E1.tentarCarregar}
          </ButtonUjn>
        }
      />
    </div>
  );
}
