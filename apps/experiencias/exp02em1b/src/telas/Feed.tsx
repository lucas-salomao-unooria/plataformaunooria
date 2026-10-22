import { useState } from "react";
import {
  AvatarUnv,
  BottomSheetUnv,
  ButtonUnv,
  IconUnv,
  InlineHint,
  ListItem,
  PostCard,
  SnackbarUnv,
  TabBar,
  TopBar,
} from "@edu/ui/ds-unoovista";
import type { Executar } from "../App";
import { api } from "../lib/api";
import { telemetria } from "../lib/telemetria";
import { TEXTOS } from "../lib/textos";
import type { AcaoNoFeed, Estado } from "../lib/tipos";
import { GraficoDeEntrega } from "./GraficoDeEntrega";

type Menu = { tipo: "post" } | { tipo: "comentario"; id: string } | { tipo: "metricas" } | null;

const ABAS = [
  { id: "inicio", label: TEXTOS.feed.abas.inicio, icon: "home" as const },
  { id: "buscar", label: TEXTOS.feed.abas.buscar, icon: "search" as const },
  { id: "publicar", label: TEXTOS.feed.abas.publicar, icon: "add" as const },
  { id: "atividade", label: TEXTOS.feed.abas.atividade, icon: "activity" as const, hasNotification: true },
  { id: "perfil", label: TEXTOS.feed.abas.perfil, icon: "settings" as const },
];

const iniciais = (nome: string) =>
  nome
    .split(/\s+/)
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

/**
 * O FEED DA MADRUGADA (Etapa 4, seção `unoovista`, tema escuro: são 02h30).
 *
 * O post saiu com a frase que o algoritmo PINÇOU em destaque — sempre há uma,
 * escolhida no servidor — e a crise chega pelos comentários. As ferramentas
 * ficam nos TRÊS PONTOS, sem aviso que obrigue o clique (a voluntariedade é a
 * evidência da EM13CO08): no post, moderar, privacidade e a Central de Apoio;
 * no comentário, denunciar. Abrir um comentário é o gesto que a EM13CO24 lê.
 * O que cada gesto mediu, só a api sabe: a tela manda o gesto e desenha o eco.
 */
