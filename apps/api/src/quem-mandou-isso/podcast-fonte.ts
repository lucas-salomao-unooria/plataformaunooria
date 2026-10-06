import { Injectable, type OnModuleInit } from "@nestjs/common";
import { z } from "zod";
import type { FonteDoPodcast } from "../podcast/fonte";
import { PodcastService } from "../podcast/podcast.service";
import { EXP_ID, type MensagemDoPacote } from "./catalogo";
import { MensagemDoPacoteSchema } from "./contrato-de-rotas";
import {
  FALANTES_DO_PODCAST,
  FALAS_DO_TEMA_PADRAO,
  VAGAS_DO_PODCAST,
  VOZ_DO_PODCAST,
  roteiroDoPodcast,
} from "./podcast";
import { mensagensSaoAsDoPadrao, QuemMandouIssoService } from "./quem-mandou-isso.service";

/**
 * Quem Mandou Isso? no podcast da plataforma (ADR-150): a atividade é o
 * PACOTE aprovado, e a escrita das falas lê as oito mensagens do rascunho que
 * a tela de criação tem.
 */

/** O conteúdo que a tela de criação manda: o tema e as oito mensagens do rascunho. */
export const ConteudoDoPodcastSchema = z.object({
  tema: z.string().trim().min(1).max(200),
  mensagens: z.array(MensagemDoPacoteSchema).length(8),
});
type ConteudoDoPodcast = z.infer<typeof ConteudoDoPodcastSchema>;

const TIPO: Record<MensagemDoPacote["tipo"], string> = { texto: "mensagem de texto", imagem: "imagem de aviso", link: "link" };

/**
 * O que a IA lê: cada mensagem com o remetente, o tipo, o texto, e o
 * gabarito (verdadeira/falsa × emocional/neutra). Quem lê é o professor — a
 * regra 3 protege o estudante, e o podcast toca depois da revelação.
 */
export function materialDoPodcast(conteudo: ConteudoDoPodcast): string {
  const linhas = conteudo.mensagens.map((m) =>
    [
      `- ${m.id} · ${TIPO[m.tipo]} · de ${m.remetente} · ${m.veracidade.toUpperCase()} e ${m.tom.toUpperCase()}`,
      `  Texto: ${m.texto}`,
      ...(m.legenda ? [`  ${m.tipo === "link" ? "Manchete do link" : "Texto da imagem"}: ${m.legenda}`] : []),
    ].join("\n"),
  );
  return `A confusão do grupo da turma: ${conteudo.tema}\n\nAs oito mensagens do grupo:\n${linhas.join("\n")}`;
}

export function fonteDoPodcastDaExp05ef1b(
  missao: Pick<QuemMandouIssoService, "pacoteParaPodcast" | "exigirTurmaVisivel">,
): FonteDoPodcast {
  return {
    expId: EXP_ID,
    titulo: "Quem Mandou Isso? — o podcast de recapitulação",
    descricao: "Lucas e Camila · cerca de 3 min 40 s",
    falantes: FALANTES_DO_PODCAST,
    voz: VOZ_DO_PODCAST,
    vagas: VAGAS_DO_PODCAST,
    falasPadrao: { ...FALAS_DO_TEMA_PADRAO },
    roteiro: roteiroDoPodcast,
    async atividade(escolaId, turmaId, professorId, atividadeId) {
      const pacote = await missao.pacoteParaPodcast(escolaId, turmaId, professorId, atividadeId);
      return { id: pacote.id, tema: pacote.tema, padrao: pacote.origem === "padrao" && mensagensSaoAsDoPadrao(pacote.mensagens) };
    },
    escrita: {
      conteudo: ConteudoDoPodcastSchema,
      exigirTurma: (escolaId, turmaId, professorId) => missao.exigirTurmaVisivel(escolaId, turmaId, professorId),
      ehPadrao: (conteudo) => mensagensSaoAsDoPadrao((conteudo as ConteudoDoPodcast).mensagens),
      material: (conteudo) => materialDoPodcast(conteudo as ConteudoDoPodcast),
      publico: "crianças de 10 e 11 anos do 5º ano do Ensino Fundamental",
    },
  };
}

/** Registra a fonte na subida — o `PodcastService` não importa missão nenhuma. */
@Injectable()
export class PodcastDaExp05ef1b implements OnModuleInit {
  constructor(
    private readonly podcast: PodcastService,
    private readonly missao: QuemMandouIssoService,
  ) {}

  onModuleInit(): void {
    this.podcast.registrarFonte(fonteDoPodcastDaExp05ef1b(this.missao));
  }
}
