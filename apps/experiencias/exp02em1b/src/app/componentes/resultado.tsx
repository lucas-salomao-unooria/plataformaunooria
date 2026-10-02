import { Button, Tag } from '@edu/ui/ds-unooriaai';
import { useState } from 'react';
import { api } from '../../lib/api';
/**
 * Os tipos vêm do ESPELHO da api (`lib/tipos.ts`), não declarados aqui: no
 * projeto de origem este arquivo tinha os seus, e eles divergiram do que o
 * servidor mandava (`localidades` que não existia mais, `nome` da fonte que o
 * catálogo proíbe mostrar ao estudante).
 */
import type { Desfecho, MarcoDaTrilha, Tentativa } from '../../lib/tipos';
import { agruparEmpatados } from '../../lib/visao';
import { IconeDaFonte } from '../arte/icones';

const milhar = (n: number) => n.toLocaleString('pt-BR');

/**
 * O instante no CRONÔMETRO, que é o único relógio que o estudante vê: quanto ainda
 * faltava quando aquilo aconteceu.
 */
const cronometroEm = (minuto: number) => {
  const faltavam = Math.max(0, (60 - minuto) * 5);
  return `${Math.floor(faltavam / 60)}:${String(faltavam % 60).padStart(2, '0')}`;
};

/**
 * Cada Marco vira uma frase. O texto mora aqui, não no banco: o payload guarda
 * fato, e frase envelhece.
 */
function descreverMarco(m: MarcoDaTrilha): string {
  // `dados` é payload por TIPO de marco (ver `regras/trilha.ts` da api): o
  // acesso é por chave e cada ramo sabe o que espera encontrar.
  const d = m.dados as Record<string, unknown>;
  if (m.tipo === 'fontes') {
    return `Somou ${((d.rotulos ?? []) as string[]).join(' e ')}.`;
  }
  if (m.tipo === 'leitura') {
    const topo = ((d.topo ?? []) as { nome: string; esperado: number; margem: number }[]);
    const efeito =
      ((d.efeito ?? []) as { rotulo: string; bairro: string; de: number; para: number }[]);
    const conflitos = ((d.conflitos ?? []) as { nome: string }[]);
    const partes = [
      `Cruzou os dados: ${topo.map((t) => `${t.nome} ${milhar(t.esperado)} ±${milhar(t.margem)}`).join(' · ')}`,
    ];
    if (efeito[0]) {
      const e = efeito[0];
      partes.push(`${e.rotulo} mudou ${e.bairro} de ${milhar(e.de)} para ${milhar(e.para)}`);
    }
    if (conflitos.length > 0) {
      partes.push(`fontes em conflito sobre ${conflitos.map((c) => c.nome).join(', ')}`);
    }
    return partes.join(' — ') + '.';
  }
  if (m.tipo === 'alocacao') {
    return `Destinos: Alfa → ${(d.alfa as string) ?? 'base'} · Bravo → ${(d.bravo as string) ?? 'base'}.`;
  }
  const naoConsultados = ((d.naoConsultados ?? []) as string[]);
  return (
    `Enviou as equipes: ${milhar((d.salvas ?? 0) as number)} resgatadas, ${milhar((d.vitimas ?? 0) as number)} atingidas pela enchente.` +
    (naoConsultados.length > 0 ? ` Nunca consultou: ${naoConsultados.join(', ')}.` : '')
  );
}

/** Diferença com sinal: "+105", "−63", "igual". */
const delta = (n: number) => (n === 0 ? 'igual' : `${n > 0 ? '+' : '−'}${milhar(Math.abs(n))}`);

/**
 * Maiúscula inicial no código, não no CSS: `::first-letter` só vale em elemento
 * de bloco, e o rótulo é inline.
 */
const capitalizar = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

