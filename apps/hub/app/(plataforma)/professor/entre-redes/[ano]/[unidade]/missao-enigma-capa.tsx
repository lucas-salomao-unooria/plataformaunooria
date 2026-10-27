import { FichaDeConducao } from "@/components/ficha/ficha-de-conducao";
import { rotuloDaMissao, type Ano, type Missao } from "@/lib/entre-redes/catalogo";
import { rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";
import type { TurmaDoProfessor } from "@/lib/turmas";

import { AtividadesDaMissao } from "./atividades-da-missao";

/**
 * Corpo de O ENIGMA DA CAPA DA RÁDIO (2º ano · Unidade 1, ADR-184; 2.0.0, ADR-186).
 *
 * **Existe porque a ausência dele é MUDA**: sem ramo no despachante de
 * `page.tsx`, a missão cairia no corpo do Instanooria. O
 * `despachante-da-ficha.test.ts` é a rede.
 *
 * Abre com o fato que muda a condução: a missão só abre com uma atividade sua
 * em andamento, e a virada é UM botão, para a turma toda (decisão do Lucas,
 * 2026-10-26 — o one-pager falava em liberação por estudante).
 */
export function MissaoEnigmaCapa({
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
      etiquetas={["EF02CO05", "EF02CO01", "Individual"]}
      guia={guia}
      aviso={{
        tipo: "warning",
        titulo: "A missão só abre com uma atividade sua em andamento — e a virada é você quem libera",
        texto:
          "Crie a atividade (USAR BANCO PADRÃO (BIBLIOTECA) é um toque) e ponha em andamento. Quem publica a capa espera em AGUARDE O PROFESSOR; depois da conversa, LIBERAR VIRADA, na página da atividade, abre a comparação para a turma toda, uma vez só.",
      }}
      conducao={<AtividadesDaMissao missao={missao} expId="exp02ef1b" turma={turma} />}
      segredo={
        <>
          <p>
            <strong className="text-unooria-neutral-950">As duas fotos são do mesmo lugar, no mesmo minuto.</strong> Os
            rótulos são neutros (“FOTO 1 — BIBLIOTECA 14:15”) e nada na tela conta isso antes da virada: a criança
            descobre tocando nos dois objetos iguais do fundo e deslizando a comparação até a cena inteira.
          </p>
          <p>
            <strong className="text-unooria-neutral-950">A visitante só conta o que o recorte mostrou.</strong> Se a
            ação principal da foto ficou fora da moldura, ela diz só o nome do lugar — é a consequência do
            enquadramento, sem explicação do Bento.
          </p>
          <p>
            Nenhuma foto e nenhum selo é “certo”: as duas fotos são verdadeiras. O PUBLICAR CAPA não volta, e a
            missão termina quando a criança põe a segunda foto no álbum.
          </p>
          <p className="text-[13px] text-unooria-neutral-500">
            A missão não coleta foto, rosto nem texto da criança: tudo é toque e arraste, e você acompanha cada uma
            pelo nome, na página da atividade. As duas habilidades são registradas pelo que ela FAZ, no painel de
            habilidades da atividade.
          </p>
        </>
      }
    />
  );
}
