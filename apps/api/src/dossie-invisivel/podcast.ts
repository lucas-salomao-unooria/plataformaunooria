import { Injectable, type OnModuleInit } from "@nestjs/common";
import type { AiFalante } from "../ai/provider";
import type { FonteDoPodcast } from "../podcast/fonte";
import { PodcastService } from "../podcast/podcast.service";
import type { FalaDoPodcast, FalasDoTema, PedidoDeVoz, TrechoDoRoteiro, VagaDoTema } from "../podcast/roteiro";
import { EXP_ID } from "./conteudo";
import { DossieInvisivelService } from "./dossie-invisivel.service";

/**
 * O PODCAST DE RECAPITULAÇÃO de O Dossiê Invisível (ADR-150, ADR-202) —
 * "Recapitulação Unooria", Lucas e Bianca.
 *
 * O texto é o do one-pager v5 §11 (e do banco `01e`), LITERAL, com UMA
 * mudança de roteiro aprovada pelo Lucas em 2026-10-29: o bloco 4 contava o
 * caso de Lia e Davi (a Etapa 6, que não existe nesta versão), e foi reescrito
 * para a provocação não citar um caso que a turma não viu. A última fala da
 * Bianca no bloco 4 é a do original. Fica mais curto (cerca de 3 min 15 s).
 *
 * FIXO (sem vaga, sem IA, sem edição do professor) e SÓ DO PROFESSOR, como a
 * exp03em1b: a tela do estudante não menciona o podcast; o episódio é tocado
 * em aula, depois da Etapa 5 (o one-pager pede depois da virada).
 */

export const BLOCOS_DO_PODCAST = ["abertura", "recapitulacao", "revelacao", "provocacao", "encerramento"] as const;

const TITULOS: Record<(typeof BLOCOS_DO_PODCAST)[number], string> = {
  abertura: "Abertura",
  recapitulacao: "Recapitulação",
  revelacao: "Revelação",
  provocacao: "Provocação",
  encerramento: "Encerramento",
};

const FALAS: Record<(typeof BLOCOS_DO_PODCAST)[number], readonly FalaDoPodcast[]> = {
  abertura: [
    {
      falante: "Lucas",
      texto:
        "Fala, pessoal! Bem-vindos ao Recapitulação Unooria. Hoje a gente acompanhou a turma do 9º ano encarando uma responsabilidade pesada: gerenciar uma verba de doze mil reais para projetos sociais locais usando um assistente de inteligência artificial.",
    },
    {
      falante: "Bianca",
      texto:
        "É isso, Lucas! Na tela, parecia uma tarefa simples: perguntar para a IA, olhar quem tinha mais dados e assinar o repasse. Mas o que parecia uma decisão técnica virou um baita dilema ético!",
    },
  ],
  recapitulacao: [
    {
      falante: "Lucas",
      texto:
        "Exatamente. De um lado, a gente tinha o projeto Conexão para Continuar, da Luana, cheio de relatórios mensais em PDF, gráficos lindos e métricas em nuvem. Do outro lado, o Mesa Aberta, do João, que oferece refeição diária para dezenas de estudantes no contraturno, mas não tinha quase nada no sistema.",
    },
    {
      falante: "Bianca",
      texto:
        "E aí a IA fez o que foi programada para fazer com os dados que tinha: carimbou o Mesa Aberta como de alto risco e recomendou repassar todo o recurso para a oficina de informática. E muita gente na sala seguiu a recomendação da máquina e registrou o voto!",
    },
  ],
  revelacao: [
    {
      falante: "Lucas",
      texto:
        "Mas aí veio a grande virada da nossa investigação. Quando a equipe foi a campo, descobriu que o João tinha tudo registrado, sim! Só que em cadernos de papel, com assinaturas diárias, controle calórico e presenças reais de famílias atendidas.",
    },
    {
      falante: "Bianca",
      texto:
        "E quando esses cadernos foram digitalizados e alimentados na IA, mantendo as mesmas regras de custo e atendimento... adivinha? A recomendação inverteu na hora! O Mesa Aberta passou para o primeiro lugar. A inteligência artificial não estava avaliando o impacto humano; ela estava medindo apenas quem tinha equipamento para gerar PDF!",
    },
  ],
  provocacao: [
    {
      falante: "Lucas",
      /* Reescrita (2026-10-29): o original contava o caso de Lia e Davi, a Etapa 6 que saiu desta versão. */
      texto:
        "E isso não fica só no conselho. Pensa em quantas vezes alguém é avaliado só pelo que ficou registrado num sistema: uma frequência, um cadastro, um pedido de benefício. Se o registro não está lá, parece que a pessoa nem fez nada.",
    },
    {
      falante: "Bianca",
      texto: "Pois é! Não dá para punir ou premiar ninguém confiando cegamente no que a máquina mostra sem antes perguntar: quem teve condições de colocar dados no sistema?",
    },
  ],
  encerramento: [
    { falante: "Lucas", texto: "A IA calcula padrões nos dados do passado, mas a responsabilidade pela justiça da decisão é 100% humana." },
    { falante: "Bianca", texto: "Até a próxima missão, conselheiros!" },
  ],
};

