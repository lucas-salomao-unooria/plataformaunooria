import Link from "next/link";
import { Card, EmptyState } from "@edu/ui/ds";
import { PainelDeHabilidades } from "@/components/evidencias/painel-de-habilidades";
import { RotuloDaTrilha } from "@/components/trilha";
import { apiDoServidor } from "@/lib/api-servidor";
import { auth } from "@/lib/auth";
import { rotaDaMissao, type Missao } from "@/lib/entre-redes/catalogo";
import type { MembroNoPainel } from "@/lib/equipe-no-painel";
import { equipesDaMissao } from "@/lib/equipes-servidor";
import { painelDeHabilidades } from "@/lib/evidencias-servidor";
import type { MaterialDoJornal, PacotesDaTurma, PainelDoJornal, TurmaDoJornal } from "@/lib/jornal-escola-tipos";
import { rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";
import { normalizarSerie } from "@/lib/series";

import { EscolhaDeTurma } from "./escolha-de-turma";
import { PainelDaAulaJornalEscola } from "./painel-da-aula-jornal-escola";
import { PreparoJornalEscola } from "./preparo-jornal-escola";
import { SeletorDePacote } from "./seletor-de-pacote";
import { ZerarTurmaJornalEscola } from "./zerar-turma-jornal-escola";

const EXP_ID = "exp04ef1b";

/**
 * A aula do JORNAL DA ESCOLA: tudo o que o professor faz com a turma, numa
 * página, nesta ordem — (a) o preparo do pacote, (b) o painel ao vivo com o
 * botão único, o gráfico para projetar, o radar e a folha por computador, (c) o
 * zerar e (d) o painel de habilidades.
 *
 * A ORDEM é a da aula, e não a da importância: antes da aula o professor
 * prepara; durante, olha o botão e o "X de Y publicaram"; depois, lê a
 * habilidade. A mesa do preparo nasce FECHADA para não empurrar o botão para
 * fora da tela no meio da aula. Molde: `resultados-a-selecao.tsx` (exp07ef1b).
 *
 * Como cada rota da api é consumida (o contrato é
 * `apps/api/src/jornal-escola/contrato-de-rotas.ts`):
 *
 * - **daqui (servidor, `apiDoServidor`)**: `GET /jornal-escola/turmas`, `GET
 *   .../painel`, `GET .../pacotes` (o ativo COM gabarito e o histórico), `GET
 *   /jornal-escola/professor/material` (o roteiro da mediação que o painel
 *   mostra ao lado do botão), as equipes da missão e o painel de habilidades
 *   com `atividadeId = pacoteId`;
 * - **do navegador, pelo BFF** (`/api/plataforma/jornal-escola/...`): gerar,
 *   regenerar, homologar, o banco padrão de 1 toque, as imagens, o gate, o
 *   zerar e o `GET .../painel` do polling.
 *
 * **Missão com ficha pedagógica (E14)**: a atividade é o PACOTE, a rodada é o
 * "Zerar", e `?pacote=` escolhe qual — o padrão é o em andamento.
 *
 * A REGRA QUE ESTA TELA APLICA: nenhuma coluna de nível, nota ou acerto na
 * folha (`PROIBIDO_NA_LINHA_DO_PAINEL`, na api). Quantas notícias cada um
 * verificou existe só no histograma anônimo; o nível mora no painel de
 * habilidades, com a origem e o ajuste do professor.
 */
export async function ResultadosJornalEscola({
  missao,
  turma,
  pacote,
}: {
  missao: Missao;
  turma: string;
  /** `?pacote=` — a atividade que o painel de habilidades lê. Vazio = o em andamento. */
  pacote: string;
}) {
  const rotaBase = `${rotaDaMissao(missao)}/resultados`;
  const guia = missao.expId ? rotaDoGuiaDaMissao(missao.expId) : null;

  const lista = await apiDoServidor<{ turmas: TurmaDoJornal[] }>("/jornal-escola/turmas");
  /* O filtro por série FICA — ele diz quais salas podem rodar esta missão. Sem
     turma da série, o certo é dizer isso (e não oferecer as outras). */
  const turmas = (lista?.turmas ?? [])
    .filter((t) => normalizarSerie(t.serie) === "4EF")
    .map((t) => ({ id: t.id, nome: t.nome, estudantes: t.estudantes }));
  const aviso =
    turmas.length === 0
      ? "Você não tem turma de 4º ano, e esta missão é dessa série. Para conduzir uma missão, entre pela turma em Minhas turmas."
      : undefined;

  const base = `/jornal-escola/turmas/${encodeURIComponent(turma)}`;
  const [painel, pacotes, material, equipes, session] = turma
    ? await Promise.all([
        apiDoServidor<PainelDoJornal>(`${base}/painel`),
        apiDoServidor<PacotesDaTurma>(`${base}/pacotes`),
        /* O roteiro da mediação (copy revisada, §4b) mora na api, junto do
           guia: a frase que o professor diz ao apertar muda sem republicar o hub. */
        apiDoServidor<MaterialDoJornal>("/jornal-escola/professor/material"),
        /* A linha desta api traz só o NOME da equipe; os membros vêm das
           equipes da missão, para a primeira célula dizer quem senta ali. */
        equipesDaMissao(turma, EXP_ID),
        auth(),
      ])
    : [null, null, null, null, null];

  const membros: Record<string, MembroNoPainel[]> = Object.fromEntries(
    (equipes?.equipes ?? []).map((e) => [e.id, e.membros]),
  );

  /* A atividade do painel de habilidades: a pedida, se ela é DESTA turma, e
     senão a em andamento. Um id de outra turma (link velho, colado à mão) não
     chega à api como se fosse desta. */
  const historico = pacotes?.historico ?? [];
  const pedido = historico.find((h) => h.id === pacote);
  const atividadeId = pedido?.id ?? pacotes?.ativo.id ?? painel?.pacote.id ?? null;
  const habilidades =
    turma && atividadeId && missao.expId ? await painelDeHabilidades(turma, missao.expId, atividadeId) : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Esta missão chama a tela de "A aula e os resultados" (ela prepara o
          pacote e libera as etapas, não só relata): o rótulo do registro de
          rotas é o genérico e quem o corrige é a página. */}
      <RotuloDaTrilha valor="A aula e os resultados" />

      <header className="flex flex-col gap-1">
        <p className="text-[12px] uppercase tracking-widest text-unooria-neutral-500">{missao.titulo}</p>
        <h1 className="text-[24px] font-bold leading-tight text-unooria-neutral-950">A aula e os resultados</h1>
        <p className="max-w-3xl text-[14px] leading-relaxed text-unooria-neutral-700">
          É daqui que você prepara o pacote de notícias, libera o resultado e a revisão com o botão da aula, e
          lê o retrato da turma: não quem acertou, mas <strong>o que cada capa publicou</strong> e o que mudou
          da 1ª para a 2ª edição. O gráfico anônimo pode ir para o projetor; o radar e a folha, não.
        </p>
        {/* O guia à mão: é aqui que o professor está DURANTE a aula, e é daqui
            que ele relê o roteiro sem perder o painel de vista. */}
        {guia ? (
          <p className="text-[13px] font-semibold">
            <Link href={guia} className="text-unooria-navy-900 hover:text-unooria-neutral-950">
              Abrir o guia da aula
            </Link>
          </p>
        ) : null}
      </header>

      <EscolhaDeTurma turmas={turmas} turmaId={turma} rotaBase={rotaBase} aviso={aviso} />

      {turma === "" ? (
        <Card variant="elevated">
          <p className="text-[14px] text-unooria-neutral-700">
            Escolha a turma acima. O pacote de notícias, os dois portões da aula e a folha são por turma, e valem
            só para a que você escolher.
          </p>
        </Card>
      ) : painel === null || pacotes === null ? (
        <EmptyState
          variant="no-data"
          size="lg"
          bordered
          fullWidth
          title="Não conseguimos abrir esta turma"
          description="Confira se a turma é desta escola e tente de novo."
        />
      ) : (
        <>
          {/* A `key` NÃO é otimização: todo o preparo vive em `useState`, e o
              seletor troca de turma com `router.push` para esta MESMA rota.
              Sem ela o formulário da turma anterior fica na tela — e "Aprovar"
              publica na turma nova o pacote da antiga. */}
          <PreparoJornalEscola key={turma} turmaId={turma} inicial={pacotes} />

          <PainelDaAulaJornalEscola
            key={`aula-${turma}`}
            turmaId={turma}
            inicial={painel}
            roteiro={material?.roteiro ?? null}
            membros={membros}
          />

          <ZerarTurmaJornalEscola turmaId={turma} nomeDaTurma={painel.turma.nome} tema={painel.pacote.tema} />

          {/* O painel de habilidades (E14) — invisível sem ficha
              (`temFicha: false`), e só o `professor` confirma e ajusta: a
              coordenação lê. A `key` é a atividade: trocar de pacote recomeça o
              recorte e a seleção dele. */}
          {habilidades?.temFicha && atividadeId ? (
            <div className="flex flex-col gap-3" data-habilidades-do-jornal>
              {historico.length > 1 ? (
                <div className="max-w-xl">
                  <SeletorDePacote historico={historico} pacoteId={atividadeId} rotaBase={rotaBase} turmaId={turma} />
                </div>
              ) : null}
              <PainelDeHabilidades
                key={atividadeId}
                turmaId={turma}
                expId={EXP_ID}
                atividadeId={atividadeId}
                inicial={habilidades}
                podeEditar={session?.usuario.papel === "professor"}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
