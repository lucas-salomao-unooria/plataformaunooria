import { Injectable, type OnModuleInit } from "@nestjs/common";
import { z } from "zod";
import type { FonteDoPodcast } from "../podcast/fonte";
import { PodcastService } from "../podcast/podcast.service";
import { AreaSchema, ProjetoDoPacoteSchema } from "./contrato-de-rotas";
import { JuriEstadualService } from "./juri-estadual.service";
import {
  FALANTES_DO_PODCAST,
  FALAS_DO_TEMA_PADRAO,
  VAGAS_DO_PODCAST,
  VOZ_DO_PODCAST,
  roteiroDoPodcast,
} from "./podcast";
import { AREAS, EXP_ID, TOTAL_DE_PROJETOS } from "./vocabulario";

/**
 * O Júri Estadual no podcast da plataforma (ADR-150, ADR-151): a atividade é o
 * PACOTE (com a guarda de turma do service), e a escrita das falas lê os
 * dezesseis estandes do rascunho que a tela de criação tem.
 *
 * **Sem banco padrão** (a mostra é sempre da IA, decisão de 2026-10-02):
 * `padrao` é sempre `false` e `ehPadrao` nunca é verdade. Atividade sem falas
 * gravadas — a criada antes do podcast — responde 409 `roteiro-indisponivel`,
 * e o cartão da aula diz isso.
 */

/**
 * O conteúdo que a tela de criação manda: o rascunho da mostra. A FORMA do
 * `ConteudoDoPacoteSchema`, sem a régua da homologação — as falas se pedem de
 * novo com um estande ainda em edição, e quem barra a mostra torta é o
 * `homologar`.
 */
export const ConteudoDoPodcastSchema = z.object({
  tema: z.string().trim().min(3).max(60),
  categorias: z
    .array(z.object({ area: AreaSchema, nome: z.string().trim().min(2).max(30), hashtag: z.string().trim().max(40) }))
    .length(AREAS.length),
  projetos: z.array(ProjetoDoPacoteSchema).length(TOTAL_DE_PROJETOS),
});
type ConteudoDoPodcast = z.infer<typeof ConteudoDoPodcastSchema>;

/** O que a IA lê: as quatro áreas da mostra e os quatro estandes de cada uma. */
export function materialDoPodcast(conteudo: ConteudoDoPodcast): string {
  const areas = conteudo.categorias.map((c) => {
    const estandes = conteudo.projetos
      .filter((p) => p.area === c.area)
      .map((p) => `  - ${p.titulo} (${p.escola}): ${p.legenda}`);
    return [`Área "${c.nome}":`, ...estandes].join("\n");
  });
  return `Tema da mostra: ${conteudo.tema}\n\nAs quatro áreas e os dezesseis estandes:\n${areas.join("\n\n")}`;
}

/** A fonte do Júri no podcast da plataforma. */
export function fonteDoPodcastDaExp06ef1b(
  juri: Pick<JuriEstadualService, "pacoteParaPodcast" | "exigirTurmaVisivel">,
): FonteDoPodcast {
  return {
    expId: EXP_ID,
    titulo: "O Júri Estadual — A Mostra que Ninguém Viu Inteira",
    descricao: "Bia e Rafa · cerca de 3 min 45 s",
    falantes: FALANTES_DO_PODCAST,
    voz: VOZ_DO_PODCAST,
    vagas: VAGAS_DO_PODCAST,
    falasPadrao: { ...FALAS_DO_TEMA_PADRAO },
    roteiro: roteiroDoPodcast,
    async atividade(escolaId, turmaId, professorId, atividadeId) {
      const pacote = await juri.pacoteParaPodcast(escolaId, turmaId, professorId, atividadeId);
      return { id: pacote.id, tema: pacote.tema, padrao: false };
    },
    escrita: {
      conteudo: ConteudoDoPodcastSchema,
      exigirTurma: (escolaId, turmaId, professorId) => juri.exigirTurmaVisivel(escolaId, turmaId, professorId),
      ehPadrao: () => false,
      material: (conteudo) => materialDoPodcast(conteudo as ConteudoDoPodcast),
      publico: "pré-adolescentes de 11 e 12 anos do 6º ano do Ensino Fundamental",
    },
  };
}

/** Registra a fonte na subida — o `PodcastService` não importa missão nenhuma. */
@Injectable()
export class PodcastDaExp06ef1b implements OnModuleInit {
  constructor(
    private readonly podcast: PodcastService,
    private readonly juri: JuriEstadualService,
  ) {}

  onModuleInit(): void {
    this.podcast.registrarFonte(fonteDoPodcastDaExp06ef1b(this.juri));
  }
}