/** A missão tem tema, mas o PODCAST é fixo: o roteiro não tem vaga. */
export const VAGAS_DO_PODCAST: readonly VagaDoTema[] = [];
export const FALAS_DO_TEMA_PADRAO: FalasDoTema = {};

export function roteiroDoPodcast(): TrechoDoRoteiro[] {
  return BLOCOS_DO_PODCAST.map((bloco) => ({ bloco, titulo: TITULOS[bloco], falas: FALAS[bloco].map((f) => ({ ...f })) }));
}

export const FALANTES_DO_PODCAST: AiFalante[] = [
  { nome: "Lucas", timbre: "jovem-masculino" },
  { nome: "Bianca", timbre: "jovem-feminino" },
];

export const DIRECAO_DO_PODCAST =
  "Podcast em português do Brasil, gravado por dois jovens apresentadores de cerca de 15 anos, Lucas e Bianca, falando com estudantes do 9º ano que acabaram de decidir a verba de um conselho comunitário com a ajuda de um assistente de IA. " +
  "Conversa natural, ritmo firme e próximo, sem tom de professor dando aula e sem infantilizar; as falas se emendam com pausas curtas.";

/** Suba quando a direção, os timbres ou o texto fixo mudarem. */
export const VERSAO_DO_PEDIDO_DE_VOZ = 1;

export const VOZ_DO_PODCAST: PedidoDeVoz = { prefixo: "podcast", versao: VERSAO_DO_PEDIDO_DE_VOZ, direcao: DIRECAO_DO_PODCAST };

/** O Dossiê Invisível no podcast da plataforma (ADR-150): a atividade é o PACOTE aprovado; o roteiro é FIXO. */
export function fonteDoPodcastDaExp09ef1b(missao: DossieInvisivelService): FonteDoPodcast {
  return {
    expId: EXP_ID,
    titulo: "Recapitulação Unooria — O Dossiê Invisível",
    descricao: "Lucas e Bianca · cerca de 3 min 15 s",
    falantes: FALANTES_DO_PODCAST,
    voz: VOZ_DO_PODCAST,
    vagas: VAGAS_DO_PODCAST,
    falasPadrao: { ...FALAS_DO_TEMA_PADRAO },
    roteiro: roteiroDoPodcast,
    async atividade(escolaId, turmaId, professorId, atividadeId) {
      const pacote = await missao.pacoteParaPodcast(escolaId, turmaId, professorId, atividadeId);
      return { id: pacote.id, tema: pacote.tema, padrao: true };
    },
  };
}

/** Registra a fonte na subida — o `PodcastService` não importa missão nenhuma. */
@Injectable()
export class PodcastDaExp09ef1b implements OnModuleInit {
  constructor(
    private readonly podcast: PodcastService,
    private readonly missao: DossieInvisivelService,
  ) {}

  onModuleInit(): void {
    this.podcast.registrarFonte(fonteDoPodcastDaExp09ef1b(this.missao));
  }
}
