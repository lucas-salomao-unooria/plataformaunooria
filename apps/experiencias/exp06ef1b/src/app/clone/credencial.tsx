import { BadgeUnv, ButtonUnv, IconUnv, PostCard, TopBar } from "@edu/ui/ds-unoovista";
import { iniciais } from "../../lib/regras";
import { CONTAS, E1, E2 } from "../../lib/textos";
import type { Categoria } from "../../lib/tipos";

/**
 * O CRACHÁ de jurado — a peça que a comissão entrega, montada como uma
 * publicação da própria comissão (`PostCard` do Unoovista): o cabeçalho é a
 * conta oficial (`@comissao.mostra`, com o selo), a mídia é o crachá impresso
 * (o slide sem fotografia que o DS publica para isto) e a legenda é o mandato.
 *
 * É a tela de abertura da missão, e é do CLONE: quem fala é a comissão, e o
 * disfarce começa aqui (o 403 de missão fechada, antes dela, é da escola).
 * O mesmo crachá volta homologado no fim (`fim.tsx`).
 */
export function Cracha({
  tema,
  categorias,
  homologado = false,
}: {
  tema: string;
  categorias: readonly Categoria[];
  homologado?: boolean;
}) {
  return (
    <PostCard className="cracha">
      <PostCard.Header username={CONTAS.comissao} initials={iniciais(CONTAS.comissao)} verified location={E1.orgao} />
      <PostCard.Media aspectRatio={4 / 5}>
        <div className="cracha__corpo">
          <IconUnv name={homologado ? "check" : "verified"} size={44} tone="link" />
          <p className="cracha__titulo">{E1.titulo}</p>
          <p className="cracha__funcao">{E1.funcao}</p>
          <p className="cracha__tema">{E1.tema(tema)}</p>
          <p className="cracha__rotulo">{E1.areas}</p>
          <div className="cracha__areas">
            {categorias.map((c) => (
              <BadgeUnv key={c.area} variant="neutral" wrap>
                {c.nome}
              </BadgeUnv>
            ))}
          </div>
        </div>
      </PostCard.Media>
    </PostCard>
  );
}

export function Credencial({
  tema,
  categorias,
  ocupado,
  aoAcessar,
}: {
  tema: string;
  categorias: readonly Categoria[];
  ocupado: boolean;
  aoAcessar: () => void;
}) {
  return (
    <div className="tela">
      <h1 className="so-leitor">{E1.titulo}</h1>
      <TopBar title={E2.topo} withStatusBarInset={false} />
      <div className="rolagem rolagem--sem-barra">
        <Cracha tema={tema} categorias={categorias} />
        <p className="cracha__mandato">{E1.missao}</p>
      </div>
      <div className="doca">
        <ButtonUnv variant="primary" size="lg" block disabled={ocupado} onClick={aoAcessar}>
          {E1.acessar}
        </ButtonUnv>
      </div>
    </div>
  );
}
