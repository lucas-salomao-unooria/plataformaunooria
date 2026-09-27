import { useMemo, useRef, useState, type ReactNode } from "react";
import { Button, Modal, NewsCard, NewspaperPage, ScrollBar, Tabs } from "@edu/ui/ds";
import { MEIO_PARA_MEDIUM } from "../../lib/meios";
import { adicionar, esvaziar, preenchidas, retirar, type Vagas } from "../../lib/regras";
import { E2, E3, EREV, REDACAO } from "../../lib/textos";
import type { Diagramacao, IdDeNoticia, NoticiaPublica, TipoDePista } from "../../lib/tipos";
import { Gaveta } from "./gaveta";
import { vagasDaPagina } from "./pagina";

type Aba = "pautas" | "capa";

/**
 * A mesa da redação em duas abas — "Pautas da Semana" (os oito `NewsCard`) e
 * "Primeira Página 0/3" (a `NewspaperPage` com as vagas) — e a gaveta de cada
 * notícia. É a MESMA mesa nas duas edições: na 1ª (E2/E3) e na revisão (EREV),
 * onde a página já vem com as três da 1ª edição e o marcador que a Chave pôs em
 * cada vaga.
 *
 * **Adicionar é o caminho principal, sem arrastar** (PDF §4 e o RNF de
 * acessibilidade): "Adicionar ao Jornal" põe a notícia na primeira vaga vazia,
 * "Trocar Matéria" esvazia a vaga para a próxima escolha. Arrastar ficou de
 * fora — é atalho opcional, e um gesto que nem todo mundo alcança não pode ser
 * o único jeito.
 *
 * **Publicar pede confirmação, e o modal NÃO tem a pergunta de motivo**
 * (decisão de 2026-09-25): a pergunta vem DEPOIS do latch, na tela de motivo.
 * Perguntar antes se a dupla escolheu pela aparência ou pela checagem
 * anteciparia a descoberta (PDF §4).
 *
 * O Bento fica calado aqui (PRD §5): nenhum balão, nenhum alerta preventivo, e
 * a tela aceita qualquer escolha.
 */
