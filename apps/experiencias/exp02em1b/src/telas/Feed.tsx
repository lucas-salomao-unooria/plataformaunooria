import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  AvatarUnv,
  BadgeUnv,
  BottomSheetUnv,
  ButtonUnv,
  Chip,
  ConfirmDialog,
  IconUnv,
  InlineHint,
  ListItem,
  PostCard,
  SnackbarUnv,
  TopBar,
} from "@edu/ui/ds-unoovista";
import type { Executar } from "../App";
import { api } from "../lib/api";
import { bannerDoAviso, confirmacaoDoRelato, iniciais, partirOpcao, proximaOpcao } from "../lib/regras";
import { telemetria } from "../lib/telemetria";
import { TEXTOS } from "../lib/textos";
import type { AcaoDeSeguranca, DestinoDoRelato, Estado, MotivoDoAviso } from "../lib/tipos";

type Folha = "aviso" | "configuracao" | "central" | null;
type VistaDaCentral = "menu" | "relato" | "encaminhado";

const MOTIVOS: MotivoDoAviso[] = ["saude_usuarios", "fonte_duvidosa", "ofensivo"];
const DESTINOS: DestinoDoRelato[] = ["escola", "unoovista"];

/** O tipo do EVT-004 (o PRD escreve `denuncia_perfil`; o resto é o nome da ação da api). */
const TIPO_DA_ACAO: Record<AcaoDeSeguranca["acao"], string> = {
  conta_privada: "conta_privada",
  restringir_comentarios: "restringir_comentarios",
  abrir_central: "abrir_central",
  denunciar_perfil: "denuncia_perfil",
  encaminhar_apoio: "encaminhar_apoio",
};

/**
 * Um grupo de rádio feito de linhas `ListItem` do DS. LACUNA DO DS: a seção
 * não publica rádio; a linha da lista é o que o app imitado usa para escolher,
 * e a escolhida leva o glifo `check` (a seção também não tem o círculo vazio
 * do rádio — o estado vai no `aria-checked` e no glifo, nunca só na cor). As setas
 * movem E selecionam (WAI-ARIA); só a escolhida (ou a primeira) entra no Tab.
 */
function GrupoDeRadio<T extends string>({
  rotuloId,
  opcoes,
  valor,
  onEscolher,
}: {
  rotuloId: string;
  opcoes: { id: T; titulo: ReactNode; detalhe?: ReactNode; leading?: ReactNode; nome: string }[];
  valor: T | null;
  onEscolher: (id: T) => void;
}) {
  const linhas = useRef<(HTMLElement | null)[]>([]);
  function setas(e: KeyboardEvent<HTMLDivElement>) {
    const atual = opcoes.findIndex((o) => o.id === valor);
    const proxima = proximaOpcao(atual, e.key, opcoes.length);
    if (proxima === null) return;
    e.preventDefault();
    onEscolher(opcoes[proxima]!.id);
    linhas.current[proxima]?.focus();
  }
  return (
    <div role="radiogroup" aria-labelledby={rotuloId} className="unv-radios" onKeyDown={setas}>
      {opcoes.map((o, i) => {
        const escolhida = valor === o.id;
        return (
          <ListItem
            key={o.id}
            ref={(el: HTMLElement | null) => {
              linhas.current[i] = el;
            }}
            role="radio"
            aria-checked={escolhida}
            aria-label={o.nome}
            tabIndex={escolhida || (valor === null && i === 0) ? 0 : -1}
            className="unv-item-longo"
            leading={o.leading}
            title={o.titulo}
            subtitle={o.detalhe}
            trailing={escolhida ? <IconUnv name="check" tone="link" /> : undefined}
            onClick={() => onEscolher(o.id)}
          />
        );
      })}
    </div>
  );
}

/**
 * A chave liga/desliga da Configuração da Publicação. LACUNA DO DS: a seção
 * `unoovista` não publica Switch/Toggle (o `Toggle` da `unooriaai` é de outra
 * seção e não entra no feed). A composição usa o `Chip` do DS — o único
 * controle da seção com estado selecionado — com `role="switch"`; a linha do
 * `ListItem` dá o nome. Morre quando o pacote publicar o Switch.
 */
