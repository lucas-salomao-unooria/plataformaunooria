import { useState } from "react";
import { Icon, MessageBubble } from "@edu/ui/ds-whatsapp";
import { TEXTOS } from "../../lib/textos";
import type { MensagemPublica } from "../../lib/tipos";
import { BalaoDeVoz } from "./voz";

/**
 * Um balão do grupo, nos quatro formatos da missão.
 *
 * **Zero mídia binária, e isso é decisão de produto, não asset que faltou.** O
 * áudio é transcrição + player simulado; a imagem é a MOLDURA da foto com o
 * rótulo do que ela mostra; o link é o card com manchete, veículo e data. Três
 * razões, e nenhuma é "não deu tempo": um `.mp3` de 18 s por turma multiplicado
 * por lote gerado por IA é conteúdo que ninguém revisa antes da aula; uma foto
 * de aviso escolar é PII de uma escola real; e a missão mede a leitura do TEXTO
 * da mensagem, que é o que a criança tem diante dela no WhatsApp de verdade.
 *
 * `MessageBubble` aceita `children`, e é por ali que as três composições
 * entram. `.Media` do pacote exige `src` de imagem — não serve aqui.
 */
export function BalaoDaMensagem({
  mensagem,
  direcao = "in",
  encaminhada,
  mostrarRemetente = true,
  aoAbrirMidia,
}: {
  mensagem: MensagemPublica;
  /**
   * `in` no grupo (as oito são de outras pessoas) e `out` no Mural, onde quem
   * mandou foi o próprio estudante.
   */
  direcao?: "in" | "out";
  /** Já está no Mural: o selo do app real aparece acima do texto. */
  encaminhada?: boolean;
  /**
   * **No Mural isto é `false`, e a ausência é o título da missão.**
   *
   * O app real não carrega o remetente original numa mensagem encaminhada: o
   * que chega adiante é o texto, sozinho, com a etiqueta "Encaminhada". A
   * autoria some no primeiro repasse — e "quem mandou isso?" deixa de ter
   * resposta. Escrever o nome ali seria inventar um campo que o WhatsApp não
   * tem para consertar o problema que a missão existe para mostrar.
   */
  mostrarRemetente?: boolean;
  aoAbrirMidia?: (tipo: "audio" | "link") => void;
}) {
  return (
    <>
      {encaminhada && (
        <span className="selo-encaminhada">
          {/* `tone="inherit"`, e não o padrão. O `tone` do pacote é `appbar`, e
              ele pinta a classe do ícone com `--wa-color-icon-appbar` (branco)
              POR CIMA da cor herdada: o selo sairia branco dentro de uma linha
              cinza de `--wa-color-text-meta`. A regra desta experiência é
              simples — onde o CSS local manda na cor, o ícone herda; onde a
              superfície é do DS (o `leading` de um `ListItem`), o tom é do DS. */}
          <Icon name="forward" size={12} tone="inherit" />
          {TEXTOS.grupo.encaminhada}
        </span>
      )}
      {mostrarRemetente && <span className="feed__autor">{mensagem.remetente}</span>}
      <MessageBubble direction={direcao} time={mensagem.hora}>
        <ConteudoDoBalao mensagem={mensagem} aoAbrirMidia={aoAbrirMidia} />
      </MessageBubble>
    </>
  );
}

function ConteudoDoBalao({
  mensagem,
  aoAbrirMidia,
}: {
  mensagem: MensagemPublica;
  aoAbrirMidia?: (tipo: "audio" | "link") => void;
}) {
  switch (mensagem.tipo) {
    case "audio":
      return (
        <BalaoDeVoz
          duracaoSeg={mensagem.duracaoSeg ?? 0}
          transcricao={mensagem.corpo}
          aoOuvir={() => aoAbrirMidia?.("audio")}
        />
      );

    case "imagem":
      return <Foto titulo={mensagem.titulo} legenda={mensagem.corpo} />;

    case "link":
      return <CardDeLink mensagem={mensagem} aoAbrir={() => aoAbrirMidia?.("link")} />;

    case "texto":
      return <>{mensagem.corpo}</>;
  }
}

/**
 * (b) COMPENSAÇÃO — a foto do grupo, sem arquivo de foto.
 *
 * O `MessageBubble.Media` do pacote pede `src`, e não há imagem nenhuma nesta
 * missão. A moldura é composta com os tokens `--wa-*` e carrega, escrito, o que
 * a foto mostra — que é a informação que a criança usaria para decidir se
 * encaminha. PEDIDO ao `storybook-unooria`: `MessageBubble.MediaPlaceholder`,
 * com rótulo textual, para as missões que descrevem mídia em vez de servi-la.
 */
function Foto({ titulo, legenda }: { titulo?: string; legenda: string }) {
  return (
    <div className="foto">
      <div className="foto__moldura">
        {/* `tone="inherit"`: a moldura declara `--wa-color-text-primary` e o
            pictograma tem de acompanhá-la — ver a nota do selo, acima. */}
        <Icon name="camera" size={20} tone="inherit" />
        <span className="foto__rotulo">{titulo}</span>
      </div>
      <span className="foto__legenda">{legenda}</span>
    </div>
  );
}

/**
 * (b) COMPENSAÇÃO — o card de pré-visualização de link.
 *
 * A seção não publica o card de link do app real (miniatura, manchete, domínio).
 * PEDIDO: `MessageBubble.LinkPreview`.
 *
 * **A data fica VISÍVEL no card fechado**, junto do veículo. É o detalhe que
 * desmascara a mensagem ambígua — uma notícia real de três anos atrás —, e
 * escondê-la atrás do toque premiaria quem já desconfiava e puniria quem leu
 * rápido. O toque abre o corpo da matéria, e é ele que marca `abriuLink` no
 * painel da professora: indicativo de leitura, nunca mérito.
 */
function CardDeLink({
  mensagem,
  aoAbrir,
}: {
  mensagem: MensagemPublica;
  aoAbrir: () => void;
}) {
  const [aberto, setAberto] = useState(false);

  function alternar() {
    if (!aberto) aoAbrir();
    setAberto((a) => !a);
  }

  return (
    <div className="link">
      <span className="link__manchete">{mensagem.titulo}</span>
      <span className="link__meta">
        {mensagem.fonte}
        {mensagem.data ? ` · ${mensagem.data}` : ""}
      </span>
      {aberto && <span className="link__corpo">{mensagem.corpo}</span>}
      {/* `<button>` dentro de `div[role=button]` é válido (o inválido é
          `<button>` dentro de `<button>`, que derrubou a hidratação da exp-06).
          O `stopPropagation` impede que abrir o link também selecione o balão.

          **O `pointerdown` para junto, e ele faltava.** Só o clique estava
          barrado: o `pointerdown` continuava subindo e armando o toque longo de
          400 ms do balão, então segurar "Abrir matéria" abria a seleção
          sozinho — e deixava a supressão do clique presa, engolindo o toque
          SEGUINTE naquele balão. Dois toques para desmarcar uma mensagem, sem
          nada em tela explicando o primeiro. */}
      <button
        type="button"
        className="link__abrir"
        aria-expanded={aberto}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          alternar();
        }}
      >
        {aberto ? TEXTOS.grupo.fecharMateria : TEXTOS.grupo.abrirMateria}
      </button>
    </div>
  );
}