export function MesaDeEdicao({
  edicao,
  cabecalho,
  aviso,
  noticias,
  vagas,
  pistas,
  marcadores,
  diagramacao,
  montando,
  publicando,
  aoMudarVagas,
  aoRevelar,
  abertaDeInicio,
  aoPublicar,
  aoFalharMidia,
}: {
  edicao: 1 | 2;
  cabecalho: ReactNode;
  /** A faixa sob o cabeçalho (na revisão, o aviso da Chave). */
  aviso?: ReactNode;
  noticias: readonly NoticiaPublica[];
  vagas: Vagas;
  pistas: ReadonlyMap<string, string>;
  /** Só na revisão: notícia da 1ª edição → o pilar que falta (`null` = verificada). */
  marcadores?: ReadonlyMap<IdDeNoticia, TipoDePista | null>;
  diagramacao: Diagramacao | null;
  montando: boolean;
  publicando: boolean;
  aoMudarVagas: (vagas: Vagas) => void;
  aoRevelar: (noticiaId: IdDeNoticia, tipo: TipoDePista) => Promise<boolean>;
  abertaDeInicio: (noticiaId: IdDeNoticia, tipo: TipoDePista) => boolean;
  aoPublicar: () => void;
  aoFalharMidia: () => void;
}) {
  const [aba, setAba] = useState<Aba>("pautas");
  const [aberta, setAberta] = useState<IdDeNoticia | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  /* O cartão que abriu a gaveta recebe o foco de volta ao fechar. */
  const cartoes = useRef(new Map<IdDeNoticia, HTMLButtonElement>());
  const alvoDoFoco = useRef<HTMLElement | null>(null);

  const porId = useMemo(() => new Map(noticias.map((n) => [n.id, n])), [noticias]);
  const noticiaAberta = aberta ? (porId.get(aberta) ?? null) : null;
  const naPagina = preenchidas(vagas);
  const cheia = naPagina === vagas.length;
  const podePublicar = cheia && diagramacao !== null && !publicando;
  const rotuloPublicar = edicao === 1 ? E3.publicar1 : EREV.publicar2;
  const textoIncompleto = edicao === 1 ? E3.slotsIncompletos : EREV.incompleta;

  function abrir(id: IdDeNoticia) {
    alvoDoFoco.current = cartoes.current.get(id) ?? null;
    setAberta(id);
  }

  function adicionarAberta() {
    if (!aberta) return;
    const { vagas: novas, resultado } = adicionar(vagas, aberta);
    if (resultado !== "adicionada") return;
    aoMudarVagas(novas);
    setAberta(null);
  }

  function trocarAberta() {
    if (!aberta) return;
    aoMudarVagas(retirar(vagas, aberta));
    setAberta(null);
  }

  const pautas = (
    <ul className="mesa__pautas" aria-label={E2.abaPautas}>
      {noticias.map((n) => {
        const url = n.imagem?.url ?? undefined;
        return (
          <li key={n.id}>
            <NewsCard
              ref={(el) => {
                if (el) cartoes.current.set(n.id, el);
                else cartoes.current.delete(n.id);
              }}
              medium={MEIO_PARA_MEDIUM[n.meio]}
              headline={n.manchete}
              summary={n.resumo}
              imageSrc={url}
              imageAlt={url ? n.imagem?.alt : undefined}
              onFrontPage={vagas.includes(n.id)}
              onClick={() => abrir(n.id)}
            />
          </li>
        );
      })}
    </ul>
  );

  const capa = (
    <div className="mesa__capa">
      <NewspaperPage
        nameplate={REDACAO.nome}
        edition={EREV.edicao(edicao)}
        slots={vagasDaPagina(vagas, porId, marcadores)}
        layout={diagramacao?.layout ?? "classic"}
        emptyLabels={E2.vagasVazias}
        headingLevel={3}
        aria-busy={montando || undefined}
        renderSlotAction={(indice, vaga) =>
          vaga ? (
            <Button
              variant="outline"
              size="lg"
              fullWidth
              className="acao-crianca"
              onClick={() => {
                aoMudarVagas(esvaziar(vagas, indice));
                setAba("pautas");
              }}
            >
              {E3.trocar}
            </Button>
          ) : null
        }
      />

      <p className="mesa__status" role="status">
        {montando ? E3.montando : cheia ? "" : textoIncompleto}
      </p>

      <Button
        size="lg"
        fullWidth
        className="acao-crianca"
        disabled={!podePublicar}
        onClick={() => setConfirmando(true)}
      >
        {rotuloPublicar}
      </Button>
    </div>
  );

  return (
    <div className="tela">
      {cabecalho}
      {aviso}
      <Tabs
        className="mesa__abas"
        value={aba}
        onChange={(v) => setAba(v === "capa" ? "capa" : "pautas")}
        size="lg"
        fullWidth
      >
        <Tabs.List fullWidth>
          <Tabs.Tab value="pautas" label={E2.abaPautas} icon="newspaper" />
          <Tabs.Tab value="capa" label={E2.abaCapa} icon="dashboard" badge={E2.contagem(naPagina, vagas.length)} />
        </Tabs.List>
        <Tabs.Panel value="pautas" className="mesa__painel">
          <ScrollBar className="rolagem" autoHide>
            {pautas}
          </ScrollBar>
        </Tabs.Panel>
        <Tabs.Panel value="capa" className="mesa__painel">
          <ScrollBar className="rolagem" autoHide>
            {capa}
          </ScrollBar>
        </Tabs.Panel>
      </Tabs>

      <Gaveta
        noticia={noticiaAberta}
        naCapa={aberta !== null && vagas.includes(aberta)}
        capaCheia={cheia}
        pistas={pistas}
        finalFocusRef={alvoDoFoco}
        aoFechar={() => setAberta(null)}
        aoAdicionar={adicionarAberta}
        aoTrocar={trocarAberta}
        aoRevelar={(tipo) => (aberta ? aoRevelar(aberta, tipo) : Promise.resolve(false))}
        abertaDeInicio={(tipo) => (aberta ? abertaDeInicio(aberta, tipo) : false)}
        aoFalharMidia={aoFalharMidia}
      />

      <Modal
        isOpen={confirmando}
        onClose={() => {
          if (!publicando) setConfirmando(false);
        }}
        size="sm"
        title={E3.modalTitulo}
        description={E3.modalDescricao(edicao)}
        closeOnOverlayClick={!publicando}
        closeOnEsc={!publicando}
        showCloseButton={false}
        primaryAction={
          <Button
            size="lg"
            fullWidth
            className="acao-crianca"
            isLoading={publicando}
            onClick={() => {
              aoPublicar();
            }}
          >
            {E3.distribuir}
          </Button>
        }
        secondaryAction={
          <Button
            variant="outline"
            size="lg"
            fullWidth
            className="acao-crianca"
            disabled={publicando}
            onClick={() => setConfirmando(false)}
          >
            {E3.revisarMais}
          </Button>
        }
      />
    </div>
  );
}
