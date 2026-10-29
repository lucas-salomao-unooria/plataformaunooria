"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Button,
  Card,
  FeedbackAlert,
  NumberButton,
  RadioGroup,
  Selection,
  Stepper,
  Toggle,
} from "@edu/ui/ds";
import { tamanhoDasEquipes } from "@/lib/equipes";
import { aceitaEquipes, rotaDaAtividade, type MissaoComAtividade } from "@/lib/entre-redes/atividades";
import { concluirCriacao, destinoDepoisDeCriar, type EscolhaDeEquipes } from "@/lib/entre-redes/criar-atividade";

/** Uma turma que pode fazer a missão, com o que está em andamento nela. */
export interface TurmaDoAssistente {
  id: string;
  nome: string;
  estudantes: number;
  /** O título da atividade em andamento nesta turma, ou `null`. */
  emAndamento: string | null;
}

/** O que a missão devolve ao gravar o conteúdo: o id da atividade, ou o erro em frases. */
export type ResultadoDaCriacao = { ok: true; id: string } | { ok: false; mensagem: string; erros: string[] };

type Etapa = "turma" | "conteudo" | "equipes" | "revisar";

const ROTULO_DA_ETAPA: Record<Etapa, string> = {
  turma: "Turma",
  conteudo: "Conteúdo",
  equipes: "Equipes",
  revisar: "Revisar e criar",
};

/** A missão individual por desenho (`MISSOES_SEM_EQUIPE`, ADR-198) pula o passo das equipes. */
const COM_EQUIPES: readonly Etapa[] = ["turma", "conteudo", "equipes", "revisar"];
const SEM_EQUIPES: readonly Etapa[] = ["turma", "conteudo", "revisar"];

const ROTULO_DO_MODO = {
  sorteio: "Sortear as equipes",
  manual: "Eu separo",
  individual: "Um aluno por computador",
} as const;

type ModoEscolhido = keyof typeof ROTULO_DO_MODO;

/**
 * A CRIAÇÃO DE UMA ATIVIDADE em quatro passos (ADR-130): turma, conteúdo,
 * equipes, revisar e criar. É o esqueleto que as missões com atividade dividem
 * — o passo do CONTEÚDO é de cada uma (o editor da cobertura, do pacote de
 * notícias, do pacote de mensagens), e chega aqui por `conteudo`.
 *
 * Nada é gravado até "Criar atividade": a missão grava o conteúdo como uma
 * atividade PRONTA (`criar`), e `concluirCriacao` faz o resto — pôr no ar, se
 * o professor marcou, e montar as equipes. "Quem faltou hoje" não é pergunta
 * daqui: falta é do dia da aula, e a página da atividade deixa refazer.
 *
 * "Pôr no ar agora" nasce LIGADO só quando a turma não tem nada em andamento:
 * a primeira atividade da turma quase sempre é para usar, e trocar a que está
 * no ar é decisão que o professor toma de olho aberto.
 */
