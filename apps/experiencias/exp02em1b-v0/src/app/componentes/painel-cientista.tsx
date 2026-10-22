import { useEffect, useRef, useState } from 'react';
import {
  Badge,
  Button,
  ChatBubble,
  Composer,
  Divider,
  PromptSuggestion,
  TopicColumn,
} from '@edu/ui/ds-unooriaai';
import { CONJUNTO_POR_SLUG } from '../../lib/textos';
import type { Anexo } from '../../lib/tipos';
import { CartaoAlocacao, CartaoDesfecho, CartaoOpcoes, CartaoTendencia } from './cartoes';
import { motivoDeBloqueio, type EstadoDoRelogio } from '../../lib/relogio';
import { AVISO_SEM_PERGUNTAS, perguntasRestantes, rotuloDoOrcamento } from '../../lib/textos';
import { indiceDoUltimoCartao, rotuloColapsado } from '../../lib/cartoes';
import { CHAMADA_DESTRAVAR, PERGUNTAS_PRONTAS, estaTravado } from '../../lib/destravar';
import type { RodadaDoModelo } from '../../lib/tipos';

export interface Fala {
  papel: string;
  texto: string;
  /** Cartão da fala: tendência, alocação ou desfecho (ADR-0007). */
  anexo?: Anexo | null;
}

function Cartao({
  anexo,
  anterior,
  expandido,
  onEscolherOpcao,
  ocupado,
}: {
  anexo: Anexo;
  anterior?: RodadaDoModelo | null;
  expandido: boolean;
  onEscolherOpcao?: (opcao: { alfa: string; bravo: string }) => void;
  ocupado: boolean;
}) {
  if (anexo.tipo === 'opcoes') {
    return (
      <>
        <CartaoTendencia
          rodada={anexo.rodada}
          hora={anexo.hora}
          anterior={anterior}
          expandido={expandido}
        />
        {/* Só a proposta mais recente é clicável: a alocação pode ter mudado
            desde uma fala antiga, e o botão mandaria a equipe para um destino
            que o estudante já trocou. */}
        <CartaoOpcoes
          opcoes={anexo.opcoes}
          rodada={anexo.rodada}
          onEscolher={expandido ? onEscolherOpcao : undefined}
          ocupado={ocupado}
        />
      </>
    );
  }
  if (anexo.tipo === 'tendencia') {
    const cartao = (
      <CartaoTendencia
        rodada={anexo.rodada}
        hora={anexo.hora}
        anterior={anterior}
        expandido={expandido}
      />
    );
    // Leitura antiga vira uma linha que ele pode abrir. `<details>` nativo:
    // sem estado para gerenciar e acessível de graça.
    return expandido ? (
      cartao
    ) : (
      <details className="mt-3">
        <summary className="cursor-pointer rounded-uai-md border border-uai-borda bg-uai-fundo px-3 py-2 text-xs font-semibold text-uai-suave-60 hover:text-uai-tinta">
          {rotuloColapsado(anexo.hora)}
        </summary>
        {cartao}
      </details>
    );
  }
  if (anexo.tipo === 'alocacao') {
    return <CartaoAlocacao alfa={anexo.alfa} bravo={anexo.bravo} />;
  }
  return (
    <CartaoDesfecho
      desfecho={anexo.desfecho}
      esperado={anexo.esperado}
      naoConsultados={anexo.naoConsultados}
    />
  );
}

/**
 * A espera. O modelo leva de 10 a 30 segundos e o cronômetro corre — sem nada
 * na tela além de uma frase parada, o estudante acha que travou e clica de novo.
 *
 * O que se mostra é VERDADE: os segundos que já passaram e quantas fontes
 * entram na conta. Barra de progresso seria mentira — não existe percentual
 * conhecido de uma resposta de LLM.
 *
 * Vem no mesmo `ChatBubble` do assistente para nascer onde a resposta vai
 * nascer: o avatar já está no lugar quando o texto chega.
 */
