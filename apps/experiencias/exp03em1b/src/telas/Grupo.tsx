import { useEffect, useRef, useState } from "react";
import { hora } from "@edu/sdk";
import {
  AdminOnlyNotice,
  Button,
  ChatHeader,
  ChatWallpaper,
  DateChip,
  EncryptionNotice,
  MessageBubble,
  SystemMessage,
  TypingIndicator,
  type UncSenderTone,
} from "@edu/ui/ds-unoochat";
import { atrasosDoFeed, descricaoDoGrafico, eixoDaEscala, itensDoFeed, type ItemDoFeed } from "../lib/regras";
import { TEXTOS } from "../lib/textos";
import type { SessaoPreparada } from "../lib/tipos";
import { GraficoDoBoletim } from "./GraficoDoBoletim";
import { BarraDoAparelho, ChipDaCota, GuardaDoGrafico, PostDoBoletim } from "./Pecas";

/** Cada morador com a sua cor de remetente (o tom 1 é o acento, fica para a escola rival). */
const TOM_DO_MORADOR: readonly UncSenderTone[] = [2, 3, 4];
const TOM_DA_RIVAL: UncSenderTone = 5;

/**
 * E4-ALU-01 a 03 (e o pós-errata) — o grupo público da cidade. O post do
 * estudante; as reações do RAMO da escala que ele publicou, chegando uma a uma
 * com o "digitando…"; ~10 s depois o post espelho da Escola Estadual Santos
 * Dumont, com a escala OPOSTA e a mesma autenticação; o morador confuso
 * (TC-17) e o Coordenador Silva suspendendo a deliberação.
 *
 * A chegada em sequência só acontece na aba que ACABOU de publicar
 * (`animar`); um F5 desenha tudo de uma vez. A errata entra abaixo do
 * original.
 *
 * A PAUSA aqui não cobre a tela: a rolagem continua livre para o debate, e o
 * rodapé (que já é "só administradores") troca o texto pela faixa da
 * Coordenação. Não há nada clicável no corpo do grupo.
 */
export function Grupo({
  sessao,
  animar,
  pausada,
  aoVoltar,
  acao,
}: {
  sessao: SessaoPreparada;
  animar: boolean;
  pausada: boolean;
  aoVoltar: () => void;
  /** O botão do rodapé, quando o passo pede um (decisão 7; depois da errata). */
  acao: { rotulo: string; aoTocar: () => void } | null;
}) {
  const { conteudo, feed, textos } = sessao;
  const itens = itensDoFeed(sessao);
  const chegando = itens.filter((i) => i.tipo !== "post" || i.errata).length;
  const fixos = itens.length - chegando;
  const [chegados, setChegados] = useState(animar ? 0 : chegando);
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!feed || chegados >= chegando) return;
    const atrasos = atrasosDoFeed(feed.reacoes.length);
    const id = window.setTimeout(() => setChegados((n) => n + 1), atrasos[chegados] ?? 0);
    return () => window.clearTimeout(id);
  }, [chegados, chegando, feed]);

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [chegados, itens.length]);

  if (!feed) return null;
  const visiveis = itens.slice(0, fixos + chegados);
  const proximo = chegados < chegando ? (itens[fixos + chegados] ?? null) : null;
  const sequenciaAcabou = chegados >= chegando;
  const horaDoPost = sessao.publicacoes.inicial ? hora(sessao.publicacoes.inicial.publicadaEm) : undefined;
  const serie = conteudo.servico.serie;
  const barras = serie.map((p) => ({ rotulo: p.periodo, valor: p.valor }));

  const desenhar = (item: ItemDoFeed) => {
    switch (item.tipo) {
      case "post":
        return (
          <PostDoBoletim
            key={item.errata ? "errata" : "inicial"}
            publicacao={item.publicacao}
            serie={serie}
            indicador={conteudo.servico.indicador}
            camadas={conteudo.camadas}
            errata={item.errata}
            time={hora(item.publicacao.publicadaEm)}
            delivery="read"
          />
        );
      case "reacao": {
        const r = feed.reacoes[item.indice]!;
        return (
          <MessageBubble key={`r${item.indice}`} direction="in" sender={r.autor} senderTone={TOM_DO_MORADOR[item.indice % 3]} time={horaDoPost}>
            {r.texto}
          </MessageBubble>
        );
      }
      case "rival": {
        const eixo = eixoDaEscala(feed.rival.escala);
        return (
          <div className="rival" key="rival" data-post="rival" data-escala={feed.rival.escala}>
            <MessageBubble direction="in" sender={feed.rival.escola} senderTone={TOM_DA_RIVAL} time={horaDoPost} maxWidth={300}>
              <p className="post__titulo">{TEXTOS.grupo.boletim}</p>
              <p className="post__indicador">{conteudo.servico.indicador}</p>
              <MessageBubble.Media alt={descricaoDoGrafico(barras, eixo.origem, eixo.teto, "%")} ratio="auto">
                <GuardaDoGrafico>
                  <GraficoDoBoletim barras={barras} {...eixo} />
                </GuardaDoGrafico>
              </MessageBubble.Media>
            </MessageBubble>
            <EncryptionNotice>{feed.rival.chip}</EncryptionNotice>
          </div>
        );
      }
      case "conflito":
        return (
          <MessageBubble key="conflito" direction="in" sender={feed.conflito.autor} senderTone={TOM_DO_MORADOR[0]} time={horaDoPost}>
            {feed.conflito.texto}
          </MessageBubble>
        );
      case "coordenador":
        return (
          <SystemMessage key="coordenador" data-mensagem="coordenador">
            <strong>{feed.coordenador.autor}</strong>: {feed.coordenador.texto}
          </SystemMessage>
        );
    }
  };

  const quemDigita = (item: ItemDoFeed | null): string | null => {
    if (!item) return null;
    if (item.tipo === "reacao") return feed.reacoes[item.indice]!.autor;
    if (item.tipo === "rival") return feed.rival.escola;
    if (item.tipo === "conflito") return feed.conflito.autor;
    return null;
  };
  const digitando = quemDigita(proximo);

  return (
    <div className="app">
      <BarraDoAparelho />
      <ChatHeader
        name={conteudo.grupo.nome}
        initials="CM"
        presence={TEXTOS.grupo.presenca}
        onBack={aoVoltar}
        trailing={<ChipDaCota restantes={sessao.slotsRestantes} />}
      />
      <ChatWallpaper className="app__corpo" role="region" tabIndex={0} aria-label={TEXTOS.grupo.conversa}>
        <div className="conversa" aria-live="polite">
          <DateChip>{TEXTOS.grupo.hoje}</DateChip>
          {visiveis.map(desenhar)}
          {digitando && <TypingIndicator sender={digitando} aria-label={TEXTOS.grupo.digitando(digitando)} />}
          <div ref={fim} />
        </div>
      </ChatWallpaper>
      <div className="rodape">
        {acao && sequenciaAcabou && !pausada && (
          <div className="rodape__acao">
            <Button size="lg" block onClick={acao.aoTocar}>
              {acao.rotulo}
            </Button>
          </div>
        )}
        <AdminOnlyNotice role={pausada ? "status" : undefined} data-pausa={pausada || undefined}>
          {pausada ? `${textos.chat.pausa} ${TEXTOS.grupo.aguardeOrientacoes}` : textos.chat.statusDoGrupo}
        </AdminOnlyNotice>
      </div>
    </div>
  );
}