export function AssistenteDeAtividade({
  expId,
  rotaDaMissao,
  turmas,
  turmaInicial,
  conteudo,
  conteudoPronto,
  resumoDoConteudo,
  criar,
  rotuloDoCriar,
}: {
  expId: MissaoComAtividade;
  rotaDaMissao: string;
  turmas: TurmaDoAssistente[];
  turmaInicial: string;
  /** O passo de conteúdo da missão, já ligado à turma escolhida. */
  conteudo: (turmaId: string) => ReactNode;
  /** O conteúdo pode ser gravado? É o que acende o "Continuar" do passo 2. */
  conteudoPronto: boolean;
  /** Uma linha do resumo: o tema e o tamanho do que vai ser gravado. */
  resumoDoConteudo: string | null;
  criar: (turmaId: string) => Promise<ResultadoDaCriacao>;
  /**
   * O rótulo do botão final, quando a missão diz outra coisa que "Criar
   * atividade" — A Seleção diz "Aprovar Cobertura e Abrir Turma" (ADR-146),
   * porque o clique fecha a segunda fase da aprovação.
   */
  rotuloDoCriar?: (porNoAr: boolean) => string;
}) {
  const router = useRouter();
  const inicial = turmas.find((t) => t.id === turmaInicial)?.id ?? (turmas.length === 1 ? (turmas[0]?.id ?? "") : "");

  const [passo, setPasso] = useState(inicial ? 1 : 0);
  const [turmaId, setTurmaId] = useState(inicial);
  const semEquipes = !aceitaEquipes(expId);
  const etapas = semEquipes ? SEM_EQUIPES : COM_EQUIPES;
  const [modoEscolhido, setModo] = useState<ModoEscolhido | "">("");
  const modo: ModoEscolhido | "" = semEquipes ? "individual" : modoEscolhido;
  const [computadores, setComputadores] = useState<number | null>(null);
  const [porNoAr, setPorNoAr] = useState<boolean | null>(null);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<{ mensagem: string; erros: string[] } | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  /* Criada com aviso (a equipe não salvou, não entrou no ar): a atividade
     existe, e o caminho para ela fica na tela em vez de sumir numa navegação. */
  const [destinoComAviso, setDestinoComAviso] = useState<string | null>(null);

  const turma = turmas.find((t) => t.id === turmaId) ?? null;
  const estudantes = Math.max(1, turma?.estudantes ?? 1);
  const nComputadores = Math.min(estudantes, Math.max(1, computadores ?? Math.ceil(estudantes / 2)));
  const noAr = porNoAr ?? !turma?.emAndamento;

  const etapa = etapas[passo] ?? "turma";
  const podeAvancar = { turma: Boolean(turma), conteudo: conteudoPronto, equipes: modo !== "", revisar: true }[etapa];

  const escolha = (): EscolhaDeEquipes =>
    modo === "individual"
      ? { modo: "individual" }
      : { modo: modo === "manual" ? "manual" : "sorteio", computadores: nComputadores };

  async function criarAtividade() {
    if (!turma || !modo) return;
    setCriando(true);
    setErro(null);
    setAvisos([]);
    try {
      const r = await criar(turma.id);
      if (!r.ok) {
        setErro({ mensagem: r.mensagem, erros: r.erros });
        return;
      }
      const equipes = escolha();
      const fim = await concluirCriacao({ expId, turmaId: turma.id, atividadeId: r.id, equipes, porNoAr: noAr });
      const destino = destinoDepoisDeCriar(rotaDaAtividade(rotaDaMissao, expId, turma.id, r.id), equipes);
      if (fim.avisos.length > 0) {
        setAvisos(fim.avisos);
        setDestinoComAviso(destino);
        return;
      }
      router.push(destino);
    } catch {
      setErro({ mensagem: "A conexão falhou. Tente de novo.", erros: [] });
    } finally {
      setCriando(false);
    }
  }

  const passos = etapas.map((e, i) => ({
    label: ROTULO_DA_ETAPA[e],
    status: i < passo ? ("completed" as const) : i === passo ? ("selected" as const) : ("default" as const),
  }));

  return (
    <div className="flex flex-col gap-6" data-assistente-de-atividade data-passo={passo}>
      <Stepper
        steps={passos}
        orientation="horizontal"
        size="sm"
        onStepClick={(i) => {
          /* Só para trás: pular para a frente deixaria o "Criar" sem o que ele precisa. */
          if (i < passo && !criando && !destinoComAviso) setPasso(i);
        }}
      />

      {etapa === "turma" ? (
        <Card variant="outlined" title="Para qual turma é esta atividade?">
          <div className="flex max-w-xl flex-col gap-3">
            <p className="text-[13px] text-unooria-neutral-600">
              A atividade é de uma turma: é nela que as equipes são montadas e é ela que faz a missão.
            </p>
            {turmas.length === 0 ? (
              <FeedbackAlert
                type="warning"
                description="Você não tem turma desta série. Entre por uma turma em Minhas turmas."
              />
            ) : (
              <Selection
                label="Turma"
                value={turmaId}
                onChange={(valor) => setTurmaId(String(valor))}
                options={turmas.map((t) => ({
                  value: t.id,
                  label: `${t.nome} · ${t.estudantes} ${t.estudantes === 1 ? "estudante" : "estudantes"}`,
                }))}
              />
            )}
          </div>
        </Card>
      ) : null}

      {/* O conteúdo fica MONTADO nos outros passos (escondido), para o que o
          professor gerou e editou não se perder ao voltar e avançar. */}
      {turma ? (
        <div hidden={etapa !== "conteudo"} data-passo-conteudo>
          {conteudo(turma.id)}
        </div>
      ) : null}

      {etapa === "equipes" ? (
        <Card variant="outlined" title="Como a turma vai se sentar?">
          <div className="flex flex-col gap-5">
            <p className="max-w-3xl text-[13px] text-unooria-neutral-600">
              Equipe é quem divide um computador: quem entra na missão representa a equipe. Quem faltar você marca
              no dia, na página da atividade — dá para refazer o sorteio lá.
            </p>
            <RadioGroup
              label="Como montar as equipes?"
              name={`modo-das-equipes-da-criacao-${expId}`}
              direction="vertical"
              value={modo}
              onChange={(v) => setModo(String(v) as ModoEscolhido)}
              options={[
                {
                  value: "sorteio",
                  label: ROTULO_DO_MODO.sorteio,
                  helperText:
                    "A plataforma divide a turma em equipes de tamanho parecido. Dá para mudar quem fica onde depois.",
                },
                {
                  value: "manual",
                  label: ROTULO_DO_MODO.manual,
                  helperText:
                    "A plataforma cria as equipes vazias e você põe cada estudante numa delas, na página da atividade.",
                },
                {
                  value: "individual",
                  label: ROTULO_DO_MODO.individual,
                  helperText: "Cada estudante entra no próprio computador. Nenhuma equipe é montada.",
                },
              ]}
            />
            {modo === "sorteio" || modo === "manual" ? (
              <div className="flex flex-col gap-2">
                <span className="text-[15px] font-semibold text-unooria-neutral-950">
                  Quantos computadores vocês vão usar?
                </span>
                <div>
                  <NumberButton
                    value={nComputadores}
                    min={1}
                    max={estudantes}
                    onChange={setComputadores}
                    ariaLabel="Quantos computadores vocês vão usar?"
                    ariaLabelDecrement="Um computador a menos"
                    ariaLabelIncrement="Um computador a mais"
                  />
                </div>
                <p className="text-[13px] text-unooria-neutral-500">{tamanhoDasEquipes(estudantes, nComputadores)}</p>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      {etapa === "revisar" ? (
        <Card variant="outlined" title="Revisar e criar">
          <div className="flex flex-col gap-4" data-revisao-da-criacao>
            <dl className="grid gap-x-6 gap-y-2 text-[14px] sm:grid-cols-[max-content_1fr]">
              <dt className="font-semibold text-unooria-neutral-950">Turma</dt>
              <dd className="text-unooria-neutral-800">{turma?.nome}</dd>
              <dt className="font-semibold text-unooria-neutral-950">Conteúdo</dt>
              <dd className="text-unooria-neutral-800">{resumoDoConteudo}</dd>
              <dt className="font-semibold text-unooria-neutral-950">Equipes</dt>
              <dd className="text-unooria-neutral-800">
                {semEquipes
                  ? "Missão individual: cada estudante no próprio aparelho"
                  : modo === "individual"
                  ? ROTULO_DO_MODO.individual
                  : modo
                    ? `${ROTULO_DO_MODO[modo]} · ${nComputadores} ${nComputadores === 1 ? "computador" : "computadores"}`
                    : null}
              </dd>
            </dl>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <Toggle
                  checked={noAr}
                  onChange={(v: boolean) => setPorNoAr(v)}
                  aria-label="Pôr esta atividade no ar agora"
                />
                <span className="text-[14px] font-semibold text-unooria-neutral-950">Pôr esta atividade no ar agora</span>
              </div>
              <p className="max-w-3xl text-[12px] leading-snug text-unooria-neutral-600">
                {turma?.emAndamento
                  ? `A turma está fazendo “${turma.emAndamento}”. Ligado, quem estiver jogando passa para esta, e a outra volta a ficar pronta. Desligado, esta fica pronta na lista até você escolher.`
                  : "Ligado, a missão fica liberada para a turma na Sala de Aula e a turma já encontra esta atividade ao entrar. Desligado, ela fica pronta na lista até você escolher."}
              </p>
            </div>

            {erro ? (
              <FeedbackAlert
                type="error"
                description={
                  erro.erros.length > 0 ? (
                    <span className="flex flex-col gap-1">
                      <span>{erro.mensagem}</span>
                      <ul className="list-disc pl-5">
                        {erro.erros.map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                    </span>
                  ) : (
                    erro.mensagem
                  )
                }
              />
            ) : null}
            {avisos.length > 0 ? (
              <FeedbackAlert
                type="warning"
                title="A atividade foi criada"
                description={
                  <ul className="list-disc pl-5">
                    {avisos.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                }
              />
            ) : null}
          </div>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {destinoComAviso ? (
          <Button
            variant="primary"
            size="md"
            onClick={() => router.push(destinoComAviso)}
            data-acao="abrir-atividade-criada"
          >
            Abrir a atividade
          </Button>
        ) : (
          <>
            {passo > 0 ? (
              <Button variant="ghost" size="md" isDisabled={criando} onClick={() => setPasso((p) => p - 1)}>
                Voltar
              </Button>
            ) : null}
            {passo < etapas.length - 1 ? (
              <Button
                variant="primary"
                size="md"
                isDisabled={!podeAvancar}
                onClick={() => setPasso((p) => p + 1)}
                data-acao="continuar-criacao"
              >
                Continuar
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                isDisabled={criando || !turma || !modo || !conteudoPronto}
                isLoading={criando}
                onClick={() => void criarAtividade()}
                data-acao="criar-atividade"
              >
                {criando ? "Criando…" : (rotuloDoCriar?.(noAr) ?? "Criar atividade")}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