export interface DadosDoResultado {
  desfecho: Desfecho;
  esperado: {
    media: number;
    faixa: readonly [number, number];
    vitimasMedia: number;
    vitimasFaixa: readonly [number, number];
    /** Vinte corridas da MESMA decisão. É a variância vista, não afirmada. */
    amostras: number[];
  };
  /**
   * O que ele NUNCA consultou — a peça mais forte do fechamento. SEM o `nome`
   * técnico da fonte: o catálogo da api é explícito de que ele "aparece no
   * painel do professor, nunca para o estudante".
   */
  naoConsultados: {
    slug: string;
    comoFalar: string;
    rotuloCurto: string;
    serve: string;
  }[];
  tentativas?: Tentativa[];
  /**
   * O que ele enxergava quando decidiu, bairro a bairro. Vem do mapa: o marco
   * de leitura só existe quando o Cientista chegou a rodar o modelo naquela
   * pergunta, e sem esta segunda fonte o empate — que é o que dá consequência
   * à margem — simplesmente não aparecia na maioria das rodadas.
   */
  leitura?: { nome: string; esperado: number; margem: number }[];
  /**
   * O maior bolsão de gente que ficou sem equipe, e a fonte que o enxergaria.
   * Fato, não veredito: o estudante terminava sem conseguir dizer o que aconteceu
   * com quem ele não atendeu.
   */
  sobrou?: { nome: string; pessoas: number; fonte: string | null } | null;
  /** A trilha da decisão: como ele chegou aqui, e não só onde chegou. */
  trilha?: MarcoDaTrilha[];
}

/**
 * A NUVEM: vinte corridas da mesma decisão, e a desta rodada entre elas.
 *
 * É a única parte da tela que ensina probabilidade por experiência em vez de
 * afirmação. Enquanto o número da rodada era a manchete e a faixa vinha depois
 * em cinza, a hierarquia visual dizia "isto é a sua nota" e o texto dizia o
 * contrário — e quem ganha essa disputa é sempre o tamanho da fonte.
 */
function Nuvem({ amostras, atual }: { amostras: number[]; atual: number }) {
  const todos = [...amostras, atual];
  const min = Math.min(...todos);
  const max = Math.max(...todos);
  const vao = Math.max(1, max - min);
  const posicao = (n: number) => ((n - min) / vao) * 100;

  return (
    <div className="mt-4 max-w-2xl">
      <div className="relative h-16">
        <div className="absolute inset-x-0 top-9 h-px bg-uai-borda" />
        {amostras.map((n, i) => (
          <span
            key={i}
            title={`${milhar(n)} nesta corrida`}
            className="absolute top-7 h-2 w-2 -translate-x-1/2 rounded-uai-full bg-uai-borda"
            style={{ left: `${posicao(n)}%` }}
          />
        ))}
        <span
          className="absolute top-3 h-10 w-1 -translate-x-1/2 rounded-uai-full bg-uai-inverso"
          style={{ left: `${posicao(atual)}%` }}
        />
        <span
          className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-xs font-bold text-uai-tinta"
          style={{ left: `${posicao(atual)}%` }}
        >
          esta rodada
        </span>
      </div>
      <div className="flex justify-between text-xs tabular-nums text-uai-suave-60">
        <span>{milhar(min)}</span>
        <span>{milhar(max)}</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-uai-suave-60">
        Cada bolinha é a mesma decisão simulada de novo, contra a mesma tempestade. Não existe
        resultado certo: o seu é um deles.
      </p>
    </div>
  );
}

/**
 * O EMPATE que os dados não desfaziam.
 *
 * A margem só vira decisão quando o estudante vê o que ela escondia: dois bairros
 * que a leitura não separava, e o número que a tempestade acabou revelando.
 * Sem isto, ignorar o ± não custa nada — e o estudante aprende a pular o ±.
 */