function Chave({ rotuloId, ligado, onAlternar }: { rotuloId: string; ligado: boolean; onAlternar: () => void }) {
  return (
    <Chip
      role="switch"
      aria-checked={ligado}
      aria-labelledby={rotuloId}
      selected={ligado}
      leadingIcon={<IconUnv name={ligado ? "check" : "close"} size="sm" tone="inherit" />}
      onClick={onAlternar}
    >
      {ligado ? TEXTOS.configuracao.ligado : TEXTOS.configuracao.desligado}
    </Chip>
  );
}

/**
 * A ETAPA 4 — o feed da madrugada (seção `unoovista`, tema ESCURO no contêiner:
 * são 02h30). E4-ALU-01 (o feed), E4-ALU-02 (o aviso de cuidado), E4-ALU-04 (a
 * Configuração da Publicação) e E4-ALU-03 (a Central de Apoio, em quatro
 * estados). A instrução do moderador (TC-10) é do HUB, fora do aparelho.
 *
 * O post saiu com a frase que o algoritmo PINÇOU em destaque, e a crise chega
 * pelos comentários. Nada aqui diz qual gesto mede o quê: a tela manda o
 * gesto e desenha o eco que a api devolver. Sem abas, sem apagar post, sem DM.
 */
export function Feed({ estado, semRede, executar }: { estado: Estado; semRede: boolean; executar: Executar }) {
  const [folha, setFolha] = useState<Folha>(null);
  const [central, setCentral] = useState<VistaDaCentral>("menu");
  const [confirmando, setConfirmando] = useState(false);
  const [eco, setEco] = useState<string | null>(null);
  const [motivo, setMotivo] = useState<MotivoDoAviso | null>(null);
  const [relato, setRelato] = useState<string | null>(null);
  const [destino, setDestino] = useState<DestinoDoRelato | null>(null);
  const [encaminhado, setEncaminhado] = useState<DestinoDoRelato | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const feed = estado.feed;
  const pub = estado.publicacao;
  if (!feed || !pub) return null;

  async function proteger(acao: AcaoDeSeguranca) {
    telemetria.seguranca(TIPO_DA_ACAO[acao.acao]);
    return executar(() => api.seguranca(acao));
  }

  function abrirCentral() {
    setCentral("menu");
    setFolha("central");
    void proteger({ acao: "abrir_central" });
  }

  async function fixarAviso() {
    if (!motivo || ocupado) return;
    setOcupado(true);
    telemetria.aviso(motivo);
    const novo = await executar(() => api.avisoDeCuidado(motivo));
    setOcupado(false);
    if (novo) setFolha(null);
  }

  async function denunciar() {
    setOcupado(true);
    const novo = await proteger({ acao: "denunciar_perfil" });
    setOcupado(false);
    setConfirmando(false);
    if (novo) setEco(TEXTOS.central.denunciado);
    setCentral("menu");
    setFolha("central");
  }

  async function encaminhar() {
    if (!relato || !destino || ocupado) return;
    setOcupado(true);
    const novo = await proteger({ acao: "encaminhar_apoio", comentarioId: relato, destino });
    setOcupado(false);
    if (!novo) return;
    setEncaminhado(destino);
    setRelato(null);
    setDestino(null);
    setCentral("encaminhado");
  }

  const suspeito = feed.perfilSuspeito;

  return (
    <main className="unv-tela unv-tela--feed" data-unv-theme="dark">
      <TopBar
        variant="feed"
        title="Unoovista"
        trailing={
          <BadgeUnv variant="neutral" className="unv-hora">
            {TEXTOS.feed.hora}
          </BadgeUnv>
        }
      />
      {semRede && (
        <InlineHint tone="friction" role="alert">
          {TEXTOS.feed.conexao}
        </InlineHint>
      )}
      <div className="unv-rolagem">
        {feed.aviso && (
          <InlineHint announce className="unv-aviso-fixado">
            {bannerDoAviso(feed.aviso)}
          </InlineHint>
        )}

        <PostCard>
          <PostCard.Header username={TEXTOS.feed.autor} initials="GE" verified />
          <PostCard.Media aspectRatio={4 / 3} alt={TEXTOS.feed.destaque}>
            <div className="unv-recorte">
              <span className="unv-recorte__selo">{TEXTOS.feed.destaque}</span>
              <p className="unv-recorte__frase">“{pub.trechoPincado}”</p>
            </div>
          </PostCard.Media>
          <PostCard.Caption>
            <strong>{pub.manchete.texto}</strong>
          </PostCard.Caption>
          <div className="unv-post__extras">
            <BadgeUnv variant="counter" wrap>
              {feed.metrica}
            </BadgeUnv>
            <InlineHint tone="friction">{TEXTOS.feed.metadados}</InlineHint>
            <div className="unv-post__acoes">
              {!feed.aviso && (
                <ButtonUnv
                  onClick={() => {
                    setMotivo(null);
                    setFolha("aviso");
                  }}
                >
                  {TEXTOS.feed.fixarAviso}
                </ButtonUnv>
              )}
              <ButtonUnv variant="secondary" onClick={() => setFolha("configuracao")}>
                {TEXTOS.feed.configuracao}
              </ButtonUnv>
            </div>
          </div>
        </PostCard>

        <section aria-labelledby="comentarios-titulo" className="unv-comentarios">
          <h2 id="comentarios-titulo" className="unv-comentarios__titulo">
            {TEXTOS.feed.comentarios}
          </h2>
          {feed.comentarios.map((c) => (
            <ListItem
              key={c.id}
              className="unv-item-longo"
              leading={<AvatarUnv initials={iniciais(c.autor)} size="md" />}
              title={c.autor}
              subtitle={c.texto}
              trailing={<span className="unv-comentario__hora">{c.horario}</span>}
            />
          ))}
        </section>
      </div>

      <div className="unv-barra-inferior">
        <ButtonUnv variant="secondary" block leadingIcon={<IconUnv name="info" size="sm" tone="inherit" />} onClick={abrirCentral}>
          {TEXTOS.feed.central}
        </ButtonUnv>
      </div>

      {/* E4-ALU-02 — o motivo do aviso de cuidado. */}
      <BottomSheetUnv open={folha === "aviso"} onOpenChange={(a) => !a && setFolha(null)} title={TEXTOS.aviso.titulo}>
        <div className="unv-folha">
          <p id="aviso-instrucao" className="unv-folha__texto">
            {TEXTOS.aviso.instrucao}
          </p>
          <GrupoDeRadio
            rotuloId="aviso-instrucao"
            valor={motivo}
            onEscolher={setMotivo}
            opcoes={MOTIVOS.map((m) => ({
              id: m,
              nome: TEXTOS.aviso.motivos[m].rotulo,
              titulo: TEXTOS.aviso.motivos[m].rotulo,
              detalhe: TEXTOS.aviso.motivos[m].detalhe,
            }))}
          />
          <ButtonUnv size="lg" block disabled={!motivo || ocupado} onClick={() => void fixarAviso()}>
            {TEXTOS.aviso.fixar}
          </ButtonUnv>
        </div>
      </BottomSheetUnv>

      {/* E4-ALU-04 — a Configuração da Publicação. */}
      <BottomSheetUnv open={folha === "configuracao"} onOpenChange={(a) => !a && setFolha(null)} title={TEXTOS.configuracao.titulo}>
        <div className="unv-folha">
          <h3 className="unv-folha__bloco">{TEXTOS.configuracao.bloco}</h3>
          <ListItem
            className="unv-item-longo"
            leading={<IconUnv name="lock" />}
            title={<span id="config-privada">{TEXTOS.configuracao.privada}</span>}
            subtitle={TEXTOS.configuracao.privadaDetalhe}
            trailing={
              <Chave
                rotuloId="config-privada"
                ligado={feed.contaPrivada}
                onAlternar={() => void proteger({ acao: "conta_privada", ligado: !feed.contaPrivada })}
              />
            }
          />
          <ListItem
            className="unv-item-longo"
            leading={<IconUnv name="comment" />}
            title={<span id="config-restringir">{TEXTOS.configuracao.restringir}</span>}
            subtitle={TEXTOS.configuracao.restringirDetalhe}
            trailing={
              <Chave
                rotuloId="config-restringir"
                ligado={feed.restringirComentarios}
                onAlternar={() => void proteger({ acao: "restringir_comentarios", ligado: !feed.restringirComentarios })}
              />
            }
          />
          <ButtonUnv variant="secondary" block onClick={() => setFolha(null)}>
            {TEXTOS.configuracao.fechar}
          </ButtonUnv>
        </div>
      </BottomSheetUnv>

      {/* E4-ALU-03 — a Central de Apoio: menu, relato e relato encaminhado. */}
      <BottomSheetUnv open={folha === "central"} onOpenChange={(a) => !a && setFolha(null)} title={TEXTOS.central.titulo}>
        {central === "menu" && (
          <div className="unv-folha">
            {suspeito && (
              <>
                <h3 className="unv-folha__bloco">{TEXTOS.central.blocoDenuncia}</h3>
                <ListItem
                  className="unv-item-longo"
                  leading={<IconUnv name="error" />}
                  title={TEXTOS.central.denunciar}
                  subtitle={feed.denunciou ? TEXTOS.central.denunciado : TEXTOS.central.denunciaDica}
                  trailing={feed.denunciou ? <IconUnv name="check" tone="link" /> : undefined}
                  onClick={
                    feed.denunciou
                      ? undefined
                      : () => {
                          setFolha(null);
                          setConfirmando(true);
                        }
                  }
                />
              </>
            )}
            <h3 className="unv-folha__bloco">{TEXTOS.central.blocoCentral}</h3>
            <ListItem
              className="unv-item-longo"
              leading={<IconUnv name="share" />}
              title={TEXTOS.central.encaminhar}
              subtitle={TEXTOS.central.subtitulo}
              onClick={() => {
                /* O eco da denúncia some ao abrir o relato: o aviso passageiro cobria a escolha da equipe. */
                setEco(null);
                setCentral("relato");
              }}
            />
            <ButtonUnv variant="secondary" block onClick={() => setFolha(null)}>
              {TEXTOS.central.fechar}
            </ButtonUnv>
          </div>
        )}
        {central === "relato" && (
          <div className="unv-folha">
            <p className="unv-folha__texto">{TEXTOS.central.subtitulo}</p>
            <h3 id="relato-rotulo" className="unv-folha__bloco">
              {TEXTOS.central.relato}
            </h3>
            <GrupoDeRadio
              rotuloId="relato-rotulo"
              valor={relato}
              onEscolher={setRelato}
              opcoes={feed.comentarios.map((c) => ({
                id: c.id,
                nome: `${c.autor}: ${c.texto}`,
                leading: <AvatarUnv initials={iniciais(c.autor)} size="md" />,
                titulo: c.autor,
                detalhe: c.texto,
              }))}
            />
            <h3 id="destino-rotulo" className="unv-folha__bloco">
              {TEXTOS.central.destino}
            </h3>
            <GrupoDeRadio
              rotuloId="destino-rotulo"
              valor={destino}
              onEscolher={setDestino}
              opcoes={DESTINOS.map((d) => {
                const [titulo, detalhe] = partirOpcao(TEXTOS.central.destinos[d]);
                return { id: d, nome: TEXTOS.central.destinos[d], titulo, detalhe };
              })}
            />
            <ButtonUnv size="lg" block disabled={!relato || !destino || ocupado} onClick={() => void encaminhar()}>
              {TEXTOS.central.encaminhar}
            </ButtonUnv>
          </div>
        )}
        {central === "encaminhado" && encaminhado && (
          <div className="unv-folha">
            <InlineHint announce>{confirmacaoDoRelato(encaminhado)}</InlineHint>
            <ButtonUnv variant="secondary" block onClick={() => setFolha(null)}>
              {TEXTOS.central.fechar}
            </ButtonUnv>
          </div>
        )}
      </BottomSheetUnv>

      {/* E4-ALU-03 (b) — a confirmação da denúncia. */}
      <ConfirmDialog
        open={confirmando}
        title={TEXTOS.central.denunciaTitulo}
        message={
          <>
            {TEXTOS.central.denunciaConfirmar}
            {suspeito && (
              <span className="unv-suspeito">
                {suspeito.autor} · {suspeito.horario}
              </span>
            )}
          </>
        }
        confirmLabel={TEXTOS.central.denunciar}
        cancelLabel={TEXTOS.central.cancelar}
        busy={ocupado}
        onConfirm={() => void denunciar()}
        onCancel={() => {
          setConfirmando(false);
          setFolha("central");
        }}
      />

      <SnackbarUnv open={eco !== null} message={eco ?? ""} onClose={() => setEco(null)} duration={3500} />
    </main>
  );
}