function Consultando({ fontes }: { fontes: number }) {
  const [segundos, setSegundos] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const linha =
    segundos < 4
      ? 'Lendo sua pergunta'
      : segundos < 12
        ? fontes > 0
          ? `Cruzando as ${fontes} fonte${fontes > 1 ? 's' : ''} que você carregou`
          : 'Procurando nos dados da cidade'
        : segundos < 22
          ? 'Montando a resposta'
          : 'Ainda respondendo — pergunta com muito dado demora mais';

  return (
    <ChatBubble role="assistant" avatarInitials="CD" className="w-full">
      <span className="flex items-center gap-2">
        <span className="flex gap-1" aria-hidden>
          <span className="h-1.5 w-1.5 animate-pulse rounded-uai-full bg-uai-acao" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-uai-full bg-uai-acao [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-uai-full bg-uai-acao [animation-delay:300ms]" />
        </span>
        {linha}
        {/* Só visual: dentro do `role="log"` o contador seria anunciado a cada
            segundo, por cima da resposta (ADR-162). */}
        <span className="tabular-nums text-uai-suave-60" aria-hidden="true">
          {segundos}s
        </span>
      </span>
      {/* Enquanto ele responde, o campo continua vivo: escrever a próxima
          pergunta é a única coisa que o estudante pode fazer com o tempo que o
          modelo está gastando. */}
      <span className="mt-1 block text-xs text-uai-suave-60">
        Pode ir escrevendo a próxima pergunta.
      </span>
    </ChatBubble>
  );
}

/**
 * Painel do Cientista: 2/3 da tela, à esquerda.
 *
 * A conversa é o `ChatBubble`, e o campo é o `Composer` dentro da sua doca —
 * a régua do CLIENTE WEB, não a da página de design system. O pacote publica
 * as duas e a regra é que uma nunca substitui a outra: `Composer` tem 760×56,
 * quatro alvos e contorno de 1px; `ChatInput` tem 600×48 e um alvo
 * redondo. A doca é a faixa com véu translúcido e desfoque de 40px que o
 * pacote desenha atrás dele.
 *
 * Os dois alvos que antecedem o campo — microfone e imagem — ficam OCULTOS
 * (`hideLeadingActions`). Eles existem no arquivo, mas aqui não teriam o que
 * fazer, e controle morto numa tela sob cronômetro é pior que controle
 * ausente: o estudante clica, não acontece nada, e ele perde o turno achando que
 * travou.
 *
 * NÃO existe lista de perguntas sugeridas por padrão. Um chip com o nome de um
 * conjunto já diz ao estudante qual conjunto importa antes de ele investigar — é
 * gabarito disfarçado de atalho, e enviesa a decisão que a Missão inteira
 * existe para ele tomar sozinho. As `Tag` do destravamento são a exceção
 * declarada, e só aparecem depois de dois turnos sem nada da cidade.
 *
 * A prosa é da LLM; Etiqueta, tabela e Procedência são renderizadas a partir
 * da ficha canônica (ADR-0005).
 */
export function PainelCientista({
  falas,
  aviso,
  alertas,
  estadoDoTempo,
  perguntasGastas,
  ocupado,
  emUso,
  onPerguntar,
  onDecidir,
  onEnviar,
  destinos,
  onEscolherOpcao,
}: {
  falas: Fala[];
  /** Falha da última ação. Aparece colada no campo, onde a ação aconteceu. */
  aviso: string | null;
  /** O que a viagem já diz sobre os destinos escolhidos: chegada e via. */
  alertas: string[];
  /** Fase do Relógio da turma: decide o campo, o motivo e o botão de envio. */
  estadoDoTempo: EstadoDoRelogio;
  /** Quantas Perguntas de investigação já foram gastas (board: até 3). */
  perguntasGastas: number;
  ocupado: boolean;
  /** O que o Cientista está usando agora. Só leitura: quem escolhe é a conversa. */
  emUso: string[];
  onPerguntar: (texto: string) => void | Promise<boolean | void>;
  /** Abre o painel de decisão. Existe a Investigação inteira, com ou sem destino
   *  registrado — quem clica é o estudante (regra de ouro 5). */
  onDecidir: (() => void) | null;
  /** Manda as equipes sem passar pelo painel. Quem clica é o estudante. */
  onEnviar: (() => void) | null;
  destinos: { equipe: 'alfa' | 'bravo'; nome: string | null }[];
  /** Clique numa das duas alternativas que o Cientista pôs na mesa. */
  onEscolherOpcao?: (opcao: { alfa: string; bravo: string }) => void;
}) {
  const [texto, setTexto] = useState('');
  const [investigandoDeNovo, setInvestigandoDeNovo] = useState(false);
  const fim = useRef<HTMLDivElement>(null);

  // Fechada por tempo ou pelo professor: nos dois casos a Missão pede envio.
  const tempoAcabou = estadoDoTempo.fase === 'encerrado';
  // As duas equipes com destino: a Missão pede envio, não mais pergunta.
  const decidido = destinos.every((d) => d.nome !== null) && !tempoAcabou;
  const algumDestino = destinos.some((d) => d.nome !== null);

  // Só a leitura mais recente fica aberta. As de trás repetiam a mesma tabela,
  // o mesmo empate e o mesmo disclaimer a cada turno, e o estudante parava de ler.
  const ultimoCartao = indiceDoUltimoCartao(falas);
  const leituraAnteriorA = (i: number): RodadaDoModelo | null => {
    for (let j = i - 1; j >= 0; j -= 1) {
      const a = falas[j]?.anexo;
      if (a?.tipo === 'tendencia' || a?.tipo === 'opcoes') return a.rodada;
    }
    return null;
  };

  // Conversa nova entra por baixo: sem isto o estudante tem que rolar para ler a
  // resposta que acabou de pedir.
  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [falas.length, ocupado]);
  const bloqueio = motivoDeBloqueio(estadoDoTempo);
  // As Perguntas acabaram: o campo NÃO fecha. O estudante ainda precisa dizer para
  // onde vai cada equipe, e fechar aqui o deixaria com uma decisão para tomar e
  // nenhuma forma de tomá-la.
  const semPerguntas = perguntasRestantes(perguntasGastas) === 0;
  // Dois turnos sem nada da cidade: ele não sabe o que pedir, e o relógio corre
  // do mesmo jeito. Só aparece quando ainda há pergunta para gastar — oferecer
  // ajuda para investigar depois que a investigação acabou é zombaria.
  const travado = !semPerguntas && !bloqueio && estaTravado(falas);

  /**
   * O rascunho some na hora, e VOLTA se a pergunta não entrou.
   *
   * As duas metades desta função pagam bugs diferentes, e é por isso que
   * nenhuma das duas pode sumir:
   *
   * - Limpar CEDO: `onPerguntar` põe a fala do estudante na conversa antes de
   *   ir ao servidor, e o turno leva de 10 a 30 segundos. Enquanto o campo só
   *   era limpo DEPOIS do `await`, a mesma pergunta ficava visível nos dois
   *   lugares a consulta inteira — e o estudante lia isso como "não enviou",
   *   apagava e mandava de novo.
   * - Restaurar em FALHA: antes de tudo isso o campo era limpo antes da ida ao
   *   servidor e nada o devolvia; falha de rede levava junto a pergunta que ele
   *   tinha acabado de escrever, e ele redigitava com o cronômetro correndo —
   *   quando não desistia em silêncio.
   *
   * A restauração respeita quem já está digitando: o campo NÃO é desabilitado
   * durante a consulta (ver o `Composer` abaixo), então devolver o rascunho por
   * cima de um texto novo apagaria o que o estudante escreveu enquanto esperava.
   */
  async function enviar(valor: string) {
    const pergunta = valor.trim();
    if (!pergunta || ocupado || bloqueio) return;
    setTexto('');
    const entrou = await onPerguntar(pergunta);
    if (entrou === false) setTexto((atual) => (atual === '' ? pergunta : atual));
  }

  return (
    // Quem é o Cientista subiu para o cabeçalho da Missão: era uma faixa de
    // 60px repetindo a mesma frase a conversa inteira, e altura no chat é o
    // recurso mais escasso desta tela.
    <section className="flex h-full w-full flex-col">
      {/* A rolagem vive AQUI: só as mensagens rolam. */}
      {/* `log` + foco: a conversa rola, e o teclado precisa alcançá-la; o papel
          faz o leitor de tela anunciar a fala nova (WCAG 2.1.1/4.1.3, ADR-162). */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-5" role="log" aria-label="Conversa com o cientista" tabIndex={0}>
        {falas.length === 0 && (
          <ChatBubble role="assistant" avatarInitials="CD" className="w-full">
            <span className="block">
              Boa tarde. Eu sou o Cientista de Dados da sala de operações.
            </span>
            <span className="mt-2 block">
              Eu tenho acesso aos dados da cidade: população, previsão do tempo, vias, abrigos e
              estimativas de dano. Eu digo de onde vem cada informação e aviso quando ela não
              existe.
            </span>
            <span className="mt-2 block">O que você quer saber primeiro?</span>
          </ChatBubble>
        )}

        {falas.map((f, i) =>
          f.papel === 'estudante' || f.papel === 'estudante' ? (
            <div key={i} className="flex justify-end">
              <ChatBubble role="user" className="max-w-[85%]">
                {f.texto}
              </ChatBubble>
            </div>
          ) : (
            <ChatBubble key={i} role="assistant" avatarInitials="CD" className="w-full">
              <span className="block whitespace-pre-line">{f.texto}</span>
              {f.anexo && (
                <Cartao
                  anexo={f.anexo}
                  anterior={leituraAnteriorA(i)}
                  expandido={i === ultimoCartao}
                  onEscolherOpcao={onEscolherOpcao}
                  ocupado={ocupado}
                />
              )}
            </ChatBubble>
          ),
        )}

        {ocupado && <Consultando fontes={emUso.length} />}
        <div ref={fim} />
      </div>

      {/* Faixa de leitura, não painel de controle: o estudante vê o que está em uso
          e troca CONVERSANDO. Rótulos curtos e sem adjetivo — dizer "feito há
          nove anos" aqui entrega pela interface o que ele deveria descobrir
          conversando. */}
      <Divider />
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-uai-superficie px-4 py-2 text-xs text-uai-suave-60">
        <p>
          {emUso.length > 0 ? (
            <>
              <span className="font-semibold text-uai-tinta">O Cientista está usando: </span>
              {emUso
                .map((s) => CONJUNTO_POR_SLUG.get(s)?.rotuloCurto ?? s)
                .map((r) => r.charAt(0).toUpperCase() + r.slice(1))
                .join(' · ')}
            </>
          ) : (
            <span>O Cientista ainda não consultou nada.</span>
          )}
        </p>
        {/* O contador fica onde a Pergunta é feita. Ele conta o que RESTA:
            saber que sobrou uma é o que faz o estudante pensar antes de gastá-la —
            e é para isso que o limite existe. */}
        <Badge variant={semPerguntas ? 'warning' : 'default'}>
          {rotuloDoOrcamento(perguntasGastas)}
        </Badge>
      </div>

      {/* Dockado no rodapé: nunca sai de vista. */}
      <div className="shrink-0 px-4 pt-4">
        {/* Altura reservada: entrar empurrando o campo para baixo tira do lugar
            justamente o elemento que o estudante está olhando. */}
        {/* Board 2b: o estudante "volta com uma pergunta na mão". São PERGUNTAS,
            não fontes — quem escolhe o que consultar continua sendo o
            Cientista. E são de três tipos diferentes: ver quem, onde e quanto
            tempo lado a lado já ensina que existe mais de uma coisa que dá para
            querer saber. As `Tag` são as mesmas do arquivo de design, onde elas
            são sugestão de prompt — que é exatamente o papel aqui. */}
        {travado && !ocupado && (
          // `TopicColumn` + `PromptSuggestion`: é a coluna de exemplos da tela
          // de nova conversa, no papel para o qual ela existe — sugestão
          // de prompt acionável. Antes eram `Tag`, que é cápsula de filtro da
          // outra página e encolhia três perguntas inteiras em três chips.
          <TopicColumn icon="chats" title={CHAMADA_DESTRAVAR} className="mb-3 !w-full">
            {PERGUNTAS_PRONTAS.map((q) => (
              // `block` porque a coluna aqui ocupa a largura do painel, não os
              // 280px de uma das três colunas da tela `New chat`.
              <PromptSuggestion
                key={q.texto}
                block
                as="button"
                type="button"
                onClick={() => enviar(q.texto)}
                disabled={ocupado}
                title={q.tipo}
              >
                {q.texto}
              </PromptSuggestion>
            ))}
          </TopicColumn>
        )}
        {semPerguntas && !bloqueio && !aviso && (
          <p className="mb-2 rounded-uai-md border-l-4 border-uai-alerta bg-uai-superficie px-3 py-2 text-sm leading-snug text-uai-tinta">
            {AVISO_SEM_PERGUNTAS}
          </p>
        )}
        <div className="min-h-[1.75rem]">
          {aviso && (
            <p role="alert" className="mb-2 text-sm font-semibold text-uai-erro">
              {aviso}
            </p>
          )}
        </div>
        {/* O destino de cada equipe fica à vista, no rodapé, junto do campo:
            o estudante decidiu conversando e a decisão sumia scroll acima. Aqui ele
            lê o que está prestes a mandar sem sair do lugar. */}
        {onDecidir && (
          <div
            className={`mb-3 flex flex-wrap items-center justify-between gap-3 rounded-uai-xl px-4 py-3 ${
              tempoAcabou ? 'bg-uai-fill-8' : 'bg-uai-superficie'
            }`}
          >
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {destinos.map((d) => (
                <span key={d.equipe} className="flex items-center gap-2">
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-uai-md text-xs font-bold text-uai-tinta-inv ${
                      d.equipe === 'alfa' ? 'bg-uai-equipe-alfa' : 'bg-uai-equipe-bravo'
                    }`}
                  >
                    {d.equipe.charAt(0).toUpperCase()}
                  </span>
                  <span className="text-sm leading-tight">
                    <span className="block text-xs uppercase tracking-wider text-uai-suave-60">
                      Equipe {d.equipe}
                    </span>
                    <strong className={d.nome ? 'text-uai-tinta' : 'text-uai-suave-60'}>
                      {d.nome ?? 'sem destino'}
                    </strong>
                  </span>
                </span>
              ))}
            </div>
            {/* Duas saídas, e as duas explícitas: rever a decisão inteira, ou
                mandar. Uma só obrigava a passar pelo painel para enviar, ou
                escondia o painel de quem já tinha decidido. */}
            {alertas.length > 0 && (
              <ul className="w-full rounded-uai-md border-l-4 border-uai-alerta bg-uai-fundo p-3 text-sm leading-snug text-uai-tinta">
                {alertas.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            )}
            <div className="flex shrink-0 items-center gap-2">
              <Button
                onClick={onDecidir}
                disabled={ocupado}
                // Sem destino nenhum e com o relógio parado, este botão é a
                // única saída da tela: ele precisa parecer a ação principal.
                variant={algumDestino ? 'outline' : tempoAcabou ? 'destructive' : 'secondary'}
              >
                {algumDestino ? 'Ver detalhes' : 'Definir destinos'}
              </Button>
              {decidido && onEnviar && (
                <span className="flex flex-col items-end gap-1">
                  {/* O irreversível fica ACIMA do botão, não dentro do
                      parágrafo que ninguém lê até o fim. */}
                  <span className="text-xs font-semibold text-uai-alerta">
                    Depois de enviar não dá para mudar
                  </span>
                  <Button variant="secondary" onClick={onEnviar} disabled={ocupado}>
                    Enviar equipes
                  </Button>
                </span>
              )}
              {tempoAcabou && onEnviar && (
                <Button variant="destructive" onClick={onEnviar} disabled={ocupado}>
                  {estadoDoTempo.motivoDoFim === 'professor'
                    ? 'Investigação encerrada · enviar'
                    : 'A chuva chegou · enviar'}
                </Button>
              )}
            </div>
          </div>
        )}
        {/* Com as duas equipes definidas, o campo sai da frente: a próxima ação
            é mandar, não perguntar. Quem quiser voltar a investigar diz — o
            atalho abaixo devolve o campo, senão a conversa ficaria trancada. */}
      </div>

      {/* `Composer.Dock` é a faixa que o arquivo desenha atrás do compositor —
          véu translúcido e desfoque de 40px — e ela envolve o COMPOSITOR, só
          ele. Pôr os destinos e os alertas aqui dentro obrigaria a sobrescrever
          o padding e a centralização que o arquivo mede, e a doca deixaria de
          ser a doca. */}
      {/* O respiro lateral é NOSSO, e precisa de `!` para existir.
          
          O pacote mede a doca como `padding: 20px 0 40px` — zero nas laterais —
          porque no arquivo o compositor tem 760px fixos e o quadro tem 1440: a
          centralização já deixa 340px de margem de cada lado. Aqui ele é
          `block` num painel de 2/3, e com zero ele encosta no fio da barra
          lateral de um lado e no mapa do outro.
          
          `px-4` sozinho não pega: o shorthand do pacote e o utilitário do
          Tailwind têm a mesma especificidade, e a folha do pacote entra depois.
          Os 16px casam com a faixa de destinos logo acima, para que as duas
          bordas esquerdas se alinhem.
          
          A LACUNA É DO PACOTE: `Composer` publica o modificador `block` e a
          própria documentação dele manda o compositor ocupar a largura toda
          abaixo de 800px — nos dois casos a doca sem padding lateral cola o
          campo na borda do contêiner. O conserto de verdade é lá. */}
      <Composer.Dock className="shrink-0 !px-4">
        {decidido && !investigandoDeNovo ? (
          <Button variant="ghost" block onClick={() => setInvestigandoDeNovo(true)}>
            Continuar investigando
          </Button>
        ) : (
          // NÃO desabilita durante a consulta: o campo desabilitado comia as
          // teclas de quem escrevia enquanto o Cientista respondia, e a
          // pergunta sumia sem aviso. Só o envio espera — `enviar` devolve
          // cedo enquanto `ocupado`, e o indicador logo acima diz por quê.
          <Composer
            block
            hideLeadingActions
            value={texto}
            onValueChange={setTexto}
            onSend={enviar}
            disabled={bloqueio !== null}
            placeholder={
              bloqueio ??
              (semPerguntas
                ? 'Diga para onde vai cada equipe, ou escolha no mapa.'
                : 'Pergunte sobre a cidade, os bairros, as pessoas, o tempo ou os acessos…')
            }
            sendLabel="Enviar pergunta ao Cientista"
          />
        )}
      </Composer.Dock>
    </section>
  );
}
