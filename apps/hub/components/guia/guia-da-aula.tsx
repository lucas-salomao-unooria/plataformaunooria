import "./guia.css";

import { Badge, Card, FeedbackAlert, Tag } from "@edu/ui/ds";
import { LinkButton } from "@/components/link-button";
import { Trilha, type ItemDaTrilha } from "@/components/trilha";
import {
  ROTULO_DO_NIVEL,
  SECOES_DO_GUIA,
  type BlocosVivos,
  type GuiaDaAula as Guia,
  type NivelDaPergunta,
  type SecaoDoGuia,
} from "@/lib/entre-redes/guias/tipos";

import { BotaoImprimir } from "./botao-imprimir";

/**
 * O renderizador ÚNICO do guia da aula.
 *
 * Toda missão do Entre Redes lê o guia dela na mesma ordem — objetivos, antes,
 * roteiro, debate, mediação, depois, cuidados, adaptações, dúvidas — porque a
 * segunda missão que o professor roda tem de ter a informação no mesmo lugar da
 * primeira. Quem escreve a ordem é este arquivo; quem escreve o conteúdo é
 * `lib/entre-redes/guias/<exp>.ts`.
 *
 * O que não cabe em dado entra por `blocos`: um `ReactNode` ancorado ao fim de
 * uma seção, montado pela página da missão a partir de fonte viva (a tabela dos
 * momentos do Instanooria, os cartões da Vila vindos da api). Ver a nota em
 * `guias/tipos.ts` sobre por que esses não viram texto.
 */

/** O rótulo de cada seção no índice e no `h2`. */
const TITULO_DA_SECAO: Record<SecaoDoGuia, string> = {
  objetivos: "O que a turma aprende",
  antes: "Antes da aula",
  roteiro: "Roteiro da aula",
  debate: "Perguntas para o debate",
  mediacao: "Mediação — o que fazer quando",
  depois: "Depois da aula",
  cuidados: "Cuidados",
  adaptacoes: "Adaptações",
  duvidas: "Dúvidas frequentes",
};

