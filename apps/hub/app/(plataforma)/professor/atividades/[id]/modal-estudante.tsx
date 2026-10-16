"use client";

import { useEffect, useState } from "react";

import { Badge, Modal, ModalBody, ModalHeader, ModalTitle, Tabs, Tag } from "@edu/ui/ds";

/**
 * O aparelho do estudante, aberto para o professor **durante** a atividade.
 *
 * O pedido era "clicar e abrir o Instanooria dele num popup". A tradução honesta
 * disso não é um clone do feed em miniatura — é a lista do que ele TOCOU, que é
 * a informação que o professor usa para conversar com ele. Um clone bonito e
 * ilegível ajudaria menos.
 *
 * Ordem da tela, e o porquê:
 *
 * 1. **A coleção** — quantos posts ele salvou, e quantos de cada lado. É o
 *    artefato da missão e o que ele vai defender no debate.
 * 2. **Os posts, salvos primeiro**, com o texto do comentário quando existe.
 * 3. **A sessão** (lado de largada, perfil, resposta) por último: é contexto, não
 *    é o que o professor precisa em 5 segundos no meio da aula.
 *
 * Sobre os rótulos: "do lado que ele recebeu" e "do outro lado", nunca
 * "coerente/incoerente". A conta é a mesma; a palavra não sugere que sair da
 * bolha é erro.
 */
interface Interacao {
  id: string;
  handle: string;
  caption: string;
  imageUrl: string | null;
  /** O texto alternativo da imagem gerada, ou `null` (ADR-163). */
  imageAlt?: string | null;
  fallbackArt: { corFundo: string; emojis: string } | null;
  ladoRotulo: string;
  perfil: string;
  intensidade: number;
  doLadoSemeado: boolean;
  neutro: boolean;
  salvou: boolean;
  curtiu: boolean;
  comentarios: string[];
  segundos: number;
}

/** O relatório do estudante, já computado no encerramento da investigação. */
interface Relatorio {
  ladoDominante: string;
  dominio: number;
  proporcaoFinal: { A: number; B: number; neutro: number };
  bolha: { ladoInicial: 'A' | 'B'; inverteu: boolean; blocoDaInversao: number | null };
  tempo: { feedMs: number; ativoMs: number; porLadoMs: Record<string, number>; vaosOciosos: number };
  imersao: { total: number; componentes: { rotulo: string; pontos: number; detalhe: string }[] };
  investigacao: {
    usosDaBusca: number;
    termosBuscados: string[];
    consideracaoDoOposto: number;
    comentariosLidos: number;
  };
  perfilObservado: { dominante: string | null; veredito: string; normalizado: Record<string, number> };
  /** Por que o feed dele nasceu naquele lado — o que o estudante lê no bloco 2. */
  explicacaoDoLado: {
    origem: 'perfil' | 'sorteio' | 'redistribuido';
    perfilRotulo: string;
    ladoRotulo: string;
    porQue: string;
  };
  rotulosDePerfil: { chave: string; rotulo: string }[];
  interacoes: { curtidas: number; comentarios: number; salvos: number; seguidos: number };
  postsOcultados: { total: number; ladoNaoObservado: boolean };
  atividade: { ladoALabel: string; ladoBLabel: string };
}

interface Dados {
  estudante?: { username: string; displayName: string; nomeNoApp: string | null; avatar: string | null };
  sessao: {
    fase: string;
    ladoInicialRotulo: string;
    ladoOrigem: string;
    perfilJogo: string | null;
    respondeuRotulo: string | null;
    reflexao: string | null;
    postouNoApp: string | null;
    /** O Canal A (ADR-167). Opcional para a resposta de uma api anterior. */
    canalA?: {
      revelacaoConcluida: boolean;
      raioX: boolean;
      termos: boolean;
      envio: boolean;
      refeita: boolean;
      fraseDoEnvio: string | null;
      leitura: {
        resultado: "nivel" | "sem_marca" | "falha" | null;
        nivel: "atingiu" | "em_processo" | "nao_atingiu" | null;
        motivo: string | null;
        lidaEm: string | null;
      } | null;
      textoLido: string | null;
      textoLidoApagado: boolean;
    };
  };
  resumo: {
    salvos: number;
    salvosDoLadoSemeado: number;
    salvosDoOutroLado: number;
    salvosNeutros: number;
    curtidos: number;
    comentados: number;
  };
  interacoes: Interacao[];
}

