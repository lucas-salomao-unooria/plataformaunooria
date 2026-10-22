import "./guia.css";

import type { ReactNode } from "react";

import { Badge, Icon, ScrollBar, Tag } from "@edu/ui/ds";
import { LinkButton } from "@/components/link-button";
import { Trilha, type ItemDaTrilha } from "@/components/trilha";
import {
  ROTULO_DO_NIVEL,
  TEMPOS_DO_GUIA,
  type AvisoDoGuia,
  type BlocosVivos,
  type GuiaDaAula as Guia,
  type NivelDaPergunta,
  type PassoDePreparo,
  type SecaoDoGuia,
} from "@/lib/entre-redes/guias/tipos";

import { BotaoImprimir } from "./botao-imprimir";
import { TemposDoGuia } from "./tempos-do-guia";

/**
 * O renderizador ÚNICO do guia da aula.
 *
 * Toda missão do Entre Redes lê o guia dela na mesma ordem e nos mesmos quatro
 * TEMPOS — Preparar, Conduzir, Fechar, Consultar (ADR-182) —, porque a segunda
 * missão que o professor roda tem de ter a informação no mesmo lugar da
 * primeira. Quem escreve a ordem e os tempos é este arquivo (com
 * `TEMPOS_DO_GUIA`); quem escreve o conteúdo é `lib/entre-redes/guias/<exp>.ts`.
 *
 * **Densidade, não corte.** O guia corrido media 8 a 17 mil pixels e a queixa
 * dos professores era "muita informação". Nenhum texto saiu: cada tempo é uma
 * aba, o topo resume a aula em números calculados do próprio guia, e a forma de
 * cada seção segue o que ela é — o roteiro é uma linha do tempo, a pergunta do
 * debate vai numa lousa, a mediação é uma grade de situações, os dois preparos
 * ficam lado a lado. Cartão só onde há ITEM (uma situação, uma adaptação), não
 * em volta de toda seção.
 *
 * O que não cabe em dado entra por `blocos`: um `ReactNode` ancorado ao fim de
 * uma seção, montado pela página da missão a partir de fonte viva. Ver a nota
 * em `guias/tipos.ts` sobre por que esses não viram texto.
 */

/** O rótulo de cada seção no índice e no `h2`. */
const TITULO_DA_SECAO: Record<SecaoDoGuia, string> = {
  objetivos: "O que a turma aprende",
  antes: "Antes da aula",
  cuidados: "Cuidados",
  roteiro: "Roteiro da aula",
  debate: "Perguntas para o debate",
  mediacao: "Mediação — o que fazer quando",
  depois: "Depois da aula",
  adaptacoes: "Adaptações",
  duvidas: "Dúvidas frequentes",
};

const ORDEM_DOS_NIVEIS: NivelDaPergunta[] = ["retomada", "analise", "generalizacao", "transferencia"];

/** O glifo de cada tom de aviso. A cor sai do token do DS, pela prop `color` do `Icon` (a classe perde para a folha do DS). */
const ICONE_DO_AVISO: Record<AvisoDoGuia["tom"], { nome: string; cor: string; rotulo: string }> = {
  error: { nome: "block", cor: "var(--unooria-color-danger-600, #c62828)", rotulo: "Não faça" },
  warning: { nome: "warning", cor: "var(--unooria-color-warning-700, #8a5a00)", rotulo: "Atenção" },
  info: { nome: "info", cor: "var(--unooria-color-brandnavy-800, #49699f)", rotulo: "Para saber" },
};