const ORDEM_DOS_NIVEIS: NivelDaPergunta[] = [
  "retomada",
  "analise",
  "generalizacao",
  "transferencia",
];

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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[24px] font-bold leading-tight text-unooria-neutral-950">
            Guia da aula
          </h1>
          <p className="max-w-3xl text-[14px] leading-relaxed text-unooria-neutral-800">
            <strong>{cabecalho.missao}</strong> · {cabecalho.contexto} · {cabecalho.duracao}
          </p>
          <p className="max-w-3xl text-[14px] leading-relaxed text-unooria-neutral-700">
            {guia.chamada}
          </p>
        </div>
        <div className="guia-fora-do-papel flex items-center gap-2">
          <BotaoImprimir />
          <LinkButton href={voltar.href} variant="outline" size="sm">
            {voltar.rotulo}
          </LinkButton>
        </div>
      </div>

      {guia.avisos?.length ? (
        <div className="flex flex-col gap-3">
          {guia.avisos.map((aviso) => (
            <FeedbackAlert
              key={aviso.titulo}
              type={aviso.tom}
              title={aviso.titulo}
              description={aviso.texto}
            />
          ))}
        </div>
      ) : null}

      <div className="guia__corpo grid gap-8 lg:grid-cols-[200px_1fr]">
        <nav className="guia-fora-do-papel hidden lg:block" aria-label="Seções do guia">
          <div className="guia-indice">
            <p className="pb-2 pl-3 text-[11px] font-semibold uppercase tracking-widest text-unooria-neutral-500">
              Nesta página
            </p>
            {SECOES_DO_GUIA.map((secao) => (
              <a key={secao} className="guia-indice__link" href={`#${secao}`}>
                {TITULO_DA_SECAO[secao]}
              </a>
            ))}
          </div>
        </nav>

        <div className="flex min-w-0 flex-col gap-8">
          <Secao id="objetivos" blocos={blocos}>
            <div className="guia-bloco">
              <Card variant="outlined" title="Objetivos de aprendizagem">
                <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[14px] leading-relaxed text-unooria-neutral-800">
                  {guia.objetivos.map((objetivo) => (
                    <li key={objetivo}>{objetivo}</li>
                  ))}
                </ul>
              </Card>
            </div>

            <div className="guia-bloco guia-bloco--longo">
              <Card
                variant="outlined"
                title="Alinhamento com a BNCC — Computação"
              >
                <p className="text-[13px] leading-relaxed text-unooria-neutral-700">
                  Habilidades do <em>Complemento de Computação à BNCC</em> (MEC, 2022), com o
                  texto oficial. A coluna da direita é nossa: onde, na missão, a habilidade
                  acontece de fato.{" "}
                  <strong>Confira com a coordenação antes de colar no plano de curso</strong> —
                  o recorte é uma proposta nossa, não uma classificação oficial da missão.
                </p>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse text-left text-[13px]">
                    <thead>
                      <tr className="text-[12px] text-unooria-neutral-500">
                        <th className="w-28 py-2 font-semibold">Habilidade</th>
                        <th className="py-2 font-semibold">Texto da BNCC</th>
                        <th className="w-56 py-2 font-semibold">Onde acontece</th>
                      </tr>
                    </thead>
                    <tbody className="align-top">
                      {guia.bncc.map((habilidade) => (
                        <tr
                          key={habilidade.codigo}
                          className="border-t border-unooria-neutral-200"
                        >
                          <td className="py-2.5 pr-3">
                            <span className="block font-semibold text-unooria-neutral-950">
                              {habilidade.codigo}
                            </span>
                            <span className="mt-1 block text-[11px] text-unooria-neutral-500">
                              {habilidade.eixo}
                            </span>
                            {habilidade.principal ? (
                              <span className="mt-1 inline-block">
                                <Tag variant="success" size="sm" pill>
                                  principal
                                </Tag>
                              </span>
                            ) : null}
                          </td>
                          <td className="py-2.5 pr-3 leading-relaxed text-unooria-neutral-800">
                            {habilidade.texto}
                          </td>
                          <td className="py-2.5 leading-relaxed text-unooria-neutral-700">
                            {habilidade.ondeAcontece}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </Secao>

          <Secao id="antes" blocos={blocos}>
            <div className="guia-bloco">
              <Card variant="outlined" title="Preparo técnico">
                <ol className="flex list-decimal flex-col gap-2.5 pl-5 text-[14px] leading-relaxed text-unooria-neutral-800">
                  {guia.antes.tecnico.map((passo) => (
                    <li key={passo.titulo}>
                      <strong className="text-unooria-neutral-950">{passo.titulo}</strong>{" "}
                      {passo.texto}
                    </li>
                  ))}
                </ol>
              </Card>
            </div>

            <div className="guia-bloco">
              <Card variant="outlined" title="Preparo pedagógico">
                <ol className="flex list-decimal flex-col gap-2.5 pl-5 text-[14px] leading-relaxed text-unooria-neutral-800">
                  {guia.antes.pedagogico.map((passo) => (
                    <li key={passo.titulo}>
                      <strong className="text-unooria-neutral-950">{passo.titulo}</strong>{" "}
                      {passo.texto}
                    </li>
                  ))}
                </ol>
              </Card>
            </div>

            <div className="guia-bloco">
              <Card variant="outlined" title="O que NÃO dizer antes da hora">
                <p className="text-[13px] leading-relaxed text-unooria-neutral-700">
                  A missão mede o que a turma faz sem saber que está sendo medida. Cada frase
                  abaixo, dita cedo, apaga a lição inteira — e é justamente o que a vontade de
                  explicar manda dizer.
                </p>
                <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-[14px] leading-relaxed text-unooria-neutral-800">
                  {guia.antes.naoDiga.map((frase) => (
                    <li key={frase}>{frase}</li>
                  ))}
                </ul>
              </Card>
            </div>
          </Secao>

          <Secao id="roteiro" blocos={blocos}>
            <div className="guia-bloco guia-bloco--longo">
              <Card variant="outlined" title={`Roteiro — ${guia.roteiro.total}`}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] border-collapse text-left text-[14px]">
                    <thead>
                      <tr className="text-[12px] text-unooria-neutral-500">
                        <th className="w-24 py-2 font-semibold">Tempo</th>
                        <th className="py-2 font-semibold">O que acontece</th>
                        <th className="py-2 font-semibold">O que você faz e fala</th>
                        <th className="w-40 py-2 font-semibold">Seu botão</th>
                      </tr>
                    </thead>
                    <tbody className="align-top">
                      {guia.roteiro.linhas.map((linha) => (
                        <tr key={linha.tempo} className="border-t border-unooria-neutral-200">
                          <td className="py-2.5 pr-3 font-semibold text-unooria-neutral-950">
                            {linha.tempo}
                          </td>
                          <td className="py-2.5 pr-3 leading-relaxed text-unooria-neutral-800">
                            {linha.momento}
                          </td>
                          <td className="py-2.5 pr-3 leading-relaxed text-unooria-neutral-700">
                            {linha.professor}
                          </td>
                          <td className="py-2.5 text-[13px] font-semibold text-unooria-navy-900">
                            {linha.botao ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {guia.roteiro.nota ? (
                  <p className="mt-3 text-[12px] leading-relaxed text-unooria-neutral-500">
                    {guia.roteiro.nota}
                  </p>
                ) : null}
              </Card>
            </div>
          </Secao>

          <Secao id="debate" blocos={blocos}>
            <div className="guia-bloco">
              <Card variant="elevated" title="A pergunta que vai para a lousa">
                <p className="rounded-lg bg-unooria-neutral-100 px-4 py-3 text-[18px] font-bold text-unooria-neutral-950">
                  {guia.debate.aberturaNaLousa}
                </p>
                <p className="mt-3 text-[13px] leading-relaxed text-unooria-neutral-700">
                  {guia.debate.tempo}
                </p>
              </Card>
            </div>

            <div className="guia-bloco guia-bloco--longo">
              <Card variant="outlined" title="Banco de perguntas">
                <p className="text-[13px] leading-relaxed text-unooria-neutral-700">
                  Não são para usar todas: são uma escada. Uma turma que ainda não descreveu o
                  que viu não tem o que generalizar, e perguntar &quot;onde isso acontece na sua
                  vida?&quot; antes da hora produz a resposta que o estudante acha que você quer
                  ouvir.
                </p>
                <div className="mt-4 flex flex-col gap-5">
                  {ORDEM_DOS_NIVEIS.map((nivel) => {
                    const perguntas = guia.debate.perguntas.filter((p) => p.nivel === nivel);
                    if (perguntas.length === 0) return null;
                    return (
                      <div key={nivel} className="flex flex-col gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-unooria-neutral-500">
                          {ROTULO_DO_NIVEL[nivel]}
                        </p>
                        <ul className="flex flex-col gap-3">
                          {perguntas.map((pergunta) => (
                            <li
                              key={pergunta.pergunta}
                              className="rounded-lg border border-unooria-neutral-200 p-3"
                            >
                              <p className="text-[15px] font-semibold leading-relaxed text-unooria-neutral-950">
                                {pergunta.pergunta}
                              </p>
                              <p className="mt-1 text-[13px] leading-relaxed text-unooria-neutral-700">
                                <span className="font-semibold">O que você caça:</span>{" "}
                                {pergunta.porQue}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>

            <div className="guia-bloco">
              <Card variant="outlined" title="A folha, enquanto a sala discute">
                <p className="text-[14px] leading-relaxed text-unooria-neutral-800">
                  {guia.observacao.intro}
                </p>
                <ul className="mt-3 flex flex-col gap-1.5 text-[14px] text-unooria-neutral-800">
                  {guia.observacao.marcas.map((marca) => (
                    <li key={marca.letra} className="flex items-baseline gap-3">
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-unooria-navy-800 text-[12px] font-bold text-white">
                        {marca.letra}
                      </span>
                      <span>{marca.texto}</span>
                    </li>
                  ))}
                </ul>
                {guia.observacao.nota ? (
                  <p className="mt-3 text-[13px] leading-relaxed text-unooria-neutral-700">
                    {guia.observacao.nota}
                  </p>
                ) : null}
              </Card>
            </div>
          </Secao>

          <Secao id="mediacao" blocos={blocos}>
            <div className="guia-bloco guia-bloco--longo">
              <Card variant="outlined" title="Mediação">
                <p className="text-[13px] leading-relaxed text-unooria-neutral-700">
                  Estas situações vão acontecer — são o que esta missão produz de previsível
                  numa sala. São também as horas em que a aula descarrila.
                </p>
                <ul className="mt-4 flex flex-col gap-4">
                  {guia.mediacao.map((intervencao) => (
                    <li
                      key={intervencao.quando}
                      className="rounded-lg border border-unooria-neutral-200 p-3"
                    >
                      <p className="text-[14px] font-semibold text-unooria-neutral-950">
                        {intervencao.quando}
                      </p>
                      <p className="mt-1 text-[14px] leading-relaxed text-unooria-neutral-800">
                        {intervencao.faca}
                      </p>
                      {intervencao.naoFaca ? (
                        <p className="mt-1.5 text-[13px] leading-relaxed text-unooria-danger">
                          <span className="font-semibold">Não faça:</span> {intervencao.naoFaca}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </Secao>

          <Secao id="depois" blocos={blocos}>
            <div className="guia-bloco">
              <Card variant="elevated" title="O que a turma leva">
                <ol className="flex list-decimal flex-col gap-2 pl-5 text-[14px] leading-relaxed text-unooria-neutral-800">
                  {guia.depois.sintese.map((frase) => (
                    <li key={frase}>{frase}</li>
                  ))}
                </ol>
              </Card>
            </div>

            <div className="guia-bloco">
              <Card variant="outlined" title="O registro que fecha a aula">
                <p className="text-[14px] leading-relaxed text-unooria-neutral-800">
                  {guia.depois.registro}
                </p>
              </Card>
            </div>

            {guia.depois.produto ? (
              <div className="guia-bloco">
                <Card variant="outlined" title={guia.depois.produto.titulo}>
                  <ol className="flex list-decimal flex-col gap-2 pl-5 text-[14px] leading-relaxed text-unooria-neutral-800">
                    {guia.depois.produto.itens.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ol>
                </Card>
              </div>
            ) : null}

            <div className="guia-bloco guia-bloco--longo">
              <Card variant="outlined" title="Avaliação">
                <p className="text-[13px] leading-relaxed text-unooria-neutral-700">
                  {guia.depois.rubrica.nota}
                </p>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
                    <thead>
                      <tr className="text-[12px] text-unooria-neutral-500">
                        <th className="w-44 py-2 font-semibold">Critério</th>
                        <th className="py-2 font-semibold">Em desenvolvimento</th>
                        <th className="py-2 font-semibold">Adequado</th>
                        <th className="py-2 font-semibold">Avançado</th>
                      </tr>
                    </thead>
                    <tbody className="align-top">
                      {guia.depois.rubrica.criterios.map((criterio) => (
                        <tr
                          key={criterio.criterio}
                          className="border-t border-unooria-neutral-200"
                        >
                          <td className="py-2.5 pr-3 font-semibold text-unooria-neutral-950">
                            {criterio.criterio}
                          </td>
                          <td className="py-2.5 pr-3 leading-relaxed text-unooria-neutral-700">
                            {criterio.emDesenvolvimento}
                          </td>
                          <td className="py-2.5 pr-3 leading-relaxed text-unooria-neutral-800">
                            {criterio.adequado}
                          </td>
                          <td className="py-2.5 leading-relaxed text-unooria-neutral-800">
                            {criterio.avancado}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            <div className="guia-bloco">
              <Card variant="outlined" title="Levar para a sua disciplina">
                <ul className="flex list-disc flex-col gap-2 pl-5 text-[14px] leading-relaxed text-unooria-neutral-800">
                  {guia.depois.desdobramentos.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </Card>
            </div>
          </Secao>

          <Secao id="cuidados" blocos={blocos}>
            <div className="guia-bloco guia-bloco--longo">
              <Card variant="outlined" title="Cuidados">
                <ul className="flex list-disc flex-col gap-2.5 pl-5 text-[14px] leading-relaxed text-unooria-neutral-800">
                  {guia.cuidados.map((cuidado) => (
                    <li key={cuidado}>{cuidado}</li>
                  ))}
                </ul>
              </Card>
            </div>
          </Secao>

          <Secao id="adaptacoes" blocos={blocos}>
            <div className="guia-bloco guia-bloco--longo">
              <Card variant="outlined" title="Adaptações">
                <ul className="flex flex-col gap-3">
                  {guia.adaptacoes.map((adaptacao) => (
                    <li key={adaptacao.contexto}>
                      <p className="text-[14px] font-semibold text-unooria-neutral-950">
                        {adaptacao.contexto}
                      </p>
                      <p className="text-[14px] leading-relaxed text-unooria-neutral-800">
                        {adaptacao.comoAdaptar}
                      </p>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </Secao>

          <Secao id="duvidas" blocos={blocos}>
            <div className="guia-bloco guia-bloco--longo">
              <Card variant="outlined" title="Dúvidas frequentes">
                <dl className="flex flex-col gap-3">
                  {guia.duvidas.map((duvida) => (
                    <div key={duvida.pergunta}>
                      <dt className="text-[14px] font-semibold text-unooria-neutral-950">
                        {duvida.pergunta}
                      </dt>
                      <dd className="text-[14px] leading-relaxed text-unooria-neutral-800">
                        {duvida.resposta}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Card>
            </div>
          </Secao>

          <p className="guia__rodape-do-papel hidden">
            Guia da aula · {cabecalho.missao} · {cabecalho.contexto} — Plataforma Unooria,
            Entre Redes. Impresso da tela do professor.
          </p>

          <div className="guia-fora-do-papel flex items-center gap-2">
            <LinkButton href={voltar.href} variant="outline">
              {voltar.rotulo}
            </LinkButton>
            <BotaoImprimir />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Uma seção do guia, com a âncora do índice e o bloco vivo que a fecha. */
function Secao({
  id,
  blocos,
  children,
}: {
  id: SecaoDoGuia;
  blocos?: BlocosVivos;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="guia-secao flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h2 className="text-[18px] font-bold text-unooria-neutral-950">
          {TITULO_DA_SECAO[id]}
        </h2>
        {id === "cuidados" ? <Badge variant="warning">leia antes</Badge> : null}
      </div>
      {children}
      {blocos?.[id] ?? null}
    </section>
  );
}
