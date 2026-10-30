import { Injectable, type OnModuleInit } from "@nestjs/common";
import type { FonteDoPodcast } from "../podcast/fonte";
import { PodcastService } from "../podcast/podcast.service";
import { EXP_ID } from "./conteudo";
import { ConteudoBaseSchema, type ConteudoDoPacoteDoContrato } from "./contrato-de-rotas";
import { EnigmaCapaService } from "./enigma-capa.service";
import {
  FALANTES_DO_PODCAST,
  FALAS_DO_TEMA_PADRAO,
  VAGAS_DO_PODCAST,
  VOZ_DO_PODCAST,
  falasDoPronto,
  prontoIntocado,
  roteiroDoPodcast,
} from "./podcast";

/**
 * O Enigma da Capa da Rádio no podcast da plataforma (ADR-150, ADR-204): a
 * atividade é o PACOTE homologado (o pedido, ou o em andamento), e as sete
 * vagas contam a cena DELE.
 *
 * - **Biblioteca intocada**: `padrao: true`, as falas do PO (o áudio de antes).
 * - **Horta e Museu intocados**: as falas escritas para eles, como
 *   `falasProprias` — o `banco-padrao` não passa por homologação, e não há
 *   linha na tabela.
 * - **A cena da IA e o pronto editado na curadoria**: as falas que o professor
 *   revisou e o `homologar` gravou na tabela. Sem linha (a atividade aprovada
 *   antes da ADR-204), 409 `roteiro-indisponivel`, e o cartão da aula diz isso.
 *
 * A linha na tabela vence o pronto: quem revisou as falas na curadoria ouve as
 * dele (`pacoteParaPodcast` só devolve `falasProprias` sem linha).
 */

/** O que a IA lê: o espaço, as duas fotos, os selos, a visitante, os dois objetos e o que pode ficar fora. */
export function materialDoPodcast(conteudo: ConteudoDoPacoteDoContrato): string {
  const c = conteudo.cena;
  const selo = (id: string) => c.selos.find((s) => s.id === id)?.texto ?? "";
  const fotos = c.fotos.map(
    (f, i) => `- Foto ${i + 1}: ${f.acao}. A visitante, vendo só esta foto, disse: "${f.visitante}". O selo que combina: "${selo(f.seloCoerente)}".`,
  );
  return [
    `Espaço da escola: ${c.espaco} (${c.espacoCurto}), às ${c.hora}.`,
    `A cena inteira: ${c.alt}`,
    `As duas fotos (cada uma mostra só um lado do espaço):`,
    ...fotos,
    `Os dois selos: "${c.selos[0]?.texto ?? ""}" e "${c.selos[1]?.texto ?? ""}".`,
    `Os dois objetos iguais do fundo, que aparecem nas duas fotos: ${c.invariantes.map((i) => i.nome.toLocaleLowerCase("pt-BR")).join(" e ")}.`,
    `O que pode ficar fora de uma foto: ${c.marcaveis.map((m) => m.nome.toLocaleLowerCase("pt-BR")).join(", ")}.`,
  ].join("\n");
}

/** A fonte da exp02ef1b no podcast da plataforma. */
export function fonteDoPodcastDaExp02ef1b(
  missao: Pick<EnigmaCapaService, "pacoteParaPodcast" | "exigirTurmaVisivel">,
): FonteDoPodcast {
  return {
    expId: EXP_ID,
    titulo: "Rádio Escola: O Enigma da Capa",
    descricao: "Iara e Bento · cerca de 3 min 30 s",
    falantes: FALANTES_DO_PODCAST,
    voz: VOZ_DO_PODCAST,
    vagas: VAGAS_DO_PODCAST,
    falasPadrao: { ...FALAS_DO_TEMA_PADRAO },
    roteiro: roteiroDoPodcast,
    atividade: (escolaId, turmaId, professorId, atividadeId) => missao.pacoteParaPodcast(escolaId, turmaId, professorId, atividadeId),
    escrita: {
      conteudo: ConteudoBaseSchema,
      exigirTurma: (escolaId, turmaId, professorId) => missao.exigirTurmaVisivel(escolaId, turmaId, professorId),
      ehPadrao: (conteudo) => prontoIntocado(conteudo as ConteudoDoPacoteDoContrato) === "biblioteca",
      falasProntas: (conteudo) => {
        const chave = prontoIntocado(conteudo as ConteudoDoPacoteDoContrato);
        return chave ? falasDoPronto(chave) : null;
      },
      material: (conteudo) => materialDoPodcast(conteudo as ConteudoDoPacoteDoContrato),
      publico: "crianças de 7 e 8 anos do 2º ano do Ensino Fundamental",
    },
  };
}

/** Registra a fonte na subida — o `PodcastService` não importa missão nenhuma. */
@Injectable()
export class PodcastDaExp02ef1b implements OnModuleInit {
  constructor(
    private readonly podcast: PodcastService,
    private readonly missao: EnigmaCapaService,
  ) {}

  onModuleInit(): void {
    this.podcast.registrarFonte(fonteDoPodcastDaExp02ef1b(this.missao));
  }
}
