import { BadgeUnv, BottomSheetUnv, ButtonUnv, IconUnv, PostCard, TabBar } from "@edu/ui/ds-unoovista";
import { iniciais } from "../../lib/regras";
import { CONTAS, E1 } from "../../lib/textos";
import type { Categoria } from "../../lib/tipos";
import { ABAS } from "./abas";
import { Cabecalho } from "./cabecalho";

/**
 * E1-ALU-01 — o crachá: o modal diegético da comissão SOBRE A TIMELINE
 * DESFOCADA do Unoovista (PRD §6, E1). Atrás, a casca do app (a barra do topo,
 * dois cartões de publicação ainda sem fotografia e a barra de abas), inerte e
 * desfocada — o feed de verdade só é servido no toque em "Acessar Feed da
 * Mostra" (é ele que pede `POST passo {para:"feed"}`).
 *
 * O modal é a `BottomSheetUnv` modal do DS, que não fecha pelo véu nem por
 * ESC: o único caminho é entrar no feed. Na folha: o cabeçalho institucional
 * (o título da folha), o emissor `@comissao_juri`, o crachá `@jurado_oficial`,
 * o mandato e o botão.
 *
 * É a tela de abertura da missão, e é do CLONE: quem fala é a comissão, e o
 * disfarce começa aqui (o 403 de missão fechada, antes dela, é da escola).
 */
export function Credencial({
  categorias,
  ocupado,
  aoAcessar,
}: {
  categorias: readonly Categoria[];
  ocupado: boolean;
  aoAcessar: () => void;
}) {
  return (
    <div className="tela">
      <h1 className="so-leitor">{E1.topo}</h1>
      <div className="timeline-desfocada" aria-hidden="true" inert>
        <Cabecalho />
        <div className="rolagem rolagem--sem-barra feed">
          {categorias.slice(0, 2).map((c) => (
            <PostCard key={c.area} className="post">
              <PostCard.Header username={c.hashtag.replace(/^#/, "")} initials={iniciais(c.nome)} />
              <PostCard.Media alt={E1.timeline}>
                <span />
              </PostCard.Media>
            </PostCard>
          ))}
        </div>
        <TabBar items={ABAS} activeId="inicio" ariaLabel={E1.timeline} withHomeIndicatorInset={false} />
      </div>
      <BottomSheetUnv open modal title={E1.topo} maxHeight="88%" onOpenChange={() => undefined}>
        <div className="cracha">
          <p className="cracha__emissor">
            <IconUnv name="verified" size="sm" tone="link" /> {E1.emissor}
          </p>
          <div className="cracha__selo">
            <IconUnv name="verified" size={44} tone="link" title={CONTAS.comissao} />
            <BadgeUnv variant="neutral" wrap>
              {CONTAS.jurado}
            </BadgeUnv>
          </div>
          <p className="cracha__corpo">{E1.corpo}</p>
          <ButtonUnv
            variant="primary"
            size="lg"
            block
            disabled={ocupado}
            leadingIcon={<IconUnv name="home" size={18} tone="inherit" />}
            onClick={aoAcessar}
          >
            {E1.entrar}
          </ButtonUnv>
        </div>
      </BottomSheetUnv>
    </div>
  );
}
