import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChatHeader,
  ChatWallpaper,
  EncryptionNotice,
  Icon,
  ListItem,
  Menu,
  MessageComposer,
  StatusBar,
  TextButton,
} from "@edu/ui/ds-whatsapp";
import {
  MS_DO_TOQUE_LONGO,
  SEGUNDOS_ATE_O_SCAFFOLDING,
  estaNoMural,
  mensagensEncaminhadas,
  proporcao,
} from "../../lib/regras";
import { TEXTOS } from "../../lib/textos";
import type {
  Estado,
  LotePublico,
  MensagemPublica,
  Sintese,
  Veracidade,
} from "../../lib/tipos";
import { BalaoDaMensagem } from "./balao";
import { MeiaLua, Xis } from "./glifos";

/**
 * As telas de DENTRO do mensageiro — Etapas 2 a 5.
 *
 * Aqui quem fala é o app clonado, e só ele: nenhum token, componente ou palavra
 * da plataforma entra. **O disfarce vale do "Entrar no grupo" até o card de
 * síntese**, inclusive a revelação — diferente da exp-06, onde ele cai no
 * breakpoint. A razão é o que a tela mostra: o Mural revelado é uma LISTA DE
 * MENSAGENS com etiquetas, e um mensageiro real tem etiqueta de checagem (o
 * próprio WhatsApp marca "encaminhada com frequência"). O que a exp-06 recusou
 * foi um visualizador de topologia de rede, que app de mensagem nenhum tem.
 * Da pergunta do tio em diante quem assume é a escola (`telas-da-escola.tsx`).
 */

/**
 * Guarda a ÚLTIMA versão de um callback FORA das dependências do efeito.
 *
 * Um `aoPrecisarDeAjuda={() => telemetria.x()}` escrito no JSX do pai é uma
 * função NOVA a cada render. Posto na lista de dependências, ele reinicia o
 * efeito a cada render — e o `setTimeout` de quatro minutos do balão de inação
 * nunca chega ao fim: o aviso simplesmente não aparece, sem erro em lugar
 * nenhum. Exigir `useCallback` do pai resolveria hoje e quebraria na próxima
 * pessoa que escrevesse a seta no JSX; a trava certa é aqui dentro.
 */
function useUltimo<T extends (...args: never[]) => unknown>(cb: T) {
  const ref = useRef(cb);
  useEffect(() => {
    ref.current = cb;
  });
  return ref;
}

// ──────────────────────────────────────────────────── o toque longo do app

/**
 * Tocar e segurar por 400 ms — o gesto de seleção do app real.
 *
 * Duas coisas que o `onContextMenu` do navegador não dá e que custam caro se
 * faltarem:
 *
 * 1. **Cancelar no movimento, com folga de 10 px.** Sem a folga, o tremor
 *    normal de um dedo de criança cancela toda pressão; sem o cancelamento, a
 *    rolagem do feed vira seleção acidental — e ela encaminha uma mensagem que
 *    não escolheu, para um Mural que o latch não desfaz.
 * 2. **Enter/Espaço no teclado.** O alvo NÃO pode ser um `<button>`: o balão de
 *    voz tem um botão de play dentro, e `<button>` aninhado é HTML inválido —
 *    o React derruba a hidratação e o feed inteiro para de responder ao toque.
 *    Custou uma execução da suíte na exp-06, porque typecheck e lint passam por
 *    cima. `role` + `tabIndex` + as duas teclas dão o mesmo que o `<button>`
 *    daria.
 */
const FOLGA_DO_DEDO_PX = 10;