export function Feed({ estado, executar }: { estado: Estado; executar: Executar }) {
  const [menu, setMenu] = useState<Menu>(null);
  const [eco, setEco] = useState<string | null>(null);
  const feed = estado.feed;
  const pub = estado.publicacao;
  if (!feed || !pub) return null;

  async function agir(acao: AcaoNoFeed, frase?: string) {
    telemetria.feed(acao.acao === "moderar" ? `moderar:${acao.moderacao}` : acao.acao);
    const novo = await executar(() => api.feed(acao));
    if (novo && frase) setEco(frase);
  }

  const restrito = feed.moderacoes.includes("restringir");
  const arquivado = feed.moderacoes.includes("arquivar");

  return (
    <main className="unv-tela" data-unv-theme="dark">
      <TopBar
        variant="feed"
        title="Unoovista"
        trailing={<TopBar.Action icon="activity" label={TEXTOS.feed.abas.atividade} hasNotification />}
      />
      <div className="unv-rolagem">
        <InlineHint tone="friction" announce>
          {TEXTOS.feed.alertaMetadados}
        </InlineHint>

        <PostCard>
          <PostCard.Header
            username={TEXTOS.feed.gremio}
            location={TEXTOS.feed.autor}
            initials="GE"
            onMore={() => setMenu({ tipo: "post" })}
            moreLabel={TEXTOS.feed.menuPost}
          />
          <PostCard.Media aspectRatio={1}>
            <div className="unv-recorte">
              <span className="unv-recorte__selo">{TEXTOS.feed.emAlta}</span>
              <p className="unv-recorte__frase">“{pub.trechoPincado}”</p>
            </div>
          </PostCard.Media>
          <PostCard.Actions actions={["like", "comment", "share"]} />
          <PostCard.Caption username={TEXTOS.feed.gremio}>
            <strong>{pub.manchete.texto}</strong> {pub.texto}
          </PostCard.Caption>
          <PostCard.Timestamp>{TEXTOS.relogio[0]}</PostCard.Timestamp>
        </PostCard>

        <div className="unv-acoes-do-post">
          <ButtonUnv
            variant="secondary"
            block
            onClick={() => {
              setMenu({ tipo: "metricas" });
              if (!feed.metricas) void agir({ acao: "metricas" });
            }}
          >
            {TEXTOS.feed.verMetricas}
          </ButtonUnv>
        </div>

        <section aria-label={TEXTOS.feed.comentarios} className="unv-comentarios">
          <h2 className="unv-comentarios__titulo">{TEXTOS.feed.comentarios}</h2>
          {restrito && <p className="unv-comentarios__aviso">{TEXTOS.feed.feitos.restringir}</p>}
          {feed.comentarios.map((c) => {
            const aberto = feed.inspecionados.includes(c.id);
            const denunciado = feed.denuncias.includes(c.id);
            return (
              <ListItem
                key={c.id}
                leading={<AvatarUnv initials={iniciais(c.autor)} size="sm" />}
                title={
                  <span>
                    {c.handle} <span className="unv-comentario__hora">{c.horario}</span>
                  </span>
                }
                subtitle={
                  <span className="unv-comentario">
                    <span className={aberto ? "unv-comentario__texto" : "unv-comentario__texto unv-comentario__texto--curto"}>
                      {c.texto}
                    </span>
                    {/* "ver mais" é o gesto que a EM13CO24 lê. Botão PRÓPRIO, e não o item
                        inteiro: o item já tem o botão dos três pontos, e botão dentro de
                        botão é HTML inválido (a e2e pegou pela hidratação). */}
                    {aberto ? null : (
                      <button
                        type="button"
                        className="unv-ver-mais"
                        aria-label={`${c.handle}: ${TEXTOS.feed.verMais}`}
                        onClick={() => void agir({ acao: "inspecionar", comentarioId: c.id })}
                      >
                        {TEXTOS.feed.verMais}
                      </button>
                    )}
                  </span>
                }
                meta={denunciado ? TEXTOS.feed.feitos.denunciar : undefined}
                trailing={
                  <button type="button" className="unv-tres-pontos" aria-label={TEXTOS.feed.menuComentario} onClick={() => setMenu({ tipo: "comentario", id: c.id })}>
                    <IconUnv name="more" />
                  </button>
                }
              />
            );
          })}
        </section>
      </div>
      <TabBar items={ABAS} activeId="inicio" ariaLabel="Navegação do Unoovista" />

      <BottomSheetUnv open={menu?.tipo === "post"} onOpenChange={(a) => !a && setMenu(null)} title={TEXTOS.feed.menuPost}>
        <ListItem title={TEXTOS.feed.restringir} leading={<IconUnv name="comment" />} onClick={() => void agir({ acao: "moderar", moderacao: "restringir" }, TEXTOS.feed.feitos.restringir).then(() => setMenu(null))} />
        <ListItem title={TEXTOS.feed.aviso} leading={<IconUnv name="warning" />} onClick={() => void agir({ acao: "moderar", moderacao: "aviso" }, TEXTOS.feed.feitos.aviso).then(() => setMenu(null))} />
        <ListItem
          title={TEXTOS.feed.arquivar}
          subtitle={feed.metricas ? undefined : TEXTOS.feed.arquivarBloqueado}
          leading={<IconUnv name="archive" />}
          onClick={feed.metricas && !arquivado ? () => void agir({ acao: "moderar", moderacao: "arquivar" }, TEXTOS.feed.feitos.arquivar).then(() => setMenu(null)) : undefined}
        />
        <ListItem title={TEXTOS.feed.privacidade} leading={<IconUnv name="lock" />} onClick={() => void agir({ acao: "privacidade" }, TEXTOS.feed.feitos.privacidade).then(() => setMenu(null))} />
        <ListItem title={TEXTOS.feed.ajuda} leading={<IconUnv name="info" />} onClick={() => void agir({ acao: "ajuda" }, TEXTOS.feed.feitos.ajuda).then(() => setMenu(null))} />
      </BottomSheetUnv>

      <BottomSheetUnv open={menu?.tipo === "comentario"} onOpenChange={(a) => !a && setMenu(null)} title={TEXTOS.feed.menuComentario}>
        <ListItem
          title={TEXTOS.feed.denunciar}
          leading={<IconUnv name="error" />}
          onClick={() => {
            if (menu?.tipo !== "comentario") return;
            void agir({ acao: "denunciar", comentarioId: menu.id }, TEXTOS.feed.feitos.denunciar).then(() => setMenu(null));
          }}
        />
      </BottomSheetUnv>

      <BottomSheetUnv open={menu?.tipo === "metricas"} onOpenChange={(a) => !a && setMenu(null)} title={TEXTOS.feed.metricasTitulo}>
        <GraficoDeEntrega entrega={feed.entrega} titulo={TEXTOS.feed.entrega} />
      </BottomSheetUnv>

      <SnackbarUnv open={eco !== null} message={eco ?? ""} onClose={() => setEco(null)} duration={3500} />
    </main>
  );
}
