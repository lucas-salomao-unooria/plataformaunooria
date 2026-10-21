import { Button, Icon } from '@edu/ui/ds-unooriaai';
import type { BairroPublico } from '../../lib/tipos';
import { TETO_DE_PERGUNTAS } from '../../lib/textos';
import type { RelogioPublico } from '../../lib/tipos';
import { MapaBase } from '../arte/mapa-base';

/**
 * O Briefing: uma tela só, e o menos texto possível.
 *
 * Ele lê 214 palavras antes de poder fazer qualquer coisa, com dois títulos
 * disputando o olho e cinco passos numerados — sendo que os três primeiros
 * eram a mesma atividade descrita três vezes. Um adolescente sob cronômetro lê
 * o primeiro, passa o olho no segundo e clica.
 *
 * O que ficou, e por quê:
 *
 * - UMA manchete só. O painel escuro carrega a história e o dilema juntos; a
 *   coluna da direita é só o passo a passo, sem título concorrente.
 * - O dilema virou coisa que se VÊ, não que se lê: quatro quarteirões e duas
 *   equipes, nas mesmas cores que o estudante vai reencontrar no mapa da tela
 *   seguinte — Alfa em azul, Bravo em roxo. Antes eram dois cartões com um
 *   número cada, e a frase que os liga em cinza de 11px.
 * - A cidade está ATRÁS da manchete: o mesmo terreno do mapa, sob a chuva. É
 *   cenário, não dado — nenhum bairro aparece nomeado, nada é revelado.
 * - TRÊS passos, não cinco, cada um com um ícone. Perguntar, escolher, mandar.
 * - Saiu daqui a lição da faixa ("entre 2.400 e 3.500 — quanto mais longe,
 *   menos certeza"). É o conceito mais difícil do produto e estava no item 2 de
 *   uma lista que ninguém termina, antes de o estudante ver um número. Ele aprende
 *   isso quando a primeira faixa aparece na tela, que é onde a frase tem o que
 *   apontar.
 * - Entraram as 3 Perguntas, que é a regra que mais aperta e não estava dita em
 *   lugar nenhum. Vem da constante: mudar o teto muda a tela.
 *
 * NADA aqui adianta o que os dados diriam: nem risco por bairro, nem população,
 * nem onde a chuva bate mais forte. Isso é o que a Investigação existe para
 * descobrir, e entregar de graça no briefing mataria a Missão.
 */
/**
 * Os três passos. Os ícones são do REGISTRO do pacote (`uaiIcons`), não
 * `<path>` desenhados aqui: desenhar à mão um substituto de ícone que o pacote
 * publica é proibido pelo DS (§7.4).
 *
 * `chats` é o ícone da coluna de exemplos — perguntar. `stars`, o das
 * capacidades — o que dá para fazer. `paperPlaneRight` é o envio do
 * compositor — mandar. Os três dizem o que o passo faz sem legenda.
 */
const PASSOS = [
  {
    titulo: 'Pergunte',
    texto: `Peça ao Cientista o que você quer saber sobre a cidade. São ${TETO_DE_PERGUNTAS} perguntas.`,
    icone: 'chats',
  },
  {
    titulo: 'Escolha',
    texto: 'Diga para onde vai a Equipe Alfa e para onde vai a Equipe Bravo.',
    icone: 'stars',
  },
  {
    titulo: 'Mande',
    texto: 'A tempestade acontece e você vê quantas pessoas foram resgatadas.',
    icone: 'paperPlaneRight',
  },
] as const;

const COR_EQUIPE = {
  alfa: 'var(--uai-status-info)',
  bravo: 'var(--uai-bg-brand)',
} as const;