function usePressaoLonga(aoAtivar: () => void) {
  const timer = useRef<number | null>(null);
  const origem = useRef<{ x: number; y: number } | null>(null);
  /** O clique que o navegador dispara DEPOIS do pointerup não pode desfazer a seleção. */
  const suprimirClique = useRef(false);

  const cancelar = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    origem.current = null;
  }, []);

  useEffect(() => cancelar, [cancelar]);

  const aoPressionar = useCallback(
    (e: React.PointerEvent) => {
      cancelar();
      /* A bandeira do gesto ANTERIOR morre aqui, e não só no clique que a
         consome. Toque longo cujo dedo sai do balão antes de levantar ativa a
         seleção e nunca gera `click`: a bandeira ficava de pé, e o PRÓXIMO
         toque — um toque curto e legítimo — era engolido como se fosse o eco
         daquele. O sintoma é um balão que ignora um toque a cada tanto, que é
         o defeito que ninguém consegue reproduzir de propósito. */
      suprimirClique.current = false;
      origem.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        timer.current = null;
        suprimirClique.current = true;
        aoAtivar();
      }, MS_DO_TOQUE_LONGO);
    },
    [aoAtivar, cancelar],
  );

  const aoMover = useCallback(
    (e: React.PointerEvent) => {
      const inicio = origem.current;
      if (!inicio) return;
      const andou =
        Math.abs(e.clientX - inicio.x) > FOLGA_DO_DEDO_PX ||
        Math.abs(e.clientY - inicio.y) > FOLGA_DO_DEDO_PX;
      if (andou) cancelar();
    },
    [cancelar],
  );

  /** `true` = este clique é o eco do toque longo e deve ser ignorado. */
  const consumirClique = useCallback(() => {
    if (!suprimirClique.current) return false;
    suprimirClique.current = false;
    return true;
  }, []);

  return {
    consumirClique,
    handlers: {
      onPointerDown: aoPressionar,
      onPointerUp: cancelar,
      onPointerCancel: cancelar,
      onPointerLeave: cancelar,
      onPointerMove: aoMover,
    },
  };
}

