import { Injectable, type OnModuleInit } from "@nestjs/common";
import { z } from "zod";
import type { FonteDoPodcast } from "../podcast/fonte";
import { PodcastService } from "../podcast/podcast.service";
import { noticiasPadrao } from "./catalogo";
import { NoticiaDoPacoteSchema, type NoticiaDoPacote } from "./contrato-de-rotas";
import { JornalEscolaService } from "./jornal-escola.service";
import {
  FALANTES_DO_PODCAST,
  FALAS_DO_TEMA_PADRAO,
  VAGAS_DO_PODCAST,
  VOZ_DO_PODCAST,
  roteiroDoPodcast,
} from "./podcast";
import { EXP_ID } from "./vocabulario";

/**
 * O Jornal da Escola no podcast da plataforma (ADR-150): a atividade é o
 * PACOTE (o carregador das imagens, com a guarda de turma), e a escrita das
 * falas lê as oito notícias do rascunho que a tela de criação tem.
 */

/** O conteúdo que a tela de criação manda: o tema e as oito notícias do rascunho. */
export const ConteudoDoPodcastSchema = z.object({
  tema: z.string().trim().min(1).max(60),
  noticias: z.array(NoticiaDoPacoteSchema).length(8),
});
type ConteudoDoPodcast = z.infer<typeof ConteudoDoPodcastSchema>;

/** JSON com as chaves em ordem: o JSONB do banco as reordena, e a tela as manda na ordem dela. */
function canonico(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(",")}]`;
  if (valor && typeof valor === "object") {
    const chaves = Object.keys(valor as Record<string, unknown>).sort();
    return `{${chaves.map((k) => `${JSON.stringify(k)}:${canonico((valor as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(typeof valor === "string" ? valor.trim() : valor);
}

/** As notícias são as do banco padrão, como a Unooria as escreveu? */
export function ehOBancoPadrao(noticias: readonly NoticiaDoPacote[]): boolean {
  return canonico([...noticias].sort((a, b) => a.id.localeCompare(b.id))) === canonico(noticiasPadrao());
}

const PAPEL: Record<string, string> = {
  data: "NÃO PUBLICÁVEL — notícia antiga apresentada como se fosse de hoje (falta a data certa)",
  fonte: "NÃO PUBLICÁVEL — aviso sem confirmação (falta a fonte)",
  autoria: "NÃO PUBLICÁVEL — aviso sem autoria (ninguém assina)",
};

/** O que a IA lê: cada notícia com o meio, a chamada, as pistas, o papel no gabarito e a reação dos leitores. */
export function materialDoPodcast(conteudo: ConteudoDoPodcast): string {
  const linhas = conteudo.noticias.map((n) =>
    [
      `- ${n.id} · ${n.meio} · ${n.veiculo}${n.legenda ? " · com imagem" : ""}`,
      `  Manchete: ${n.manchete}`,
      `  Resumo: ${n.resumo}`,
      `  Data: ${n.pistas.data} | Fonte: ${n.pistas.fonte} | Autoria: ${n.pistas.autoria}`,
      `  Papel: ${n.gabarito.pilarEmFalta ? PAPEL[n.gabarito.pilarEmFalta] : "PUBLICÁVEL"}`,
      `  Reação dos leitores (${n.consequencia.leitor}): ${n.consequencia.fala}`,
    ].join("\n"),
  );
  return `Tema do jornal: ${conteudo.tema}\n\nAs oito notícias da mesa:\n${linhas.join("\n")}`;
}

/** A fonte do Jornal no podcast da plataforma. */
export function fonteDoPodcastDaExp04ef1b(
  jornal: Pick<JornalEscolaService, "pacoteParaMidia" | "exigirTurmaVisivel">,
): FonteDoPodcast {
  return {
    expId: EXP_ID,
    titulo: "Jornal da Escola — o podcast de recapitulação",
    descricao: "Lucas e Clara · cerca de 3 min 30 s",
    falantes: FALANTES_DO_PODCAST,
    voz: VOZ_DO_PODCAST,
    vagas: VAGAS_DO_PODCAST,
    falasPadrao: { ...FALAS_DO_TEMA_PADRAO },
    roteiro: roteiroDoPodcast,
    async atividade(escolaId, turmaId, professorId, atividadeId) {
      const pacote = await jornal.pacoteParaMidia(escolaId, turmaId, professorId, atividadeId);
      return { id: pacote.id, tema: pacote.tema, padrao: pacote.origem === "padrao" && ehOBancoPadrao(pacote.noticias) };
    },
    escrita: {
      conteudo: ConteudoDoPodcastSchema,
      exigirTurma: (escolaId, turmaId, professorId) => jornal.exigirTurmaVisivel(escolaId, turmaId, professorId),
      ehPadrao: (conteudo) => ehOBancoPadrao((conteudo as ConteudoDoPodcast).noticias),
      material: (conteudo) => materialDoPodcast(conteudo as ConteudoDoPodcast),
      publico: "crianças de 9 e 10 anos do 4º ano do Ensino Fundamental",
    },
  };
}

/** Registra a fonte na subida — o `PodcastService` não importa missão nenhuma. */
@Injectable()
export class PodcastDaExp04ef1b implements OnModuleInit {
  constructor(
    private readonly podcast: PodcastService,
    private readonly jornal: JornalEscolaService,
  ) {}

  onModuleInit(): void {
    this.podcast.registrarFonte(fonteDoPodcastDaExp04ef1b(this.jornal));
  }
}