function Empates({
  topo,
  porBairro,
}: {
  topo: { nome: string; esperado: number; margem: number }[];
  porBairro: { nome: string; emRisco: number }[];
}) {
  // A MESMA regra do cartão da investigação (agruparEmpatados): empata com o
  // maior do grupo, não com o vizinho. Duas leituras de empate na mesma Missão
  // fariam a tela final desmentir o que ele leu enquanto decidia.
  const grupos = agruparEmpatados(
    topo.map((t) => ({
      chave: t.nome,
      esperado: t.esperado,
      min: t.esperado - t.margem,
      max: t.esperado + t.margem,
      margem: t.margem,
    })),
  );
  // SÓ o grupo do topo. O segundo grupo é um empate entre bairros pequenos, que
  // não estavam disputando a decisão de ninguém — mostrá-lo transformava o
  // bloco numa segunda tabela e enterrava o empate que importa.
  const grupo = grupos[0];
  if (!grupo) return null;

  const real = (nome: string) => porBairro.find((b) => b.nome === nome)?.emRisco ?? null;

  return (
    <div className="mt-6 max-w-3xl rounded-uai-xl border border-uai-borda p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-uai-suave-60">
        O que os dados não separavam
      </p>
      {(() => {
        const comReal = grupo
          .map((g) => ({ ...g, real: real(g.chave) }))
          .filter((g) => g.real !== null);
        const maior = [...comReal].sort((a, b) => b.real! - a.real!)[0];
        return (
          <div className="mt-3 text-sm leading-snug">
            <p className="text-uai-tinta">
              {grupo.map((g, i) => (
                <span key={g.chave}>
                  {i > 0 && (i === grupo.length - 1 ? ' e ' : ', ')}
                  <strong>{g.chave}</strong> ({milhar(g.esperado)} ± {milhar(g.margem)})
                </span>
              ))}{' '}
              podiam ser o maior — os dados não separavam.
            </p>
            {maior && (
              <p className="mt-1 text-uai-suave-60">
                Na tempestade:{' '}
                {comReal.map((g, i) => (
                  <span key={g.chave}>
                    {i > 0 && ', '}
                    {g.chave} com {milhar(g.real!)}
                  </span>
                ))}
                . O maior foi {maior.chave}.
              </p>
            )}
          </div>
        );
      })()}
    </div>
  );
}

/**
 * "E se eu tivesse mandado para ___?"
 *
 * A mesma tempestade, na mesma hora, com outro destino. Existe porque o estudante
 * lê a tabela, vê um bairro grande sem equipe e não tem como saber o que teria
 * mudado — então guarda o resultado como acaso, em vez de método.
 *
 * A conta é do servidor: aqui só entram nomes e números.
 */