function BalaoSelecionavel({
  mensagem,
  selecionada,
  selecionando,
  children,
  aoSelecionar,
  aoAlternar,
}: {
  mensagem: MensagemPublica;
  selecionada: boolean;
  selecionando: boolean;
  children: React.ReactNode;
  aoSelecionar: () => void;
  aoAlternar: () => void;
}) {
  const { handlers, consumirClique } = usePressaoLonga(aoSelecionar);

  return (
    <div className="feed__linha">
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selecionando ? selecionada : undefined}
        aria-label={`Mensagem de ${mensagem.remetente}`}
        className={`feed__balao${selecionada ? " feed__balao--selecionada" : ""}`}
        {...handlers}
        onClick={() => {
          if (consumirClique()) return;
          /* Fora do modo de seleção, tocar num balão não faz nada — é o app
             real. Quem entra na seleção é o toque LONGO. */
          if (selecionando) aoAlternar();
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          /* **Só quando a tecla é DESTE invólucro.** O balão tem botões dentro
             ("Abrir matéria", "Tocar áudio", "Ocultar transcrição"), e a tecla
             deles borbulha até aqui: o `preventDefault` abaixo é exatamente o
             que o navegador usa para gerar o `click` desses botões, então ele
             os matava. Quem navegava por teclado apertava Enter sobre "Abrir
             matéria" e o balão entrava em seleção em vez de abrir a matéria — o
             corpo da notícia e a transcrição ficavam inalcançáveis sem mouse.
             O `stopPropagation` do `onClick` dos filhos não cobre isto: ele é
             de outro evento. */
          if (e.target !== e.currentTarget) return;
          e.preventDefault();
          if (selecionando) aoAlternar();
          else aoSelecionar();
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ────────────────────────────────────────── Etapa 2: o grupo "Turma 5ºB"

export function FeedDoGrupo({
  lote,
  estado,
  aoEncaminhar,
  aoLerTudo,
  aoAbrirMidia,
  aoAbrirMural,
  aoFaltarPiso,
  aoFaltarRolagem,
  aoPrecisarDeAjuda,
}: {
  lote: LotePublico;
  estado: Estado;
  aoEncaminhar: (ids: string[]) => void;
  /**
   * Devolve a promessa do `POST /leitura-integral` — e o retorno NÃO é
   * cerimônia. O observador só se desarma depois de a marca chegar ao
   * servidor; ver o efeito abaixo.
   */
  aoLerTudo: () => Promise<void>;
  aoAbrirMidia: (mensagemId: string, tipo: "audio" | "link") => void;
  aoAbrirMural: () => void;
  aoFaltarPiso: (faltam: number) => void;
  aoFaltarRolagem: () => void;
  aoPrecisarDeAjuda: () => void;
}) {
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [folhaAberta, setFolhaAberta] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [precisaDeAjuda, setPrecisaDeAjuda] = useState(false);
  const ultima = useRef<HTMLDivElement | null>(null);
  const jaAvisouLeitura = useRef(estado.leuTudo);
  /** A 8ª mensagem JÁ apareceu nesta tela, tenha o POST chegado ou não. */
  const viuAUltima = useRef(estado.leuTudo);
  /** Há um `POST /leitura-integral` em voo: não mandar o segundo. */
  const marcandoLeitura = useRef(false);
  const leuTudoAgora = useUltimo(aoLerTudo);
  const travouAgora = useUltimo(aoPrecisarDeAjuda);

  const selecionando = selecionadas.length > 0;

  /**
   * A leitura integral: `IntersectionObserver` na 8ª mensagem.
   *
   * Um `onScroll` com conta de altura erraria em todo aparelho com altura de
   * viewport diferente — e a marca decide se "Confirmar envio" abre. Aqui o
   * critério é o que a regra diz: a última mensagem apareceu na tela.
   *
   * **A ordem custou um beco sem saída, e é por isso que ela está escrita
   * assim.** Antes, o ref era marcado e o observador se DESCONECTAVA antes de o
   * `POST /leitura-integral` responder. Numa rede de escola o POST caía,
   * `estado.leuTudo` ficava `false` e nada rearmava nada: a criança rolava até
   * a 8ª de novo e o observador já não existia, o botão do Mural continuava
   * respondendo "ainda há mensagens mais recentes abaixo!" e, como o Mural não
   * abria, `FeedDoGrupo` nunca desmontava para o `useRef` nascer limpo. Só um
   * F5 saía dali, e nada em tela dizia isso.
   *
   * Hoje quem fecha a porta é o RECIBO: `jaAvisouLeitura` só vira `true`
   * depois do sucesso, e o observador fica de pé (a próxima passagem da 8ª
   * tenta de novo). `viuAUltima` guarda que ela JÁ rolou — é o que deixa
   * `tentarAbrirOMural` reenviar a marca em vez de acusar uma rolagem que
   * aconteceu.
   */
  const marcarLeituraUmaVez = useCallback(() => {
    if (jaAvisouLeitura.current || marcandoLeitura.current) return;
    marcandoLeitura.current = true;
    void leuTudoAgora.current().then(
      () => {
        jaAvisouLeitura.current = true;
        marcandoLeitura.current = false;
      },
      () => {
        /* Quem FALA da falha é a tarja da casca; aqui só se reabre a porta. */
        marcandoLeitura.current = false;
      },
    );
  }, [leuTudoAgora]);

  useEffect(() => {
    const alvo = ultima.current;
    if (!alvo || jaAvisouLeitura.current) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        if (!entradas.some((e) => e.isIntersecting)) return;
        viuAUltima.current = true;
        marcarLeituraUmaVez();
      },
      { threshold: 0.6 },
    );
    observador.observe(alvo);
    return () => observador.disconnect();
  }, [marcarLeituraUmaVez]);

  /**
   * O toast da rolagem SAI quando a rolagem chega.
   *
   * Ele era escrito uma vez e nunca voltava a `null`: a criança lia "ainda há
   * mensagens mais recentes abaixo!", rolava até a 8ª, o botão passava a abrir
   * o Mural — e o aviso continuava no rodapé, com `role="alert"`, pelo resto da
   * missão, contradizendo o estado logo acima dele. Um aviso que sobrevive ao
   * que ele pedia é o que ensina a criança a parar de ler os avisos.
   */
  useEffect(() => {
    if (estado.leuTudo) setToast(null);
  }, [estado.leuTudo]);

  /**
   * O balão de Nina por inação (4 min sem nada no Mural).
   *
   * O relógio reinicia a cada encaminhamento: quem está curando não está
   * travado, e o aviso apareceria por cima de alguém que já entendeu o gesto.
   */
  useEffect(() => {
    if (estado.totalEncaminhadas > 0) {
      setPrecisaDeAjuda(false);
      return;
    }
    const id = window.setTimeout(() => {
      setPrecisaDeAjuda(true);
      travouAgora.current();
    }, SEGUNDOS_ATE_O_SCAFFOLDING * 1000);
    return () => window.clearTimeout(id);
  }, [estado.totalEncaminhadas, travouAgora]);

  function alternar(id: string) {
    setSelecionadas((atuais) =>
      atuais.includes(id) ? atuais.filter((x) => x !== id) : [...atuais, id],
    );
  }

  function confirmarEncaminhamento() {
    aoEncaminhar(selecionadas);
    setSelecionadas([]);
    setFolhaAberta(false);
  }

  /**
   * O botão inferior fala nos três estados, e **nunca fica sem alvo**.
   *
   * A doutrina do repo é que um alvo que não faz nada ensina o estudante a
   * desconfiar da tela. A saída aqui não é apagar o botão: é fazer a recusa
   * FALAR. Cada uma das duas portas diz o que falta — e as duas são coisas
   * pedagogicamente diferentes, que é por isso que a api também as separa em
   * dois códigos de erro.
   */
  function tentarAbrirOMural() {
    if (!estado.atingiuPiso) {
      aoFaltarPiso(estado.faltam);
      return;
    }
    if (!estado.leuTudo) {
      /* Ela JÁ rolou até a 8ª e o que faltou foi a rede: repetir o aviso da
         rolagem aqui seria a tela mentindo sobre o que a criança fez. A
         recusa continua falando — mas o que ela pede agora é a marca, não o
         gesto. Se falhar de novo, quem fala é a tarja da casca. */
      if (viuAUltima.current) {
        marcarLeituraUmaVez();
        return;
      }
      setToast(TEXTOS.grupo.faltaRolagem);
      aoFaltarRolagem();
      return;
    }
    aoAbrirMural();
  }

  return (
    <div className="app">
      <StatusBar />

      {selecionando ? (
        <BarraDeSelecao
          total={selecionadas.length}
          aoCancelar={() => setSelecionadas([])}
          aoEncaminhar={() => setFolhaAberta(true)}
        />
      ) : (
        <ChatHeader name={lote.grupo.nome} presence={lote.grupo.subtitulo} />
      )}

      {/*
        (b) COMPENSAÇÃO — a faixa fixa de instrução no topo do chat.
        O pacote não publica banner persistente sob o header.
        PEDIDO ao `storybook-unooria`: `ChatBanner` na seção `whatsappmobile`.
      */}
      <div className="banner-fixo" role="status">
        {/* `tone="inherit"` em todo `<Icon>` cuja cor é do CSS daqui: o tom
            padrão do pacote é `appbar`, e ele pinta `--wa-color-icon-appbar`
            (branco) na classe do ícone, vencendo o `color` herdado. Sem isto o
            glifo do pacote e os SVGs locais de `glifos.tsx` (que herdam por
            `currentColor`) saíam de famílias diferentes lado a lado. Onde a
            superfície é do DS, o tom continua sendo do DS. */}
        <Icon name="sbAlert" size={16} tone="inherit" />
        {TEXTOS.grupo.bannerFixo}
      </div>

      <ChatWallpaper className="app__corpo">
        <div className="feed">
          <EncryptionNotice>{TEXTOS.grupo.avisoDeCriptografia}</EncryptionNotice>

          {lote.mensagens.map((m, i) => {
            const ultimaDoFeed = i === lote.mensagens.length - 1;
            return (
              <div key={m.id} ref={ultimaDoFeed ? ultima : undefined}>
                <BalaoSelecionavel
                  mensagem={m}
                  selecionada={selecionadas.includes(m.id)}
                  selecionando={selecionando}
                  aoSelecionar={() => setSelecionadas([m.id])}
                  aoAlternar={() => alternar(m.id)}
                >
                  <BalaoDaMensagem
                    mensagem={m}
                    encaminhada={estaNoMural(estado, m.id)}
                    aoAbrirMidia={(tipo) => aoAbrirMidia(m.id, tipo)}
                  />
                </BalaoSelecionavel>
              </div>
            );
          })}

          {/* O único texto que quebra o silêncio no grupo, e só depois de 4 min.
              Ele ensina o GESTO — nunca qual mensagem escolher. */}
          {precisaDeAjuda && <div className="card-de-sistema">{TEXTOS.grupo.scaffolding}</div>}
        </div>
      </ChatWallpaper>

      <div className="app__rodape">
        {!estado.atingiuPiso && (
          <p className="rodape__banner" role="status">
            {TEXTOS.grupo.faltaPiso}
          </p>
        )}
        {toast && (
          <p className="rodape__toast" role="alert">
            {toast}
          </p>
        )}
        <TextButton
          className={estado.podeConfirmar ? undefined : "acao--inerte"}
          onClick={tentarAbrirOMural}
        >
          {TEXTOS.grupo.verMural(estado.totalEncaminhadas)}
        </TextButton>
      </div>

      <TarjaDeAdmin />

      {folhaAberta && (
        <FolhaDeEncaminhar
          destino={lote.mural.nome}
          aoConfirmar={confirmarEncaminhamento}
          aoFechar={() => setFolhaAberta(false)}
        />
      )}
    </div>
  );
}

/**
 * (b) COMPENSAÇÃO — a barra de seleção que substitui o header.
 *
 * A seção publica `TopBar` e `ChatHeader`, e nenhum dos dois é a barra
 * contextual do app real (sair, contador, ações). Composta com os tokens
 * `--wa-*` e os ícones do pacote.
 * PEDIDO: `SelectionBar` na seção `whatsappmobile`.
 */
function BarraDeSelecao({
  total,
  aoCancelar,
  aoEncaminhar,
}: {
  total: number;
  aoCancelar: () => void;
  aoEncaminhar: () => void;
}) {
  return (
    <div className="barra-selecao">
      <button
        type="button"
        className="barra-selecao__acao"
        aria-label={TEXTOS.grupo.cancelarSelecao}
        onClick={aoCancelar}
      >
        <Xis size={18} />
      </button>
      <span className="barra-selecao__contador">{TEXTOS.grupo.selecionadas(total)}</span>
      <button
        type="button"
        className="barra-selecao__acao"
        aria-label={TEXTOS.grupo.encaminharPara}
        onClick={aoEncaminhar}
      >
        {/* `tone="inherit"`: a cor é da `.barra-selecao` (o CSS local declara
            `color: inherit` neste botão). Sem isto o pacote pinta
            `--wa-color-icon-appbar` na classe do glifo e vence o herdado. */}
        <Icon name="forward" size={20} tone="inherit" />
      </button>
    </div>
  );
}

/**
 * (b) COMPENSAÇÃO — a folha "Encaminhar para...".
 *
 * `AttachmentSheet` existe, mas é a grade de anexos (câmera, documento,
 * localização), com vocabulário fechado — não serve para uma lista de destinos.
 * A folha é composta; as LINHAS são `ListItem` do pacote.
 * PEDIDO: `BottomSheet` genérico na seção `whatsappmobile`.
 *
 * **Um destino, e só um.** O app real listaria conversas recentes; aqui só
 * existe o Mural da Turma. Encher a folha de destinos falsos daria à criança
 * escolhas que não são da missão — e a decisão que ela está tomando é O QUE
 * encaminhar, não para onde.
 */
function FolhaDeEncaminhar({
  destino,
  aoConfirmar,
  aoFechar,
}: {
  destino: string;
  aoConfirmar: () => void;
  aoFechar: () => void;
}) {
  return (
    <div className="folha" role="dialog" aria-label={TEXTOS.grupo.encaminharPara}>
      <div className="folha__titulo">{TEXTOS.grupo.encaminharPara}</div>
      <ListItem
        title={destino}
        density="chat"
        leading={<Icon name="forward" size={18} />}
        onClick={aoConfirmar}
      />
      <TextButton onClick={aoFechar}>{TEXTOS.grupo.cancelar}</TextButton>
    </div>
  );
}

/**
 * (b) COMPENSAÇÃO — a tarja de grupo só-administradores, no lugar do teclado.
 *
 * O `MessageComposer` fica INERTE porque não recebe `onChange` nem `onAction`:
 * o pacote não tem prop `disabled`, e é assim que o campo fica sem alvo. O
 * `pointer-events: none` do CSS completa o serviço nos três glifos e no FAB do
 * microfone, que o componente monta sozinho — sem ele, três botões que não
 * fazem nada, que é exatamente o que ensina o estudante a desconfiar da tela.
 * PEDIDO: `AdminOnlyNotice` na seção `whatsappmobile`.
 *
 * **`inert`, e não só `aria-hidden`.** Os dois não fazem a mesma coisa: o
 * `aria-hidden` some do leitor de tela e o `pointer-events` some do dedo, mas
 * o `<textarea>` e os quatro botões que o `MessageComposer` monta continuavam
 * na ORDEM DE TABULAÇÃO — quem navega por teclado caía dentro de uma árvore
 * marcada como inexistente, que é erro de acessibilidade por si só, e o foco
 * ficava num campo que o leitor de tela não anuncia. O `inert` tira do foco,
 * do ponteiro e da árvore de acessibilidade de uma vez.
 *
 * E a frase volta por fora: "apenas administradores podem enviar mensagens"
 * é informação da tela, não decoração. Escondida junto com o teclado falso,
 * quem usa leitor de tela ficava sem saber por que não consegue responder.
 */
function TarjaDeAdmin() {
  return (
    <div className="tarja-de-admin">
      <p className="tarja-de-admin__leitura">{TEXTOS.grupo.tarjaDeAdmin}</p>
      <div inert aria-hidden="true">
        <MessageComposer placeholder={TEXTOS.grupo.tarjaDeAdmin} />
      </div>
    </div>
  );
}

// ───────────────────────────────────────────── Etapa 3: o Mural da Turma

export function MuralDaTurma({
  lote,
  estado,
  aoVoltar,
  aoRemover,
  aoConfirmar,
  aoVerAtrito,
}: {
  lote: LotePublico;
  estado: Estado;
  aoVoltar: () => void;
  aoRemover: (mensagemId: string) => void;
  aoConfirmar: () => void;
  aoVerAtrito: () => void;
}) {
  const [menuDe, setMenuDe] = useState<string | null>(null);
  const noMural = mensagensEncaminhadas(lote, estado.encaminhadas);

  const viuOAtrito = useUltimo(aoVerAtrito);
  useEffect(() => {
    if (estado.encaminhouTudo) viuOAtrito.current();
  }, [estado.encaminhouTudo, viuOAtrito]);

  return (
    <div className="app">
      <StatusBar />
      <ChatHeader
        name={lote.mural.nome}
        presence={TEXTOS.grupo.selecionadas(estado.totalEncaminhadas)}
        onBack={aoVoltar}
      />

      <ChatWallpaper className="app__corpo">
        <div className="feed">
          {noMural.map((m) => (
            <BalaoDoMural
              key={m.id}
              mensagem={m}
              aoAbrirMenu={() => setMenuDe(m.id)}
            />
          ))}

          {/* O card de sistema do PICO. Ele entra JUNTO da lista, no fim do
              Mural, porque é ali que a criança termina de reler — e é o último
              instante em que dá para voltar atrás. */}
          <div className="card-de-sistema">
            <p className="card-de-sistema__texto">
              {estado.encaminhouTudo ? TEXTOS.mural.atritoDeTudo : TEXTOS.mural.pico}
            </p>
            <div className="card-de-sistema__acoes">
              <TextButton onClick={aoConfirmar}>{TEXTOS.mural.confirmar}</TextButton>
              <TextButton onClick={aoVoltar}>{TEXTOS.mural.revisar}</TextButton>
            </div>
          </div>
        </div>
      </ChatWallpaper>

      <div className="app__rodape">
        <TextButton onClick={aoVoltar}>{TEXTOS.mural.voltar}</TextButton>
      </div>

      {menuDe && (
        /*
         * O VÉU FECHA POR TOQUE, e isso não é conveniência.
         *
         * O `Menu` do pacote só fecha por `Escape` — o único listener dele é
         * `if (event.key === 'Escape') onClose()`. A criança está num TABLET:
         * sem teclado, sem clique-fora e sem véu clicável, ela segura um balão
         * do Mural (o gesto que a missão acabou de ensinar) e o menu não tem
         * saída. Ou ela apaga a mensagem que não queria, ou fica presa na tela
         * com o latch à frente.
         *
         * Este `<div>` já era o véu VISUAL (`inset: 0` + scrim); o que faltava
         * era ele responder ao dedo. O `onPointerDown` de dentro do `Menu` não
         * sobe — o `stopPropagation` abaixo é o que separa "toquei fora" de
         * "toquei no item". PEDIDO ao `storybook-unooria`: fechamento por
         * clique-fora no `Menu` da seção `whatsappmobile`; quando chegar, o
         * `onPointerDown` daqui sai.
         */
        <div className="menu-flutuante" onPointerDown={() => setMenuDe(null)}>
          <div onPointerDown={(e) => e.stopPropagation()}>
            <Menu
              items={[{ id: "apagar", label: TEXTOS.mural.apagar }]}
              onSelect={() => {
                aoRemover(menuDe);
                setMenuDe(null);
              }}
              onClose={() => setMenuDe(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function BalaoDoMural({
  mensagem,
  aoAbrirMenu,
}: {
  mensagem: MensagemPublica;
  aoAbrirMenu: () => void;
}) {
  const { handlers, consumirClique } = usePressaoLonga(aoAbrirMenu);
  return (
    <div className="feed__linha feed__linha--minha">
      <div
        role="button"
        tabIndex={0}
        aria-label={`Opções da mensagem ${mensagem.hora}`}
        className="feed__balao"
        {...handlers}
        onClick={() => consumirClique()}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          /* Pela mesma razão do feed: uma mensagem de áudio ou de link
             encaminhada leva os botões dela para dentro do Mural, e o Enter
             sobre "Ocultar transcrição" abria o menu de apagar. */
          if (e.target !== e.currentTarget) return;
          e.preventDefault();
          aoAbrirMenu();
        }}
      >
        <BalaoDaMensagem mensagem={mensagem} direcao="out" encaminhada mostrarRemetente={false} />
      </div>
    </div>
  );
}

// ───────────────────────────────────────── Etapa 4: a espera ativa (latch)

export function EsperaAtiva({ lote, estado }: { lote: LotePublico; estado: Estado }) {
  const noMural = mensagensEncaminhadas(lote, estado.encaminhadas);

  return (
    <div className="app">
      <StatusBar />
      {/*
        (b) COMPENSAÇÃO — o cadeado sobre o header.
        `ChatHeader` não tem slot de estado (`trailing`, `badge`). O cadeado é o
        que diz, sem texto, que este Mural fechou: a criança acabou de apertar
        um botão irreversível e precisa ver que ele pegou.
        PEDIDO: `ChatHeader` com `trailing`.
      */}
      <div className="cabecalho-travado">
        <ChatHeader name={lote.mural.nome} presence={TEXTOS.espera.rodape} />
        <span className="cabecalho-travado__cadeado" aria-hidden="true">
          {/* `tone="inherit"`: o cadeado é `--wa-color-text-meta` pelo CSS da
              compensação, e o tom padrão do pacote o devolveria branco. */}
          <Icon name="lock" size={14} tone="inherit" />
        </span>
      </div>

      <ChatWallpaper className="app__corpo">
        {/* Os balões recuam para o fundo: eles estão lá para ser relidos, que é
            o que Nina pede — mas a ação acabou, e a opacidade é o que diz isso
            sem escrever "bloqueado". */}
        <div className="feed feed--dormente">
          {noMural.map((m) => (
            <div className="feed__linha feed__linha--minha" key={m.id}>
              <div className="feed__balao">
                <BalaoDaMensagem
                  mensagem={m}
                  direcao="out"
                  encaminhada
                  mostrarRemetente={false}
                />
              </div>
            </div>
          ))}

          <div className="card-de-sistema">
            <p className="card-de-sistema__texto">{TEXTOS.espera.nina}</p>
          </div>
        </div>
      </ChatWallpaper>

      <div className="app__rodape">
        <p className="rodape__banner" role="status">
          {TEXTOS.espera.rodape}
        </p>
      </div>
    </div>
  );
}

// ──────────────────────────────────────── Etapa 5: o Mural revelado

export function MuralRevelado({
  lote,
  estado,
  aoResponder,
}: {
  lote: LotePublico;
  estado: Estado;
  /** Ausente = a etapa ainda não abriu, ou o Mural dele não foi confirmado. */
  aoResponder?: () => void;
}) {
  const noMural = mensagensEncaminhadas(lote, estado.encaminhadas);
  const revelacao = estado.revelacao;
  const porId = new Map((revelacao?.mensagens ?? []).map((m) => [m.id, m]));

  return (
    <div className="app">
      <StatusBar />
      <ChatHeader name={lote.mural.nome} presence={TEXTOS.revelacao.sinteseTitulo} />

      <ChatWallpaper className="app__corpo">
        <div className="feed">
          {noMural.length === 0 && <div className="card-de-sistema">{TEXTOS.mural.vazio}</div>}

          {noMural.map((m) => {
            const revelada = porId.get(m.id);
            return (
              <div className="feed__linha feed__linha--minha" key={m.id}>
                <div className="feed__balao">
                  <BalaoDaMensagem
                    mensagem={m}
                    direcao="out"
                    encaminhada
                    mostrarRemetente={false}
                  />
                  {revelada && (
                    <FitaDeVeracidade
                      veracidade={revelada.veracidade}
                      explicacao={revelada.explicacao}
                      total={revelada.total}
                      totalConfirmados={revelacao?.totalConfirmados ?? 0}
                    />
                  )}
                </div>
              </div>
            );
          })}

          {revelacao && <CardDeSintese sintese={revelacao.sintese} />}
        </div>
      </ChatWallpaper>

      <div className="app__rodape">
        {aoResponder ? (
          <TextButton onClick={aoResponder}>{TEXTOS.revelacao.irParaReflexao}</TextButton>
        ) : (
          <p className="rodape__banner" role="status">
            {estado.confirmou ? TEXTOS.revelacao.rodape : TEXTOS.revelacao.semConfirmacao}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * (b) COMPENSAÇÃO — a fita de veracidade sob o balão.
 *
 * O pacote tem `Badge` (contador numérico) e os ícones, mas não a etiqueta
 * composta com pictograma, rótulo e justificativa.
 * PEDIDO: `MessageTag` na seção `whatsappmobile`.
 *
 * **Três FORMAS, não três cores.** O pictograma é a informação e a cor é
 * redundância: um estudante daltônico tem de conseguir separar "Confirmada" de
 * "Falsa ou distorcida" numa tela em que a decisão da turma inteira está
 * escrita. O rótulo por extenso fecha a conta para quem usa leitor de tela.
 */
function FitaDeVeracidade({
  veracidade,
  explicacao,
  total,
  totalConfirmados,
}: {
  veracidade: Veracidade;
  explicacao: string;
  total: number;
  totalConfirmados: number;
}) {
  return (
    <div className={`fita fita--${veracidade}`}>
      <span className="fita__cabeca">
        <span className="fita__glifo" aria-hidden="true">
          {/* `tone="inherit"`: o ✓ vem do pacote e o ✕ e a meia-lua são SVGs
              locais que herdam por `currentColor`. Sem o `inherit` as três
              fitas teriam duas cores de pictograma entre si, e a do pacote
              ignoraria a cor legível que a `.fita__cabeca` define. */}
          {veracidade === "verdadeira" ? (
            <Icon name="tick" size={16} tone="inherit" />
          ) : veracidade === "falsa" ? (
            <Xis size={16} />
          ) : (
            <MeiaLua size={16} />
          )}
        </span>
        <strong className="fita__rotulo">{TEXTOS.revelacao.selo[veracidade]}</strong>
      </span>
      <span className="fita__explicacao">{explicacao}</span>
      {/* A métrica SOCIAL, e ela é da mensagem, nunca da criança: "quantos
          encaminharam isto", jamais "você errou". É a leitura da sala (PED-11). */}
      <span className="fita__metrica">
        {TEXTOS.revelacao.metricaSocial(total, totalConfirmados)}
      </span>
    </div>
  );
}

/**
 * (b) COMPENSAÇÃO — o mini-infográfico de duas barras.
 *
 * A seção do clone não tem data viz (e não deveria ter: WhatsApp não faz
 * gráfico). A seção da plataforma tem `BarChart`, e usá-lo aqui seria misturar
 * as duas famílias dentro do disfarce — a violação que a regra de ouro proíbe.
 * Duas barras proporcionais em SVG, com os tokens `--wa-*`, resolvem sem
 * arrastar a biblioteca inteira nem quebrar a ficção: é o resumo que um card
 * fixado no grupo mostraria.
 *
 * O `total` é a soma das duas, não a maior: as barras dividem os
 * encaminhamentos da turma entre si, e é a divisão que o card está contando.
 */
function CardDeSintese({ sintese }: { sintese: Sintese }) {
  const total = sintese.emocionais + sintese.informativas;
  const barras = [
    { rotulo: TEXTOS.revelacao.barraEmocionais, valor: sintese.emocionais, classe: "urgencia" },
    {
      rotulo: TEXTOS.revelacao.barraInformativas,
      valor: sintese.informativas,
      classe: "informativa",
    },
  ];

  return (
    <div className="card-de-sistema card-de-sistema--sintese">
      <strong className="card-de-sistema__titulo">{TEXTOS.revelacao.sinteseTitulo}</strong>

      <svg className="infografico" viewBox="0 0 100 34" role="img" aria-hidden="true">
        {barras.map((b, i) => (
          <rect
            key={b.classe}
            className={`infografico__barra infografico__barra--${b.classe}`}
            x="0"
            y={i * 18}
            width={proporcao(b.valor, total)}
            height="10"
            rx="3"
          />
        ))}
      </svg>

      <ul className="infografico__legenda">
        {barras.map((b) => (
          <li key={b.classe}>
            <span className={`infografico__marca infografico__marca--${b.classe}`} />
            {b.rotulo}: {b.valor}
          </li>
        ))}
      </ul>

      <p className="card-de-sistema__texto">{TEXTOS.sintese(sintese.polaridade)}</p>
    </div>
  );
}
