import { ChatListItem, TabBar, TopBar } from "@edu/ui/ds-unoochat";
import { TEXTOS } from "../lib/textos";
import type { Sessao } from "../lib/tipos";
import { BarraDoAparelho, useHoraDeAgora } from "./Pecas";

/**
 * E1-ALU-01 — a lista de conversas do Unoochat: o Assistente de Dados (com a
 * mensagem não lida enquanto há o que ler) e o grupo público da cidade com o
 * recorte do professor (TC-02). Sem pacote no ar, a lista fica vazia com a
 * espera ("Aguarde a liberação da atividade da sala.").
 *
 * É também para onde a seta de voltar leva — a navegação é a do app.
 */
export function Conversas({
  sessao,
  aoAbrirAssistente,
  aoAbrirGrupo,
}: {
  sessao: Sessao;
  aoAbrirAssistente: () => void;
  aoAbrirGrupo: () => void;
}) {
  const agora = useHoraDeAgora();
  const { conteudo, textos, passo, publicacoes } = sessao;
  const assistenteNaoLido = passo === "abertura" || passo === "errata";
  const previaDoAssistente = passo === "errata" ? TEXTOS.lista.novaDoAssistente : textos.chat.previaDoBot;

  return (
    <div className="app">
      <BarraDoAparelho />
      <TopBar title={TEXTOS.lista.app} variant="home" />
      <div className="app__corpo">
        {!sessao.preparada || !conteudo ? (
          <p className="lista__vazia" role="status">
            {TEXTOS.lista.espera}
          </p>
        ) : (
          <>
            <ChatListItem
              name={textos.chat.bot}
              initials="AD"
              preview={previaDoAssistente}
              time={agora}
              unread={assistenteNaoLido ? 1 : undefined}
              onClick={aoAbrirAssistente}
              divider
            />
            <ChatListItem
              name={conteudo.grupo.nome}
              initials="CM"
              preview={textos.chat.statusDoGrupo}
              time={publicacoes.inicial ? agora : TEXTOS.lista.ontem}
              onClick={aoAbrirGrupo}
            />
          </>
        )}
      </div>
      <TabBar
        items={[
          { id: "conversas", label: TEXTOS.lista.abas.conversas },
          { id: "arquivados", label: TEXTOS.lista.abas.arquivados },
        ]}
        activeId="conversas"
      />
    </div>
  );
}