function Contrafactual({
  bairros,
  alocacao,
  salvasReais,
}: {
  bairros: { slug: string; nome: string }[];
  alocacao: { alfa: string | null; bravo: string | null };
  salvasReais: number;
}) {
  const [escolha, setEscolha] = useState(alocacao);
  const [conta, setConta] = useState<{ salvas: number; faixa: [number, number] } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const mudou = escolha.alfa !== alocacao.alfa || escolha.bravo !== alocacao.bravo;

  async function perguntar() {
    setOcupado(true);
    setErro(null);
    try {
      // Não grava e não debita: é a pergunta que o estudante faz ao VER o
      // resultado, e transformá-la em tentativa nova apagaria a diferença
      // entre a decisão que ele tomou e a que imaginou depois.
      const r = await api.post<{ media: number; faixa: readonly [number, number] }>(
        '/unoogpt/contrafactual',
        escolha,
      );
      setConta({ salvas: r.media, faixa: [r.faixa[0], r.faixa[1]] });
    } catch {
      setErro('Não deu para calcular agora.');
    } finally {
      setOcupado(false);
    }
  }

  const nome = (slug: string | null) => bairros.find((b) => b.slug === slug)?.nome ?? 'base';

  return (
    <div className="mt-6 max-w-3xl rounded-uai-xl border border-uai-borda p-5">
      <p className="font-semibold text-uai-tinta">E se você tivesse mandado para outro lugar?</p>
      <p className="mt-1 text-sm text-uai-suave-60">
        Mesma tempestade, mesma hora de saída. Só o destino muda.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(['alfa', 'bravo'] as const).map((equipe) => (
          <label key={equipe} className="text-sm">
            <span className="text-xs uppercase tracking-wider text-uai-suave-60">
              Equipe {equipe}
            </span>
            <select
              value={escolha[equipe] ?? ''}
              onChange={(e) => {
                setEscolha((x) => ({ ...x, [equipe]: e.target.value || null }));
                setConta(null);
              }}
              className="mt-1 w-full rounded-uai-md border border-uai-borda bg-uai-fundo p-2 text-sm text-uai-tinta"
            >
              <option value="">Fica na base</option>
              {bairros.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.nome}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <Button variant="secondary" className="mt-4" onClick={perguntar} disabled={ocupado || !mudou}>
        {mudou ? 'Ver o que teria acontecido' : 'Escolha outro destino'}
      </Button>

      {erro && <p className="mt-3 text-sm text-uai-erro">{erro}</p>}

      {conta && (
        <div className="mt-4 rounded-uai-xl bg-uai-superficie p-4 text-sm leading-relaxed text-uai-tinta">
          Com Alfa em <strong>{nome(escolha.alfa)}</strong> e Bravo em{' '}
          <strong>{nome(escolha.bravo)}</strong>, esta mesma tempestade teria dado{' '}
          <strong>{milhar(conta.salvas)}</strong> resgatadas — contra {milhar(salvasReais)} do que
          você mandou. Essa outra decisão costuma ficar entre {milhar(conta.faixa[0])} e{' '}
          {milhar(conta.faixa[1])}: um número só continua não sendo prova.
        </div>
      )}
    </div>
  );
}

/**
 * Passo 4: o Resultado. É TELA, não cartão perdido na conversa — é o fim da
 * Missão, e o estudante precisa poder olhar para ele.
 *
 * NÃO existe nota, acerto ou erro. A frase que fecha é sempre a mesma: não
 * havia resposta certa. Quem dá o sentido é o professor, no debate; o software
 * entrega os fatos da rodada e cala a boca.
 */
export function Resultado({
  desfecho,
  esperado,
  naoConsultados,
  tentativas,
  trilha,
  leitura,
  sobrou,
  onRecomecar,
  ocupado,
}: DadosDoResultado & { onRecomecar?: () => void; ocupado?: boolean }) {
  // Qual rodada está na tela. A última é a que acabou de acontecer; as
  // anteriores continuam abertas, porque comparar decisões é a Missão.
  const rodadas = tentativas ?? [];
  const [vendo, setVendo] = useState<number | null>(null);
  const emCartaz = rodadas.find((t) => t.ordem === vendo);

  // A rodada imediatamente anterior à que está na tela: é com ela que os
  // números se comparam. Sem referência, "2.485" não é bom nem ruim.
  const indice = rodadas.findIndex(
    (t) => t.ordem === (vendo ?? rodadas[rodadas.length - 1]?.ordem),
  );
  const anterior = indice > 0 ? rodadas[indice - 1] : null;

  // A trilha da rodada que está na tela: trocar de rodada troca a história.
  const rodadaNaTela = vendo ?? rodadas[rodadas.length - 1]?.ordem ?? 1;
  const trilhaDaRodada = (trilha ?? []).filter((m) => m.tentativa === rodadaNaTela);

  // O último cruzamento que ele fez ANTES de mandar: é a leitura sobre a qual
  // ele decidiu, e é ela que o empate precisa citar.
  const leituras = trilhaDaRodada.filter((m) => m.tipo === 'leitura');
  const doMarco =
    (
      leituras[leituras.length - 1]?.dados as {
        topo?: { nome: string; esperado: number; margem: number }[];
      }
    )?.topo ?? [];
  // O marco de leitura só nasce quando o Cientista rodou o modelo naquela
  // pergunta. Quando ele não rodou, a leitura é a do mapa — que é o que o
  // estudante tinha na frente quando decidiu.
  const empateNaTela = doMarco.length > 0 ? doMarco : (leitura ?? []);

  const desfechoNaTela = emCartaz?.desfecho ?? desfecho;
  const esperadoNaTela = emCartaz?.esperado ?? esperado;
  const { totais, porBairro } = desfechoNaTela;
  const acimaDaMedia = totais.salvas >= esperadoNaTela.media;
  const sozinhas = totais.emRisco - totais.salvas - totais.vitimas;

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-y-auto p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wider text-uai-suave-40">
          A tempestade passou por Serra do Sauá
        </p>

        {/* O Recomeçar mora aqui, não numa barra própria: no Resultado aquela
            barra ficava vazia e virava uma faixa branca no alto da tela. */}
        <div className="flex items-center gap-2">
          {rodadas.length > 1 && (
            <div className="flex items-center gap-1 rounded-uai-md bg-uai-superficie p-1">
              {rodadas.map((t) => {
                const atual = t.ordem === (vendo ?? rodadas[rodadas.length - 1]!.ordem);
                return (
                  // Cápsula selecionável: é o `Tag` do arquivo de design, no
                  // mesmo papel de "escolha uma destas".
                  <Tag
                    key={t.ordem}
                    selected={atual}
                    glyph={null}
                    onClick={() =>
                      setVendo(t.ordem === rodadas[rodadas.length - 1]!.ordem ? null : t.ordem)
                    }
                  >
                    Rodada {t.ordem} · {milhar(t.salvas)}
                  </Tag>
                );
              })}
            </div>
          )}
          {onRecomecar && (
            <Button variant="outline" size="sm" onClick={onRecomecar} disabled={ocupado}>
              Tentar de novo
            </Button>
          )}
        </div>
      </div>

      {/* O FATO que fechava a Missão sem resposta: o estudante saía sem conseguir
          dizer o que tinha acontecido com quem ele não atendeu, entre quatro
          leituras do mesmo número. Aqui não há nota nem veredito — há um bairro,
          um número de pessoas e a fonte que ele não abriu. O sentido disso é do
          professor, no debate (regra de ouro 2). */}
      {sobrou && vendo === null && (
        <p className="mt-4 max-w-2xl rounded-uai-xl border-l-4 border-uai-alerta bg-uai-superficie p-4 leading-relaxed text-uai-tinta">
          <strong>
            {milhar(sobrou.pessoas)} pessoas ficaram sem equipe em {sobrou.nome}.
          </strong>
          {sobrou.fonte && (
            <span className="block text-sm text-uai-suave-60">
              Você nunca consultou {sobrou.fonte} — é a fonte que mais enxerga esse bairro.
            </span>
          )}
        </p>
      )}

      {/* A FAIXA É A MANCHETE, e o número desta rodada mora dentro dela.
          Invertido — número gigante em cima, faixa em cinza no rodapé — a tela
          ensinava o oposto do texto: que 1.345 era uma nota. É placar contra
          distribuição, e ganha quem tiver a fonte maior. */}
      <div className="mt-5 max-w-2xl">
        <p className="text-sm text-uai-suave-60">
          Mandando as equipes para os mesmos bairros, o resultado quase sempre fica entre
        </p>
        <p className="mt-1 flex flex-wrap items-baseline gap-3 text-5xl font-bold tracking-tight text-uai-tinta">
          {milhar(esperadoNaTela.faixa[0])}
          <span className="text-2xl text-uai-suave-60">e</span>
          {milhar(esperadoNaTela.faixa[1])}
          <span className="text-base font-semibold text-uai-suave-60">pessoas resgatadas</span>
        </p>

        {esperadoNaTela.amostras?.length > 0 && (
          <Nuvem amostras={esperadoNaTela.amostras} atual={totais.salvas} />
        )}

        <p className="mt-3 text-lg text-uai-tinta">
          Desta vez foram <strong className="text-uai-ok">{milhar(totais.salvas)}</strong> —{' '}
          {acimaDaMedia ? 'acima' : 'abaixo'} do meio da faixa.
          {anterior && (
            <span className="text-uai-suave-60">
              {' '}
              {delta(totais.salvas - anterior.salvas)} vs rodada {anterior.ordem}.
            </span>
          )}
        </p>
      </div>

      <div className="mt-6 grid max-w-3xl grid-cols-2 gap-6">
        <div>
          <p className="text-3xl font-bold tracking-tight text-uai-erro">
            {milhar(totais.vitimas)}
          </p>
          <p className="mt-1 text-sm text-uai-suave-60">atingidas pela enchente</p>
          {anterior && (
            <p
              className={`mt-0.5 text-sm font-semibold ${
                totais.vitimas <= anterior.vitimas ? 'text-uai-ok' : 'text-uai-erro'
              }`}
            >
              {delta(totais.vitimas - anterior.vitimas)} vs rodada {anterior.ordem}
            </p>
          )}
        </div>
        <div>
          <p className="text-3xl font-bold tracking-tight text-uai-suave-60">{milhar(sozinhas)}</p>
          <p className="mt-1 text-sm text-uai-suave-60">sobreviveram sem ajuda</p>
          {anterior && (
            <p className="mt-0.5 text-sm text-uai-suave-60">
              {delta(sozinhas - (anterior.emRisco - anterior.salvas - anterior.vitimas))} vs rodada{' '}
              {anterior.ordem}
            </p>
          )}
        </div>
      </div>

      {/* A conta precisa fechar na tela: tabela que não fecha parece defeito, e
          o estudante para de confiar no resto dos números. */}
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-uai-suave-60">
        {milhar(totais.emRisco)} pessoas estavam em risco. Estar em risco não é ser atingido: a
        maioria conseguiu se proteger sem que uma equipe chegasse até ela. A simulação conta
        quantas pessoas a enchente atingiu, sem dizer que tipo de perda cada uma teve.
      </p>

      {/* COMO ele chegou aqui. O resto da tela responde "o que aconteceu"; sem
          isto, ninguém no debate consegue perguntar por que ele escolheu estes
          dois bairros, e decidir fica indistinguível de chutar. */}
      {trilhaDaRodada.length > 0 && (
        <div className="mt-6 max-w-3xl rounded-uai-xl border border-uai-borda p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-uai-suave-60">
            Como você decidiu <span className="font-normal normal-case">· tempo que faltava</span>
          </p>
          <ol className="mt-3 grid gap-2.5">
            {trilhaDaRodada.map((m) => (
              <li key={`${m.tentativa}-${m.ordem}`} className="flex gap-3 text-sm leading-snug">
                <span className="w-12 shrink-0 tabular-nums text-uai-suave-60">
                  {cronometroEm(m.minuto)}
                </span>
                <span className="text-uai-tinta">{descreverMarco(m)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* A faixa subiu para a manchete; o empate é o que faz a margem custar
          alguma coisa. Sem ele, ignorar o ± não tem consequência nenhuma. */}
      {empateNaTela.length > 0 && <Empates topo={empateNaTela} porBairro={porBairro} />}

      <table className="mt-8 w-full max-w-3xl border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-uai-borda text-xs uppercase tracking-wider text-uai-suave-60">
            <th className="pb-3">Bairro</th>
            <th className="px-3 pb-3 text-right">Em risco</th>
            <th className="px-3 pb-3 text-right">Tiradas</th>
            <th className="px-3 pb-3 text-right">Sem ajuda</th>
            <th className="px-3 pb-3 text-right">Atingidas</th>
            <th className="pb-3 pl-8">Equipe</th>
          </tr>
        </thead>
        <tbody>
          {porBairro.map((b) => (
            <tr key={b.bairro} className="border-b border-uai-borda">
              <td className="py-3">
                <span className="font-semibold text-uai-tinta">{b.nome}</span>
                {b.severo && <span className="ml-2 text-xs text-uai-erro">atingido com força</span>}
              </td>
              <td className="px-3 py-3 text-right text-uai-tinta">{milhar(b.emRisco)}</td>
              <td className="px-3 py-3 text-right font-semibold text-uai-ok">{milhar(b.salvas)}</td>
              <td className="px-3 py-3 text-right text-uai-suave-60">
                {milhar(b.emRisco - b.salvas - b.vitimas)}
              </td>
              <td className="px-3 py-3 text-right font-semibold text-uai-erro">
                {milhar(b.vitimas)}
              </td>
              {/* Quebra, não trunca: em 1512px a frase da via cortava seco no
                  meio da palavra, sem reticências e sem jeito de ler o resto. */}
              <td className="min-w-[13rem] py-3 pl-8 text-xs leading-snug text-uai-suave-60">
                {!b.equipe && '—'}
                {b.equipe && b.chegou && !b.motivo && (
                  <span className="text-uai-ok">chegou a tempo</span>
                )}
                {b.equipe && b.chegou && b.motivo && (
                  <span className="text-uai-alerta">{b.motivo}</span>
                )}
                {b.equipe && !b.chegou && <span className="text-uai-erro">{b.motivo}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {naoConsultados.length > 0 && (
        <div className="mt-10 max-w-3xl rounded-uai-xl border border-uai-borda p-6">
          <p className="font-semibold text-uai-tinta">O que você não consultou</p>
          <p className="mt-1 text-sm text-uai-suave-60">
            Estava disponível a missão inteira. Cada uma mostraria um pedaço diferente da cidade.
          </p>
          <ul className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {naoConsultados.map((c) => (
              <li key={c.slug} className="flex gap-3">
                <IconeDaFonte slug={c.slug} />
                <span className="text-sm leading-snug">
                  <strong className="text-uai-tinta">
                    {capitalizar(c.rotuloCurto ?? c.comoFalar)}
                  </strong>
                  <span className="block text-xs text-uai-suave-60">{c.serve}</span>
                </span>
              </li>
            ))}
          </ul>
          {/* O catálogo não é o mundo: fora dele ainda existiriam outras fontes,
              e é assim em qualquer decisão real. */}
          <p className="mt-5 text-sm leading-relaxed text-uai-suave-60">
            E muitas outras fontes, dado nenhum cobre tudo.
          </p>
        </div>
      )}

      {/* Só na rodada mais recente: o servidor recalcula sobre a tempestade da
          última simulação, e oferecer isto numa rodada antiga responderia a
          pergunta com a tempestade errada. */}
      {vendo === null && (
        <Contrafactual
          bairros={porBairro.map((b) => ({ slug: b.bairro, nome: b.nome }))}
          alocacao={{
            alfa: porBairro.find((b) => b.equipe === 'alfa')?.bairro ?? null,
            bravo: porBairro.find((b) => b.equipe === 'bravo')?.bairro ?? null,
          }}
          salvasReais={totais.salvas}
        />
      )}

      {/* Uma rodada só ensina que aconteceu; duas ensinam que podia ter sido
          diferente. Recomeçar é livre e precisa ser dito aqui, no momento em
          que o estudante tem um número na mão para comparar. */}
      <p className="mt-8 max-w-2xl text-sm text-uai-suave-60">
        Guarde o que você decidiu e por quê — a conversa sobre o que isso significa acontece na
        aula.
      </p>
    </section>
  );
}

/** Reexportados: `unoogpt-app` importa daqui junto de `DadosDoResultado`. */
export type { MarcoDaTrilha, Tentativa };