export function ModalEstudante({
  activityId,
  runId,
  nome,
  aoFechar,
}: {
  activityId: string;
  runId: string | null;
  nome: string;
  aoFechar: () => void;
}) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [aba, setAba] = useState<string | number>('agora');
  const [erro, setErro] = useState(false);

  useEffect(() => {
    if (!runId) return;
    let ativo = true;
    setDados(null);
    setErro(false);

    const buscar = async () => {
      try {
        let resposta = await fetch(`/api/plataforma/atividades/${activityId}/estudantes/${runId}`, {
          cache: "no-store",
        }).catch(() => null);
        if (!resposta || !resposta.ok) {
          resposta = await fetch(`/api/plataforma/atividades/${activityId}/estudantes/${runId}`, {
            cache: "no-store",
          });
        }
        if (!resposta.ok) throw new Error("falhou");
        const corpo = (await resposta.json()) as Dados;
        if (ativo) setDados(corpo);
      } catch {
        if (ativo) setErro(true);
      }
    };

    /**
     * O relatório é buscado uma vez, não em polling: ele só existe depois do
     * encerramento da investigação e, a partir daí, é congelado. Ficar
     * repuxando dado imutável a cada 5s seria desperdício.
     */
    void fetch(`/api/plataforma/runs/${runId}/dossie`, { cache: 'no-store' })
      .then((resposta) => (resposta.ok ? resposta.json() : null))
      .then((corpo: { dossie: Relatorio } | null) => {
        if (ativo && corpo?.dossie) setRelatorio(corpo.dossie);
      })
      .catch(() => undefined);

    void buscar();
    // Em tempo real: o professor abre e vê o estudante mexendo.
    const intervalo = setInterval(() => void buscar(), 5000);
    return () => {
      ativo = false;
      clearInterval(intervalo);
    };
  }, [activityId, runId]);

  if (!runId) return null;

  const infoEstudante = dados?.estudante;

  return (
    <Modal isOpen size="lg" onClose={aoFechar} closeOnOverlayClick closeOnEsc>
      <ModalHeader onClose={aoFechar}>
        {/*
          A IDENTIDADE vem da conta, não do aparelho. `nomeNoApp` é o apelido que
          a criança escolheu dentro da ficção do Instanooria; era ele que vinha
          primeiro aqui, de quando a conta era de assento e o nome digitado no app
          era a única pista de quem estava jogando. Agora cada pessoa tem a conta
          dela, e o apelido é o que é: decoração da experiência.
        */}
        <ModalTitle>{infoEstudante?.displayName || nome}</ModalTitle>
        {infoEstudante?.nomeNoApp ? (
          <p className="text-[13px] text-unooria-neutral-500">
            no app: {infoEstudante.nomeNoApp}
          </p>
        ) : null}
      </ModalHeader>

      <ModalBody>
        {/*
          Duas abas porque são dois usos diferentes do mesmo popup: DURANTE a aula
          o professor quer ver o que o estudante está coletando; DEPOIS ele quer o
          relatório. Empilhar tudo numa rolagem faria a informação da aula ficar
          soterrada pela do fim.
        */}
        {relatorio ? (
          <div className="mb-4">
            {/* `Tabs` é o mestre; `Tab` sozinho é o botão de uma aba só. */}
            <Tabs
              size="sm"
              value={aba}
              onChange={setAba}
              items={[
                { value: 'agora', label: 'O que ele fez', showIcon: false, showBadge: false },
                { value: 'relatorio', label: 'Relatório', showIcon: false, showBadge: false },
              ]}
            />
          </div>
        ) : null}

        {erro ? (
          <p className="text-[14px] text-unooria-neutral-700">
            Não deu para abrir agora. Fecha e tenta de novo.
          </p>
        ) : !dados ? (
          <p className="text-[14px] text-unooria-neutral-500">abrindo…</p>
        ) : aba === 'relatorio' && relatorio ? (
          <PainelDoRelatorio relatorio={relatorio} />
        ) : (
          <div className="flex flex-col gap-5">
            {/* 1. a coleção */}
            <section className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline gap-2">
                <h3 className="text-[15px] font-semibold text-unooria-neutral-950">
                  A coleção dele
                </h3>
                <span className="text-[12px] text-unooria-neutral-500">
                  {infoEstudante?.displayName} · {infoEstudante?.username}
                </span>
              </div>

              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ["Salvou", String(dados.resumo.salvos)],
                  ["Do lado que recebeu", String(dados.resumo.salvosDoLadoSemeado)],
                  ["Do outro lado", String(dados.resumo.salvosDoOutroLado)],
                  ["Sem lado", String(dados.resumo.salvosNeutros)],
                ].map(([rotulo, valor]) => (
                  <div key={rotulo} className="rounded-lg border border-unooria-neutral-200 p-2.5">
                    <dt className="text-[11px] leading-tight text-unooria-neutral-500">{rotulo}</dt>
                    <dd className="text-[19px] font-bold text-unooria-neutral-950">{valor}</dd>
                  </div>
                ))}
              </dl>

              <p className="text-[12px] leading-relaxed text-unooria-neutral-600">
                Salvar do outro lado não é erro — é sinal de que ele foi olhar o que o feed dele não
                empurrava. {dados.resumo.curtidos} curtida(s) · {dados.resumo.comentados} post(s)
                comentado(s).
              </p>
            </section>

            {/* 2. os posts que ele tocou */}
            <section className="flex flex-col gap-2">
              <h3 className="text-[15px] font-semibold text-unooria-neutral-950">
                O que ele tocou
              </h3>

              {dados.interacoes.length === 0 ? (
                <p className="text-[13px] text-unooria-neutral-600">
                  Ainda não interagiu com nenhum post.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-unooria-neutral-200">
                  {dados.interacoes.map((post) => (
                    <li key={post.id} className="flex gap-3 py-3">
                      <span className="h-14 w-14 shrink-0 overflow-hidden rounded-md">
                        {post.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={post.imageUrl} alt={post.imageAlt || `Foto do post de ${post.handle}`} className="h-full w-full object-cover" />
                        ) : (
                          <span
                            className="flex h-full w-full items-center justify-center text-[20px]"
                            style={{ background: post.fallbackArt?.corFundo }}
                          >
                            {post.fallbackArt?.emojis}
                          </span>
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[13px] font-semibold text-unooria-neutral-950">
                            {post.handle}
                          </span>
                          {post.salvou ? (
                            <Badge variant="info" size="sm">
                              salvou
                            </Badge>
                          ) : null}
                          {post.curtiu ? (
                            <Badge variant="neutral" size="sm">
                              curtiu
                            </Badge>
                          ) : null}
                          <Tag
                            variant={post.neutro ? "neutral" : post.doLadoSemeado ? "info" : "warning"}
                            size="sm"
                          >
                            {post.neutro
                              ? "sem lado"
                              : post.doLadoSemeado
                                ? "do lado que ele recebeu"
                                : "do outro lado"}
                          </Tag>
                          <span className="text-[11px] text-unooria-neutral-500">
                            {post.ladoRotulo} · int. {post.intensidade} · {post.segundos}s
                          </span>
                        </div>

                        <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-unooria-neutral-600">
                          {post.caption}
                        </p>

                        {post.comentarios.map((texto, indice) => (
                          <p
                            key={indice}
                            className="mt-1.5 rounded-md bg-unooria-neutral-100 px-2.5 py-1.5 text-[12px] leading-snug text-unooria-neutral-800"
                          >
                            comentou: “{texto}”
                          </p>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* 3. contexto da sessão */}
            <section className="flex flex-col gap-1.5 rounded-lg bg-unooria-neutral-50 p-3">
              <h3 className="text-[13px] font-semibold text-unooria-neutral-950">A sessão</h3>
              <p className="text-[12px] leading-relaxed text-unooria-neutral-700">
                Feed nasceu em <strong>{dados.sessao.ladoInicialRotulo}</strong> (
                {dados.sessao.ladoOrigem}
                {dados.sessao.perfilJogo ? ` · perfil ${dados.sessao.perfilJogo}` : ""}) · está{" "}
                {dados.sessao.fase}
                {dados.sessao.respondeuRotulo
                  ? ` · respondeu “${dados.sessao.respondeuRotulo}”`
                  : " · ainda não respondeu"}
              </p>
              {dados.sessao.postouNoApp ? (
                <p className="text-[12px] leading-relaxed text-unooria-neutral-700">
                  publicou: “{dados.sessao.postouNoApp}”
                </p>
              ) : null}
              {dados.sessao.reflexao ? (
                <p className="text-[12px] leading-relaxed text-unooria-neutral-700">
                  reflexão: “{dados.sessao.reflexao}”
                </p>
              ) : null}
            </section>

            {dados.sessao.canalA ? <SecaoDasTarefas canalA={dados.sessao.canalA} reflexaoAtual={dados.sessao.reflexao} /> : null}
          </div>
        )}
      </ModalBody>
    </Modal>
  );
}

/**
 * O relatório do estudante para o PROFESSOR — o mesmo dado que o estudante vê, arrumado
 * para quem vai conversar com ele.
 *
 * A ordem é a das perguntas que um professor faz: onde ele largou e onde
 * terminou, quanto tempo ficou de cada lado, o quanto se envolveu, e se ele foi
 * atrás do que faltava. Aqui os números aparecem sem eufemismo — é tela de
 * adulto, não de criança.
 */
function PainelDoRelatorio({ relatorio }: { relatorio: Relatorio }) {
  const rotulo = (lado: string) =>
    lado === 'A'
      ? relatorio.atividade.ladoALabel
      : lado === 'B'
        ? relatorio.atividade.ladoBLabel
        : 'nenhum lado';

  const duracao = (ms: number) => {
    const total = Math.round(ms / 1000);
    return total >= 60
      ? `${Math.floor(total / 60)}min${String(total % 60).padStart(2, '0')}s`
      : `${total}s`;
  };

  const outro = relatorio.bolha.ladoInicial === 'A' ? 'B' : 'A';
  const pct = (valor: number) => `${Math.round(valor * 100)}%`;

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h3 className="text-[15px] font-semibold text-unooria-neutral-950">A bolha dele</h3>
        <p className="text-[13px] leading-relaxed text-unooria-neutral-700">
          Nasceu em <strong>{rotulo(relatorio.bolha.ladoInicial)}</strong> e terminou em{' '}
          <strong>{rotulo(relatorio.ladoDominante)}</strong>
          {relatorio.bolha.inverteu ? (
            <>
              {' '}
              — <span className="font-semibold text-unooria-coral-600">virou o jogo</span>
              {relatorio.bolha.blocoDaInversao ? ` no ${relatorio.bolha.blocoDaInversao}º bloco` : ''}
            </>
          ) : (
            ''
          )}
          . Domínio final {pct(relatorio.dominio)}.
        </p>

        <dl className="grid grid-cols-3 gap-2">
          {[
            [relatorio.atividade.ladoALabel, pct(relatorio.proporcaoFinal.A)],
            [relatorio.atividade.ladoBLabel, pct(relatorio.proporcaoFinal.B)],
            ['sem lado', pct(relatorio.proporcaoFinal.neutro)],
          ].map(([nome, valor]) => (
            <div key={nome} className="rounded-lg border border-unooria-neutral-200 p-2.5">
              <dt className="text-[11px] leading-tight text-unooria-neutral-500">{nome}</dt>
              <dd className="text-[17px] font-bold text-unooria-neutral-950">{valor}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/*
        A MESMA explicação que o estudante lê no bloco 2 do relatório dele, em 3ª
        pessoa. Faltava aqui, e a falta tinha consequência de aula: o professor
        conduzia a conversa sobre a bolha sem ver a frase que a criança acabara
        de ler — e é essa frase, não a porcentagem, que ela vai querer discutir.
      */}
      <section className="flex flex-col gap-2">
        <h3 className="text-[15px] font-semibold text-unooria-neutral-950">
          Por que o feed dele começou desse lado
        </h3>
        <p className="text-[13px] leading-relaxed text-unooria-neutral-700">
          {relatorio.explicacaoDoLado.origem === 'perfil' ? (
            <>
              No jogo, o que mais move ele é{' '}
              <strong>{relatorio.explicacaoDoLado.perfilRotulo}</strong>, e o lado que fala essa língua
              neste debate é <strong>{relatorio.explicacaoDoLado.ladoRotulo}</strong>
              {relatorio.explicacaoDoLado.porQue ? ` — ${relatorio.explicacaoDoLado.porQue}` : ''}.
            </>
          ) : relatorio.explicacaoDoLado.origem === 'redistribuido' ? (
            <>
              Começou em <strong>{relatorio.explicacaoDoLado.ladoRotulo}</strong> por redistribuição — o
              lado foi ajustado para a turma não ficar concentrada.
            </>
          ) : (
            <>
              Começou em <strong>{relatorio.explicacaoDoLado.ladoRotulo}</strong> por{' '}
              <strong>sorteio</strong>: não havia perfil do Ato 1 para este estudante.
            </>
          )}
        </p>
        <p className="text-[12px] leading-relaxed text-unooria-neutral-600">
          É o que ele lê no próprio relatório, com o fecho “você não escolheu, e ninguém te avisou”.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-[15px] font-semibold text-unooria-neutral-950">Tempo</h3>
        <p className="text-[13px] leading-relaxed text-unooria-neutral-700">
          {duracao(relatorio.tempo.feedMs)} no feed, {duracao(relatorio.tempo.ativoMs)} sem pausa longa
          ({relatorio.tempo.vaosOciosos} pausa(s)). Ficou{' '}
          <strong>{duracao(relatorio.tempo.porLadoMs[relatorio.bolha.ladoInicial] ?? 0)}</strong> no lado
          que recebeu e <strong>{duracao(relatorio.tempo.porLadoMs[outro] ?? 0)}</strong> no outro.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-[15px] font-semibold text-unooria-neutral-950">
          Envolvimento{' '}
          <span className="text-[13px] font-normal text-unooria-neutral-500">
            {relatorio.imersao.total}/100
          </span>
        </h3>
        <ul className="flex flex-col gap-1.5">
          {relatorio.imersao.componentes.map((componente) => (
            <li key={componente.rotulo} className="flex flex-col gap-0.5">
              <span className="flex justify-between text-[12px] text-unooria-neutral-700">
                <span>{componente.rotulo}</span>
                <span className="font-semibold">{componente.pontos}/20</span>
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-unooria-neutral-200">
                <span
                  className="block h-full rounded-full bg-unooria-navy-800"
                  style={{ width: `${Math.round((componente.pontos / 20) * 100)}%` }}
                />
              </span>
              <span className="text-[11px] leading-tight text-unooria-neutral-500">
                {componente.detalhe}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-[11px] leading-relaxed text-unooria-neutral-500">
          Nunca leia o total sozinho: dois estudantes com 60 podem ter chegado lá por caminhos opostos.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-[15px] font-semibold text-unooria-neutral-950">Ele foi atrás?</h3>
        <p className="text-[13px] leading-relaxed text-unooria-neutral-700">
          {relatorio.investigacao.usosDaBusca > 0
            ? `Abriu a busca ${relatorio.investigacao.usosDaBusca}× (ela nunca é filtrada por lado)`
            : 'Não abriu a busca nenhuma vez — e ela mostrava os dois lados sem filtro'}
          . Parou de verdade em <strong>{relatorio.investigacao.consideracaoDoOposto}</strong> post(s) do
          outro lado, e abriu {relatorio.investigacao.comentariosLidos} caixa(s) de comentário.
          {relatorio.investigacao.termosBuscados.length > 0
            ? ` Procurou: ${relatorio.investigacao.termosBuscados.slice(0, 6).join(', ')}.`
            : ''}
        </p>
        {/*
          "Escondeu 0 posts" era a frase que saía quando a sessão não serviu post
          de tese nenhum — e ela afirma o contrário do que houve. Não saber qual
          era o lado dele não é o mesmo que nada ter sido escondido.
        */}
        <p className="text-[12px] leading-relaxed text-unooria-neutral-600">
          {relatorio.postsOcultados.ladoNaoObservado
            ? 'A sessão não chegou a servir posts dos dois lados — não dá para dizer o que ficou de fora.'
            : `O algoritmo escondeu ${relatorio.postsOcultados.total} posts do outro lado dele — o mesmo número que ele vê na tela "o feed que você não recebeu".`}
        </p>
      </section>

      {relatorio.perfilObservado.veredito !== 'sem_referencia' ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-[15px] font-semibold text-unooria-neutral-950">
            Que linguagem prendeu
          </h3>
          <ul className="flex flex-col gap-1">
            {relatorio.rotulosDePerfil.map((perfil) => (
              <li
                key={perfil.chave}
                className="flex justify-between text-[12px] text-unooria-neutral-700"
              >
                <span>{perfil.rotulo}</span>
                <span className="font-semibold">
                  {pct(relatorio.perfilObservado.normalizado[perfil.chave] ?? 0)}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[12px] leading-relaxed text-unooria-neutral-600">
            {relatorio.perfilObservado.veredito === 'reforcou'
              ? 'A linguagem que mais prendeu foi a mesma que o jogo apontou.'
              : 'A linguagem que mais prendeu foi outra — dado interessante, não erro.'}{' '}
            A conta desconta quantos posts de cada jeito ele recebeu.
          </p>
        </section>
      ) : null}
    </div>
  );
}

/** O que a leitura da IA disse da reflexão, em texto para o professor. */
const RESULTADO_DA_LEITURA: Record<string, string> = {
  atingiu: "Atingiu",
  em_processo: "Em processo",
  nao_atingiu: "Não atingiu",
  sem_marca: "sem marca (o texto não fala do mecanismo do feed)",
  falha: "sem leitura (a IA não respondeu a tempo ou ficou sem saldo)",
};

/**
 * AS TAREFAS DO CANAL A (ADR-167), no popup de um estudante: o que ele fez,
 * a frase própria do envio e a leitura que a IA fez da reflexão.
 *
 * O "texto lido" é o PRIMEIRO texto que ele salvou; quando difere do texto de
 * agora, os dois aparecem — é assim que o professor confere a sugestão da IA.
 * Depois de um reinício o texto lido saiu com a reflexão antiga, e só o nível
 * e o motivo ficam. Só o professor lê esta janela.
 */
function SecaoDasTarefas({
  canalA,
  reflexaoAtual,
}: {
  canalA: NonNullable<Dados["sessao"]["canalA"]>;
  reflexaoAtual: string | null;
}) {
  const leitura = canalA.leitura;
  const resultado = leitura?.resultado === "nivel" ? leitura.nivel : leitura?.resultado;
  const feitas = [canalA.raioX ? "Raio-x" : null, canalA.termos ? "termos" : null, canalA.envio ? "envio" : null].filter(Boolean);
  return (
    <section className="flex flex-col gap-1.5 rounded-lg bg-unooria-neutral-50 p-3">
      <h3 className="text-[13px] font-semibold text-unooria-neutral-950">As tarefas</h3>
      <p className="text-[12px] leading-relaxed text-unooria-neutral-700">
        {canalA.revelacaoConcluida ? "Terminou a revelação" : "Ainda não terminou a revelação"} ·{" "}
        {feitas.length > 0 ? `fez ${feitas.join(", ")}` : "nenhuma tarefa enviada"}
        {canalA.refeita ? " · refeito após reinício (vale o primeiro envio)" : ""}
      </p>
      {canalA.fraseDoEnvio ? (
        <p className="text-[12px] leading-relaxed text-unooria-neutral-700">
          frase do estudante no envio: “{canalA.fraseDoEnvio}”
        </p>
      ) : null}
      {leitura ? (
        <p className="text-[12px] leading-relaxed text-unooria-neutral-700">
          leitura da reflexão pela IA (sugestão):{" "}
          <strong>{resultado ? RESULTADO_DA_LEITURA[resultado] ?? resultado : "aguardando"}</strong>
        </p>
      ) : null}
      {canalA.textoLido && canalA.textoLido !== reflexaoAtual ? (
        <p className="text-[12px] leading-relaxed text-unooria-neutral-700">texto lido pela IA: “{canalA.textoLido}”</p>
      ) : null}
      {canalA.textoLidoApagado ? (
        <p className="text-[12px] leading-relaxed text-unooria-neutral-500">
          O texto lido foi apagado no reinício; ficaram o nível e o motivo.
        </p>
      ) : null}
    </section>
  );
}
