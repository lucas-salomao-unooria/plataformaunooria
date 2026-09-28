import Link from "next/link";

import { Card, EmptyState } from "@edu/ui/ds";
import { PainelDeHabilidades } from "@/components/evidencias/painel-de-habilidades";
import { RotuloDaTrilha } from "@/components/trilha";
import { apiDoServidor } from "@/lib/api-servidor";
import { auth } from "@/lib/auth";
import { painelDeHabilidades } from "@/lib/evidencias-servidor";
import { rotaDaMissao, type Missao } from "@/lib/entre-redes/catalogo";
import { rubricaDaRodada } from "@/lib/quem-mandou-regras";
import type { MaterialDoProfessor, PacoteDaTurma, PainelDaTurma } from "@/lib/quem-mandou-tipos";
import { comTurma, rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";
import { salaDaTurma } from "@/lib/salas";
import { normalizarSerie } from "@/lib/series";
import { minhasTurmas } from "@/lib/turmas";

import { EscolhaDeTurma } from "./escolha-de-turma";
import { PainelDaAulaQuemMandou } from "./painel-da-aula-quem-mandou";
import { PreparoQuemMandou, type LiberacaoNaSala } from "./preparo-quem-mandou";
import { ZerarTurmaQuemMandou } from "./zerar-turma-quem-mandou";

/**
 * A aula de QUEM MANDOU ISSO? v2.2: o preparo do pacote, os três botões, o
 * Termômetro, a folha da turma e as habilidades da BNCC — tudo por turma.
 *
 * Como cada rota da api é consumida (o contrato é
 * `apps/api/src/quem-mandou-isso/contrato-de-rotas.ts`):
 *
 * - **daqui (servidor, `apiDoServidor`)**: `GET .../turmas/:id/pacote` (o
 *   ativo, o rascunho, o banco curado e as disciplinas), `GET .../painel`, `GET
 *   /quem-mandou-isso/professor/material` (só pelos rótulos da enquete e do
 *   `Se`, que a folha e o Termômetro mostram como a criança leu), a sala da
 *   turma (a liberação, ADR-69) e o painel de habilidades da E14 com
 *   `atividadeId = pacoteId`;
 * - **do navegador, pelo BFF** (`/api/plataforma/quem-mandou-isso/...`):
 *   `POST /gerar`, `POST /aprovar`, `POST /gate`, `POST /nova-rodada` e o `GET
 *   /painel` do polling — a professora aperta na frente da sala.
 *
 * A turma vem da lista do professor (`GET /turmas/minhas`) filtrada pela série
 * da missão: a api desta missão não tem rota de lista, e as turmas de outra
 * série não são ruído, são o convite a abrir a turma errada. Turma que ele não
 * leciona responde 404 na api — e a tela diz que não conseguiu abrir.
 */
export async function ResultadosQuemMandouIsso({ missao, turma }: { missao: Missao; turma: string }) {
  const expId = missao.expId ?? "exp05ef1b";
  const rotaBase = `${rotaDaMissao(missao)}/resultados`;
  const guia = rotaDoGuiaDaMissao(expId);

  const [todas, session] = await Promise.all([minhasTurmas(), auth()]);
  /* O filtro por série FICA — ele diz quais salas podem rodar esta missão. Sem
     turma da série, o certo é dizer isso (e não oferecer as outras). */
  const turmas = todas
    .filter((t) => normalizarSerie(t.serie) === "5EF")
    .map((t) => ({ id: t.id, nome: t.nome, estudantes: t.estudantes }));
  const aviso =
    turmas.length === 0
      ? "Você não tem turma de 5º ano, e esta missão é dessa série. Para conduzir uma missão, entre pela turma em Minhas turmas."
      : undefined;
  /* Só o professor prepara e conduz; a api recusaria o resto de qualquer jeito. */
  const podeConduzir = session?.usuario.papel === "professor";

  const caminho = `/quem-mandou-isso/turmas/${encodeURIComponent(turma)}`;
  const [pacote, painel, material, sala] = turma
    ? await Promise.all([
        apiDoServidor<PacoteDaTurma>(`${caminho}/pacote`),
        apiDoServidor<PainelDaTurma>(`${caminho}/painel`),
        apiDoServidor<MaterialDoProfessor>("/quem-mandou-isso/professor/material"),
        podeConduzir ? salaDaTurma(turma) : Promise.resolve(null),
      ])
    : [null, null, null, null];

  const atividade = painel?.atividade ?? null;
  const habilidades =
    turma && atividade ? await painelDeHabilidades(turma, expId, atividade.pacoteId) : null;
  /* A rubrica do Se/Então (ADR-120): o que o professor já classificou NESTA rodada. */
  const rubrica =
    podeConduzir && atividade && habilidades?.temFicha ? rubricaDaRodada(habilidades.estudantes, atividade) : null;

  const naSala = sala?.missoes.find((m) => m.expId === expId);
  const liberacao: LiberacaoNaSala | null = naSala
    ? {
        estado: naSala.estado,
        em: naSala.estado === "encerrada" ? naSala.encerradaEm : naSala.liberadaEm,
      }
    : null;
  /* As mensagens que a folha nomeia são as do pacote que a turma está usando —
     e só se ele for o MESMO da atividade do painel (outra aba pode ter
     aprovado um novo entre as duas leituras). */
  const mensagens = pacote?.ativo && atividade && pacote.ativo.id === atividade.pacoteId ? pacote.ativo.mensagens : [];
  const opcoes = material?.opcoes ?? { motivos: [], condicoes: [] };

  return (
    <div className="flex flex-col gap-6">
      {/* Esta missão chama a tela de "A aula e os resultados" (ela prepara o
          pacote e libera a revelação, não só relata): o rótulo do registro de
          rotas é o genérico e quem o corrige é a página. */}
      <RotuloDaTrilha valor="A aula e os resultados" />

      <header className="flex flex-col gap-1">
        <p className="text-[12px] uppercase tracking-widest text-unooria-neutral-500">{missao.titulo}</p>
        <h1 className="text-[24px] font-bold leading-tight text-unooria-neutral-950">A aula e os resultados</h1>
        <p className="max-w-3xl text-[14px] leading-relaxed text-unooria-neutral-700">
          É daqui que você prepara o pacote de mensagens da turma, libera a revelação, a síntese e a
          reflexão, e acompanha o que cada estudante escolheu. Os selos das mensagens e a folha com
          nomes são só para a sua tela: <strong>para o telão, use Projetar o Termômetro</strong>.
        </p>
        {/* O guia da aula, à mão: é nesta tela que a professora está DURANTE a
            aula, e é daqui que ela precisa reler o roteiro sem perder o painel. */}
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
            Escolha a turma acima. O pacote de mensagens, os três botões da aula e a folha são por turma,
            e valem só para a que você escolher.
          </p>
        </Card>
      ) : pacote === null || painel === null ? (
        <EmptyState
          variant="no-data"
          size="lg"
          bordered
          fullWidth
          title="Não conseguimos abrir esta turma"
          description="Confira se a turma é sua e desta escola, e tente de novo."
        />
      ) : (
        <>
          {/* As `key` NÃO são otimização: o preparo e o painel guardam estado em
              `useState(inicial)`, e trocar de turma pela URL sem remontar
              mostraria (e aprovaria) o pacote de uma turma na outra. */}
          <PreparoQuemMandou
            key={`preparo-${turma}`}
            turmaId={turma}
            inicial={pacote}
            podeConduzir={podeConduzir}
            liberacao={liberacao}
            rotaDaSala={`/professor/turmas/${encodeURIComponent(turma)}?aba=missoes`}
            rotaDaFicha={comTurma(rotaDaMissao(missao), turma)}
          />

          <PainelDaAulaQuemMandou
            key={`painel-${turma}`}
            turmaId={turma}
            inicial={painel}
            mensagens={mensagens}
            opcoes={opcoes}
            podeConduzir={podeConduzir}
            rubrica={rubrica}
          />

          {/* EVIDÊNCIA (E14): a atividade é o PACOTE aprovado; a rodada é a
              reaplicação, e o próprio painel mostra as rodadas e o resultado.
              A `key` na atividade remonta o painel quando um pacote novo é
              aprovado — a atividade de antes fica no perfil do estudante. */}
          {atividade && habilidades?.temFicha ? (
            <PainelDeHabilidades
              key={`habilidades-${turma}-${atividade.pacoteId}`}
              turmaId={turma}
              expId={expId}
              atividadeId={atividade.pacoteId}
              inicial={habilidades}
              podeEditar={podeConduzir}
            />
          ) : null}

          {podeConduzir && atividade ? (
            <ZerarTurmaQuemMandou
              key={`zerar-${turma}-${atividade.pacoteId}-${atividade.rodada}`}
              turmaId={turma}
              nomeDaTurma={painel.turma.nome}
              rodada={atividade.rodada}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
