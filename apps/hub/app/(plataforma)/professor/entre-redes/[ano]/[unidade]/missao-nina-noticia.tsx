import { FichaDeConducao } from "@/components/ficha/ficha-de-conducao";
import { rotuloDaMissao, type Ano, type Missao } from "@/lib/entre-redes/catalogo";
import { GATILHOS_DE_CONDUCAO, ROTEIRO_DE_MEDIACAO } from "@/lib/nina-noticia-tipos";
import { rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";
import type { TurmaDoProfessor } from "@/lib/turmas";

import { AtividadesDaMissao } from "./atividades-da-missao";

/**
 * Corpo de NINA E A NOTÍCIA QUE DESAPARECEU (3º ano · Unidade 1, ADR-197).
 *
 * **Existe porque a ausência dele é MUDA**: sem ramo no despachante de
 * `page.tsx`, a missão cairia no corpo do Instanooria. O
 * `despachante-da-ficha.test.ts` é a rede.
 *
 * Abre com o fato que muda a condução: a missão só abre com uma atividade em
 * andamento, e os dois portões (Liberar Filtro, Liberar Inspeção) são da
 * professora. A aba "Roteiro de mediação" traz as três perguntas do debate oral
 * na íntegra, com o cuidado de cada uma — o texto é o da api
 * (`lib/nina-noticia-tipos.ts`, conferido no teste).
 */
export function MissaoNinaNoticia({
  ano,
  missao,
  turma,
}: {
  ano: Ano;
  missao: Missao & { ficha: NonNullable<Missao["ficha"]> };
  turma: TurmaDoProfessor | null;
}) {
  const guia = missao.expId ? rotaDoGuiaDaMissao(missao.expId) : null;

  return (
    <FichaDeConducao
      contexto={rotuloDaMissao(ano, missao)}
      titulo={missao.titulo}
      resumo={missao.resumo}
      ficha={missao.ficha}
      etiquetas={["EF15CO08", "EF03CO01", "EF03CO02", "Em duplas"]}
      guia={guia}
      aviso={{
        tipo: "warning",
        titulo: "A missão só abre com uma atividade sua em andamento — e os portões da aula são seus",
        texto:
          "Crie a atividade (Usar Banco Padrão é um clique) e libere-a para a turma. Quem trava a escolha espera o seu Liberar Filtro; quem vê a notícia sumir espera o seu Liberar Inspeção. Pausar Turma congela todas as telas para a conversa.",
      }}
      conducao={<AtividadesDaMissao missao={missao} expId="exp03ef1b" turma={turma} />}
      abasExtras={[
        {
          id: "mediacao",
          rotulo: "Roteiro de mediação",
          icone: "record_voice_over",
          conteudo: <RoteiroDeMediacao />,
        },
      ]}
      segredo={
        <>
          <p>
            <strong className="text-unooria-neutral-950">As três fotos mostram o pátio, mas a ficha do telão tem o campo Onde vazio.</strong>{" "}
            Nada na tela conta isso antes da busca: a dupla trava a escolha, aplica o filtro Onde: Pátio e vê a
            notícia do telão sumir, deixando a moldura vazia.
          </p>
          <p>
            <strong className="text-unooria-neutral-950">A escolha travada não volta.</strong> É ela que dá força à
            descoberta: a dupla confronta o que esperava com o que a busca devolveu.
          </p>
          <p>
            Nenhum carimbo, ficha ou rotina recebe certo ou errado na tela antes do Concluir, e o reparo nunca pede
            para tentar de novo: com o Pátio fora do campo Onde, a tela explica como ficariam as três notícias.
          </p>
          <p className="text-[13px] text-unooria-neutral-500">
            A missão não coleta foto, voz nem texto da criança: tudo é toque. O painel da aula mostra só o progresso e
            os alertas de cada computador; as quatro habilidades são registradas pelo que a dupla FAZ, no painel de
            habilidades da atividade.
          </p>
        </>
      }
    />
  );
}

/** As três perguntas do debate, na íntegra, e os gatilhos de cada momento da aula. */
function RoteiroDeMediacao() {
  return (
    <div className="flex flex-col gap-5" data-roteiro-de-mediacao>
      <p className="max-w-3xl text-[14px] leading-relaxed text-unooria-neutral-700">
        No 3º ano a mediação é oral: leia em voz alta, devagar, e deixe as duplas responderem antes de você. As
        perguntas valem para a pausa depois do filtro e para o fechamento.
      </p>
      <ol className="flex max-w-3xl list-decimal flex-col gap-4 pl-5 text-[14px] leading-relaxed text-unooria-neutral-900">
        {ROTEIRO_DE_MEDIACAO.map(({ pergunta, cuidado }) => (
          <li key={pergunta} className="flex flex-col gap-1">
            <span className="font-semibold">“{pergunta}”</span>
            <span className="text-[13px] text-unooria-neutral-600">Cuidado de mediação oral: {cuidado}</span>
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-2">
        <p className="text-[14px] font-semibold text-unooria-neutral-950">Os três momentos da condução</p>
        <ol className="flex max-w-3xl list-decimal flex-col gap-1 pl-5 text-[13px] leading-relaxed text-unooria-neutral-700">
          {GATILHOS_DE_CONDUCAO.map((gatilho) => (
            <li key={gatilho}>{gatilho}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}
