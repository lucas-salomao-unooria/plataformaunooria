import { Injectable, type OnModuleInit } from "@nestjs/common";
import { EquipesService } from "../equipes/equipes.service";
import { ladosDaTurma } from "./distribuicao";

/** O Unoovista (exp08ef1b): a única missão com dois lados de feed. */
const UNOOVISTA = "exp08ef1b";

/**
 * O LADO DO FEED NO SORTEIO DE EQUIPES (H13.4.1).
 *
 * No Unoovista cada estudante nasce num lado do feed, e uma equipe com gente
 * dos dois diante da mesma tela desmancha a missão: a bolha que ela vive é a de
 * quem pegou o teclado. O módulo de equipes não conhece lado nenhum — ele expõe
 * `registrarFonteDeGrupo`, e é daqui, na subida, que o Unoovista diz como
 * saber o lado de cada um. A dependência é nesta direção: `perfis` conhece
 * `equipes`, nunca o contrário.
 */
@Injectable()
export class FonteDeLadoDoUnoovista implements OnModuleInit {
  constructor(private readonly equipes: EquipesService) {}

  onModuleInit(): void {
    this.equipes.registrarFonteDeGrupo(UNOOVISTA, async (tx, { escolaId, turmaId, atividadeId }) => {
      const atividade = await tx.activity.findFirst({
        where: { id: atividadeId, escolaId },
        select: { antagonismo: true },
      });
      const { lados, temAfinidade } = await ladosDaTurma(
        tx,
        atividadeId,
        atividade?.antagonismo ?? null,
        escolaId,
        turmaId,
      );
      return {
        grupos: lados,
        descricao: "O lado do feed de cada estudante, que vem do perfil da Vila do Lume.",
        aviso: temAfinidade
          ? null
          : "A pergunta e os dois lados ainda não foram aprovados: só quem já tem lado definido entra agrupado.",
      };
    });
  }
}