export function GuiaDaAula({
  guia,
  trilha,
  cabecalho,
  voltar,
  blocos,
}: {
  guia: Guia;
  trilha: ItemDaTrilha[];
  cabecalho: {
    /** O nome da missão. */
    missao: string;
    /** "8º ano · Unidade 1" ou "Missão transversal". */
    contexto: string;
    /** A duração da ficha do catálogo — não repetida no guia. */
    duracao: string;
  };
  voltar: { href: string; rotulo: string };
  blocos?: BlocosVivos;
}) {
  /* O resumo do topo é CONTADO do guia, nunca digitado (a regra dos números do
     guia, ADR-86): o professor lê "6 momentos · 1 botão seu" e sabe o tamanho
     da aula antes de abrir uma aba. */
  const botoes = [...new Set(guia.roteiro.linhas.map((l) => l.botao).filter(Boolean))];
  const principal = guia.bncc.find((h) => h.principal) ?? guia.bncc[0];

  const secao = (id: SecaoDoGuia, conteudo: ReactNode) => (
    <Secao key={id} id={id} blocos={blocos}>
      {conteudo}
    </Secao>
  );

  const paineis: Record<string, ReactNode> = {
    preparar: (
      <>
        {secao("objetivos", <Objetivos guia={guia} />)}
        {secao("antes", <Antes guia={guia} />)}
        {secao("cuidados", <ListaCorrida itens={guia.cuidados} />)}
      </>
    ),
    conduzir: (
      <>
        {secao("roteiro", <Roteiro guia={guia} />)}
        {secao("debate", <Debate guia={guia} />)}
        {secao("mediacao", <Mediacao guia={guia} />)}
      </>
    ),
    fechar: <>{secao("depois", <Depois guia={guia} />)}</>,
    consultar: (
      <>
        {secao("adaptacoes", <Adaptacoes guia={guia} />)}
        {secao("duvidas", <Duvidas guia={guia} />)}
      </>
    ),
  };

  return (
    <div className="guia flex flex-col gap-6">
      <div className="guia-fora-do-papel">
        <Trilha itens={trilha} />
      </div>

      {/*
        `div`, e não `header`: a folha de impressão esconde `header` para tirar
        o cromo da plataforma, e o cabeçalho do guia é a primeira coisa que a
        folha precisa ter.
      */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex max-w-3xl flex-col gap-1.5">
            <p className="text-[13px] font-semibold text-unooria-neutral-500">
              {cabecalho.missao} · {cabecalho.contexto}
            </p>
            <h1 className="text-[28px] font-bold leading-tight text-unooria-neutral-950">Guia da aula</h1>
            <p className="text-[15px] leading-relaxed text-unooria-neutral-700">{guia.chamada}</p>
          </div>
          <div className="guia-fora-do-papel flex items-center gap-2">
            <BotaoImprimir />
            <LinkButton href={voltar.href} variant="outline" size="sm">
              {voltar.rotulo}
            </LinkButton>
          </div>
        </div>

        <ul className="guia-resumo" aria-label="A aula em números">
          <li>
            <Tag variant="neutral" size="md" leftIcon="schedule">
              {cabecalho.duracao}
            </Tag>
          </li>
          <li>
            <Tag variant="neutral" size="md" leftIcon="timeline">
              {guia.roteiro.linhas.length} momentos no roteiro
            </Tag>
          </li>
          <li>
            <Tag variant="neutral" size="md" leftIcon="touch_app">
              {botoes.length === 0
                ? "Nenhum botão seu durante a aula"
                : `${botoes.length} ${botoes.length === 1 ? "botão seu" : "botões seus"}: ${botoes.join(", ")}`}
            </Tag>
          </li>
          {principal ? (
            <li>
              <Tag variant="success" size="md" leftIcon="school">
                {principal.codigo} · {principal.eixo}
              </Tag>
            </li>
          ) : null}
        </ul>
      </div>

      {guia.avisos?.length ? <Avisos avisos={guia.avisos} /> : null}

      <TemposDoGuia
        tempos={TEMPOS_DO_GUIA.map((tempo) => ({
          id: tempo.id,
          rotulo: tempo.rotulo,
          quando: tempo.quando,
          icone: tempo.icone,
          secoes: tempo.secoes.map((id) => ({ id, titulo: TITULO_DA_SECAO[id] })),
        }))}
        paineis={paineis}
      />

      <p className="guia__rodape-do-papel hidden">
        Guia da aula · {cabecalho.missao} · {cabecalho.contexto} — Plataforma Unooria, Entre Redes. Impresso da tela
        do professor.
      </p>
    </div>
  );
}

/* ---- topo ----------------------------------------------------------------- */

/**
 * Os avisos que decidem a aula, num bloco só. Eram três `FeedbackAlert` de
 * largura cheia empilhados — três faixas coloridas gritando antes de qualquer
 * conteúdo. Agora o tom vive no ÍCONE (com nome acessível) e o bloco é um.
 */
function Avisos({ avisos }: { avisos: AvisoDoGuia[] }) {
  return (
    <section className="guia-bloco guia-avisos" aria-labelledby="guia-avisos-titulo">
      <h2 id="guia-avisos-titulo" className="text-[15px] font-bold text-unooria-neutral-950">
        {avisos.length === 1 ? "Antes de tudo" : `Antes de tudo: ${avisos.length} coisas que decidem a aula`}
      </h2>
      <ul className="guia-avisos__lista" data-avisos={avisos.length}>
        {avisos.map((aviso) => {
          const icone = ICONE_DO_AVISO[aviso.tom];
          return (
            <li key={aviso.titulo} className="guia-avisos__item" data-tom={aviso.tom}>
              <Icon name={icone.nome} size="m" color={icone.cor} aria-label={icone.rotulo} />
              <div className="flex flex-col gap-1">
                <p className="text-[14px] font-semibold leading-snug text-unooria-neutral-950">{aviso.titulo}</p>
                <p className="text-[13px] leading-relaxed text-unooria-neutral-700">{aviso.texto}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---- Preparar --------------------------------------------------------------- */

function Objetivos({ guia }: { guia: Guia }) {
  return (
    <>
      <ul className="guia-objetivos">
        {guia.objetivos.map((objetivo) => (
          <li key={objetivo}>
            <Icon name="check_circle" size="s" color="var(--unooria-color-success-700, #1b7a4a)" aria-hidden />
            <span>{objetivo}</span>
          </li>
        ))}
      </ul>

      <div className="guia-bloco guia-bloco--longo flex flex-col gap-3">
        <h3 className="guia-h3">Alinhamento com a BNCC — Computação</h3>
        <p className="guia-nota">
          Habilidades do <em>Complemento de Computação à BNCC</em> (MEC, 2022), com o texto oficial. O que vem em
          destaque é nosso: onde, na missão, a habilidade acontece de fato.{" "}
          <strong>Confira com a coordenação antes de colar no plano de curso</strong> — o recorte é uma proposta
          nossa, não uma classificação oficial da missão.
        </p>
        <ul className="guia-bncc">
          {guia.bncc.map((habilidade) => (
            <li key={habilidade.codigo} className="guia-bncc__item">
              <div className="guia-bncc__codigo">
                <Tag variant={habilidade.principal ? "success" : "neutral"} size="sm">
                  {habilidade.codigo}
                </Tag>
                <span className="text-[11px] leading-tight text-unooria-neutral-500">{habilidade.eixo}</span>
                {habilidade.principal ? (
                  <span className="text-[11px] font-semibold text-unooria-neutral-700">principal</span>
                ) : null}
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-[14px] leading-relaxed text-unooria-neutral-800">{habilidade.ondeAcontece}</p>
                <p className="guia-bncc__oficial">
                  <span className="font-semibold">Texto da BNCC:</span> {habilidade.texto}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function Antes({ guia }: { guia: Guia }) {
  return (
    <>
      <div className="grid gap-6 xl:grid-cols-2">
        <Passos titulo="Preparo técnico" icone="settings" passos={guia.antes.tecnico} />
        <Passos titulo="Preparo pedagógico" icone="menu_book" passos={guia.antes.pedagogico} />
      </div>

      <div className="guia-bloco guia-nao-diga">
        <h3 className="guia-h3">O que NÃO dizer antes da hora</h3>
        <p className="guia-nota">
          A missão mede o que a turma faz sem saber que está sendo medida. Cada frase abaixo, dita cedo, apaga a
          lição inteira — e é justamente o que a vontade de explicar manda dizer.
        </p>
        <ul className="guia-nao-diga__lista">
          {guia.antes.naoDiga.map((frase) => (
            <li key={frase}>
              <Icon name="do_not_disturb_on" size="s" color="var(--unooria-color-danger-600, #c62828)" aria-hidden />
              <span>{frase}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

/** Uma lista de passos numerados — é sequência de verdade: a ordem do preparo é a ordem de fazer. */
function Passos({ titulo, icone, passos }: { titulo: string; icone: string; passos: PassoDePreparo[] }) {
  return (
    <div className="guia-bloco flex flex-col gap-3">
      <h3 className="guia-h3 flex items-center gap-2">
        <Icon name={icone} size="s" color="var(--unooria-color-brandnavy-800, #49699f)" aria-hidden />
        {titulo}
      </h3>
      <ol className="guia-passos">
        {passos.map((passo, i) => (
          <li key={passo.titulo}>
            <span className="guia-passos__numero" aria-hidden>
              {i + 1}
            </span>
            <div className="flex flex-col gap-0.5">
              <strong className="text-[14px] font-semibold leading-snug text-unooria-neutral-950">
                {passo.titulo}
              </strong>
              <span className="text-[13.5px] leading-relaxed text-unooria-neutral-700">{passo.texto}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ListaCorrida({ itens }: { itens: string[] }) {
  return (
    <ul className="guia-bloco guia-bloco--longo guia-lista">
      {itens.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/* ---- Conduzir --------------------------------------------------------------- */

/**
 * O roteiro como LINHA DO TEMPO: o minuto à esquerda, o que acontece e o que
 * você faz na mesma coluna, e o botão do painel como etiqueta — era uma tabela
 * de quatro colunas com rolagem lateral, em que o botão ficava na última
 * coluna, a que mais se perde.
 */
function Roteiro({ guia }: { guia: Guia }) {
  return (
    <div className="guia-bloco guia-bloco--longo flex flex-col gap-4">
      <p className="text-[14px] font-semibold text-unooria-neutral-800">{guia.roteiro.total}</p>
      <ol className="guia-linha-do-tempo">
        {/* A chave leva a posição: em missões que medem o momento pela DURAÇÃO
            ("10 min", "5 min"), o tempo se repete no mesmo roteiro. */}
        {guia.roteiro.linhas.map((linha, i) => (
          <li key={`${i}-${linha.tempo}`} className="guia-linha-do-tempo__item">
            <div className="guia-linha-do-tempo__tempo">
              {linha.tempo}
              {/* "0–5" ganha a unidade; "5 min" e "Aula 2 · 0–5" já trazem a dela. */}
              {/^\d+\s*[–-]\s*\d+$/.test(linha.tempo) ? <span> min</span> : null}
            </div>
            <div className="guia-linha-do-tempo__corpo">
              <p className="text-[14.5px] font-semibold leading-snug text-unooria-neutral-950">{linha.momento}</p>
              <p className="text-[14px] leading-relaxed text-unooria-neutral-700">
                <span className="font-semibold text-unooria-neutral-800">Você: </span>
                {linha.professor}
              </p>
              {linha.botao ? (
                <span className="guia-linha-do-tempo__botao">
                  <Tag variant="brand" size="sm" leftIcon="touch_app">
                    Seu botão: {linha.botao}
                  </Tag>
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      {guia.roteiro.nota ? <p className="guia-nota">{guia.roteiro.nota}</p> : null}
    </div>
  );
}

function Debate({ guia }: { guia: Guia }) {
  return (
    <>
      {/* O elemento forte do guia: a pergunta que vai para a lousa, como na lousa. */}
      <div className="guia-bloco guia-lousa">
        <p className="guia-lousa__rotulo">Na lousa</p>
        <p className="guia-lousa__pergunta">{guia.debate.aberturaNaLousa}</p>
        <p className="guia-lousa__tempo">{guia.debate.tempo}</p>
      </div>

      <div className="guia-bloco guia-bloco--longo flex flex-col gap-4">
        <h3 className="guia-h3">Banco de perguntas</h3>
        <p className="guia-nota">
          Não são para usar todas: são uma escada. Uma turma que ainda não descreveu o que viu não tem o que
          generalizar, e perguntar &quot;onde isso acontece na sua vida?&quot; antes da hora produz a resposta que o
          estudante acha que você quer ouvir.
        </p>
        <ol className="guia-escada">
          {ORDEM_DOS_NIVEIS.map((nivel, i) => {
            const perguntas = guia.debate.perguntas.filter((p) => p.nivel === nivel);
            if (perguntas.length === 0) return null;
            return (
              <li key={nivel} className="guia-escada__degrau">
                <p className="guia-escada__nivel">
                  <span className="guia-passos__numero" aria-hidden>
                    {i + 1}
                  </span>
                  {ROTULO_DO_NIVEL[nivel]}
                </p>
                <ul className="flex flex-col gap-3">
                  {perguntas.map((pergunta) => (
                    <li key={pergunta.pergunta} className="guia-escada__pergunta">
                      <p className="text-[15px] font-semibold leading-snug text-unooria-neutral-950">
                        {pergunta.pergunta}
                      </p>
                      <p className="text-[13px] leading-relaxed text-unooria-neutral-700">
                        <span className="font-semibold">O que você caça:</span> {pergunta.porQue}
                      </p>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="guia-bloco flex flex-col gap-3">
        <h3 className="guia-h3">A folha, enquanto a sala discute</h3>
        <p className="text-[14px] leading-relaxed text-unooria-neutral-800">{guia.observacao.intro}</p>
        <ul className="guia-marcas">
          {guia.observacao.marcas.map((marca) => (
            <li key={marca.letra}>
              <span className="guia-marcas__letra">{marca.letra}</span>
              <span>{marca.texto}</span>
            </li>
          ))}
        </ul>
        {guia.observacao.nota ? <p className="guia-nota">{guia.observacao.nota}</p> : null}
      </div>
    </>
  );
}

/** A mediação como GRADE de situações: cada uma é um item que o professor procura pelo "quando". */
function Mediacao({ guia }: { guia: Guia }) {
  return (
    <div className="guia-bloco guia-bloco--longo flex flex-col gap-4">
      <p className="guia-nota">
        Estas situações vão acontecer — são o que esta missão produz de previsível numa sala. São também as horas em
        que a aula descarrila.
      </p>
      <ul className="guia-grade">
        {guia.mediacao.map((intervencao) => (
          <li key={intervencao.quando} className="guia-cartao">
            <p className="text-[14px] font-semibold leading-snug text-unooria-neutral-950">{intervencao.quando}</p>
            <p className="text-[14px] leading-relaxed text-unooria-neutral-800">
              <span className="font-semibold">Faça: </span>
              {intervencao.faca}
            </p>
            {intervencao.naoFaca ? (
              <p className="text-[13px] leading-relaxed text-unooria-danger">
                <span className="font-semibold">Não faça:</span> {intervencao.naoFaca}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---- Fechar ----------------------------------------------------------------- */

function Depois({ guia }: { guia: Guia }) {
  const { depois } = guia;
  return (
    <>
      <div className="guia-bloco guia-sintese">
        <h3 className="guia-h3">O que a turma leva — diga em voz alta, no fim</h3>
        <ol className="guia-sintese__lista">
          {depois.sintese.map((frase) => (
            <li key={frase}>{frase}</li>
          ))}
        </ol>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="guia-bloco flex flex-col gap-2">
          <h3 className="guia-h3">O registro que fecha a aula</h3>
          <p className="text-[14px] leading-relaxed text-unooria-neutral-800">{depois.registro}</p>
        </div>
        {depois.produto ? (
          <div className="guia-bloco flex flex-col gap-2">
            <h3 className="guia-h3">{depois.produto.titulo}</h3>
            <ol className="guia-lista guia-lista--numerada">
              {depois.produto.itens.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>

      <div className="guia-bloco guia-bloco--longo flex flex-col gap-3">
        <h3 className="guia-h3">Avaliação</h3>
        <p className="guia-nota">{depois.rubrica.nota}</p>
        <ScrollBar orientation="horizontal" autoHide>
          {/* Rolagem lateral da tabela larga pelo `ScrollBar` do DS: em tela estreita a
              rubrica passa da coluna, e a barra some quando ninguém a usa. */}
          <table className="guia-rubrica">
            <thead>
              <tr>
                <th className="w-44">Critério</th>
                <th>Em desenvolvimento</th>
                <th>Adequado</th>
                <th>Avançado</th>
              </tr>
            </thead>
            <tbody>
              {depois.rubrica.criterios.map((criterio) => (
                <tr key={criterio.criterio}>
                  <th scope="row">{criterio.criterio}</th>
                  <td>{criterio.emDesenvolvimento}</td>
                  <td>{criterio.adequado}</td>
                  <td>{criterio.avancado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollBar>
      </div>

      <div className="guia-bloco flex flex-col gap-2">
        <h3 className="guia-h3">Levar para a sua disciplina</h3>
        <ul className="guia-lista">
          {depois.desdobramentos.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </>
  );
}

/* ---- Consultar -------------------------------------------------------------- */

function Adaptacoes({ guia }: { guia: Guia }) {
  return (
    <ul className="guia-bloco guia-bloco--longo guia-grade">
      {guia.adaptacoes.map((adaptacao) => (
        <li key={adaptacao.contexto} className="guia-cartao">
          <p className="text-[14px] font-semibold leading-snug text-unooria-neutral-950">{adaptacao.contexto}</p>
          <p className="text-[14px] leading-relaxed text-unooria-neutral-800">{adaptacao.comoAdaptar}</p>
        </li>
      ))}
    </ul>
  );
}

function Duvidas({ guia }: { guia: Guia }) {
  return (
    <dl className="guia-bloco guia-bloco--longo guia-duvidas">
      {guia.duvidas.map((duvida) => (
        <div key={duvida.pergunta}>
          <dt>{duvida.pergunta}</dt>
          <dd>{duvida.resposta}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ---- seção ------------------------------------------------------------------ */

/** Uma seção do guia, com a âncora do índice e o bloco vivo que a fecha. */
function Secao({ id, blocos, children }: { id: SecaoDoGuia; blocos?: BlocosVivos; children: ReactNode }) {
  return (
    <section id={id} className="guia-secao flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h2 className="text-[20px] font-bold text-unooria-neutral-950">{TITULO_DA_SECAO[id]}</h2>
        {id === "cuidados" ? <Badge variant="warning">leia antes</Badge> : null}
      </div>
      {children}
      {blocos?.[id] ?? null}
    </section>
  );
}