export function Abertura({
  relogio,
  chamada,
  bairros,
  onComecar,
}: {
  relogio: RelogioPublico;
  chamada: string;
  contexto: string;
  /**
   * Os bairros vêm do MAPA servido pela api, não de uma constante local: o
   * briefing desenha um quarteirão por bairro e o estudante CONTA quatro em vez de
   * ler um "4". Uma cópia da ficha no cliente seria uma segunda fonte da
   * verdade sobre quantos bairros a cidade tem.
   */
  bairros: BairroPublico[];
  onComecar: () => void;
}) {
  const minutos = Math.round(relogio.duracaoSeg / 60);
  const tempo =
    relogio.modo === 'livre'
      ? 'Sem tempo marcado: a investigação vai até o professor encerrar.'
      : relogio.iniciadoEm
        ? `Você tem ${minutos} minutos, e o relógio já está correndo.`
        : `Você tem ${minutos} minutos, a partir de quando o professor liberar.`;

  return (
    // A linha do grid é NO MÍNIMO o conteúdo e cresce até preencher a tela: só
    // "preencher" cortava a manchete numa tela de 1024 px, e só "conteúdo"
    // deixava um terço de tela vazio numa de 1366.
    <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(min-content,1fr)] gap-5 overflow-y-auto p-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      {/* A história e o dilema no mesmo painel, com a cidade atrás. */}
      {/* `data-uai-theme="dark"` em vez de inverter cor a cor: o pacote já
          espelha a escada translúcida e os cinzas de texto no tema escuro, e é
          isso que faz a chuva e os contornos translúcidos existirem sem nenhum
          rgba escrito à mão. No escuro da `unooriaai` o painel é roxo profundo
          (`brandpurple-900`), não grafite. */}
      <section
        data-uai-theme="dark"
        className="relative flex flex-col justify-center gap-6 overflow-hidden rounded-uai-2xl bg-uai-fundo p-6 text-uai-tinta lg:gap-7 lg:p-8"
      >
        {/* O terreno do mapa, apagado: é a mesma cidade que ele vai investigar
            daqui a um clique, vista de longe e sob a chuva. Cenário, não dado. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.14] mix-blend-screen saturate-0 [&_text]:hidden"
        >
          <MapaBase />
        </div>
        {/* A tempestade chegando pelo canto: um brilho frio de cima e a chuva
            caindo em diagonal. Some com prefers-reduced-motion (globals.css). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(70% 60% at 85% -10%, color-mix(in srgb, var(--uai-status-info) 35%, transparent), transparent 70%)',
          }}
        />
        {/* `fill-2`, e não `fill-4`: a escada da `unooriaai` é mais forte que
            a da `chatgpt` (5/10/20/30% contra 2/4/8/10%), e a chuva medida no
            briefing era a 4%. O degrau mais próximo é o de 5%. */}
        <div
          aria-hidden
          className="animate-chuva pointer-events-none absolute -inset-y-24 -inset-x-8"
          style={{
            backgroundImage:
              'repeating-linear-gradient(115deg, transparent 0, transparent 14px, var(--uai-fill-2) 14px, var(--uai-fill-2) 15px)',
          }}
        />
        {/* Escurece a base para o texto ganhar contraste sobre o mapa. A seção
            tem um véu só (roxo a 50%, da mesma tinta do fundo do painel), então
            a base parte do próprio fundo e passa pelo véu até sumir. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-uai-fundo via-uai-veu-escuro to-transparent"
        />

        <div className="relative">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-uai-info">
            <span className="inline-block h-2 w-2 animate-pulse rounded-uai-full bg-uai-alerta" />
            Defesa Civil de Serra do Sauá · 17h00
          </p>
          <h1 className="mt-3 max-w-xl text-3xl font-bold leading-[1.1] tracking-tight xl:text-[2.75rem]">
            {chamada}
          </h1>
        </div>

        <div className="relative rounded-uai-2xl border border-uai-borda bg-uai-fill-8 p-5 backdrop-blur-sm lg:p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            {/* Os quarteirões: quatro, e o estudante CONTA — não lê um "4". */}
            <div>
              <div className="flex gap-2">
                {bairros.map((b) => (
                  <span
                    key={b.slug}
                    className="grid h-12 w-12 place-items-center rounded-uai-md border border-uai-borda bg-uai-fill-10"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-6 w-6 fill-none stroke-uai-suave-80"
                      strokeWidth="1.8"
                    >
                      <path d="M3 21V9l9-6 9 6v12M9 21v-6h6v6" />
                    </svg>
                  </span>
                ))}
              </div>
              <p className="mt-2 text-sm text-uai-suave-60">
                <strong className="text-2xl font-bold text-uai-tinta">
                  {bairros.length}
                </strong>{' '}
                bairros em risco
              </p>
            </div>
            {/* As equipes, nas cores que elas têm no mapa. O tema CLARO nas
                duas fichas é o que garante isso: as cores da equipe são token
                semântico, e no escuro do painel elas trocariam de degrau
                (azul e lilás claros) — o estudante veria aqui um par e no mapa
                outro. Com o claro, a letra é a tinta invertida (branca). */}
            <div>
              <div data-uai-theme="light" className="flex gap-2">
                {(['alfa', 'bravo'] as const).map((eq) => (
                  <span
                    key={eq}
                    style={{ backgroundColor: COR_EQUIPE[eq] }}
                    className="grid h-12 w-12 place-items-center rounded-uai-md text-lg font-bold text-uai-tinta-inv shadow-uai-overlay"
                  >
                    {eq === 'alfa' ? 'A' : 'B'}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-sm text-uai-suave-60">
                <strong className="text-2xl font-bold text-uai-tinta">2</strong> equipes para mandar
              </p>
            </div>
          </div>
          <p className="mt-5 max-w-md text-lg font-semibold leading-snug">
            Não dá para atender todos. Você escolhe quais dois recebem ajuda.
          </p>
        </div>

        {/* 80% e não 40%: sobre o escuro, a escada baixa do kit é para
            contorno e legenda, não para o parágrafo que um adolescente vai ler
            de longe, numa tela projetada. */}
        <p className="relative max-w-md leading-relaxed text-uai-suave-80">
          O Cientista de Dados mostra o que as informações da cidade dizem, e avisa quando não sabe.
          Ele não decide nada — quem decide é você.
        </p>
      </section>

      <aside className="flex flex-col gap-5 rounded-uai-2xl border border-uai-borda bg-uai-fundo p-5 lg:p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-uai-suave-40">
          Como funciona
        </p>

        <ol className="my-auto grid gap-2">
          {PASSOS.map((passo, i) => (
            <li key={passo.titulo} className="flex gap-3">
              <span className="flex flex-col items-center">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-uai-xl bg-uai-inverso text-uai-tinta-inv">
                  <Icon name={passo.icone} size={20} />
                </span>
                {i < PASSOS.length - 1 && <span className="my-1 w-px flex-1 bg-uai-borda" />}
              </span>
              <span className="pb-4 pt-1 leading-snug">
                <strong className="block text-uai-tinta">
                  <span className="mr-1.5 text-xs font-bold text-uai-suave-40">{i + 1}</span>
                  {passo.titulo}
                </strong>
                <span className="text-sm text-uai-suave-60">{passo.texto}</span>
              </span>
            </li>
          ))}
        </ol>

        {/* O relógio fica colado no botão: é a última coisa que ele lê antes de
            começar, e é a que muda o comportamento dele lá dentro. */}
        <p className="flex items-start gap-2.5 rounded-uai-xl bg-uai-superficie p-3 text-sm leading-snug text-uai-tinta">
          <svg
            viewBox="0 0 24 24"
            className="mt-0.5 h-4 w-4 shrink-0 fill-none stroke-uai-suave-60"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          {tempo}
        </p>

        {/* A seta é o `arrowForward` do registro da seção, no tamanho que o
            `Button` pede para o `lg` (24px). */}
        <Button
          size="lg"
          variant="secondary"
          block
          onClick={onComecar}
          trailingIcon={<Icon name="arrowForward" size={24} />}
        >
          Começar
        </Button>
      </aside>
    </div>
  );
}
