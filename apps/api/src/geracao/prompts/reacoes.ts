import type { AiJsonSchema, AiProvider } from "../../ai/provider";
import { filtrarReacoes, MAX_CARACTERES, type Reacao } from "./reacao-segura";
import { logger } from "../../observabilidade/logger";

/**
 * Personas reagindo **ao vivo** ao que o estudante publica ou comenta.
 *
 * O que faz isto valer o risco: no momento em que a criança publica algo, ela
 * espera reação. Um feed que nunca responde é obviamente falso, e a atividade
 * inteira depende de o aparelho parecer um app de verdade até a revelação.
 *
 * O risco é real e tratado em três camadas, nesta ordem:
 *
 * 1. **Prompt restritivo** — regras duras, elenco fechado, tamanho curto.
 * 2. **`filtrarReacoes`** — validação pura e exaustivamente testada, que é a
 *    última barreira antes da tela. Nada passa sem ela.
 * 3. **Falha fechada** — qualquer erro (modelo, rede, validação) resulta em
 *    NENHUMA reação. Silêncio é sempre seguro.
 *
 * E uma quarta, fora daqui: o professor desliga a IA ao vivo por atividade
 * (`activities.ia_ao_vivo`) sem precisar de deploy.
 *
 * Diferença para o projeto origem: o provider chega por parâmetro (token
 * AI_PROVIDER do AiModule) — este arquivo não conhece o vendor.
 */
export interface PersonaParaReagir {
  handle: string;
  displayName: string;
  /** Como essa persona fala — vem do banco, escrito na geração em lote. */
  voz: string;
  /** Ficha de linguagem do perfil de Schwartz a que a persona é afim. */
  perfil: string;
}

const ESQUEMA: AiJsonSchema = {
  type: "object",
  properties: {
    reacoes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          handle: { type: "string" },
          texto: { type: "string" },
        },
        required: ["handle", "texto"],
      },
    },
  },
  required: ["reacoes"],
};

const REGRAS = `
REGRAS DURAS. Quebrar qualquer uma faz a reação ser descartada:
- Escreva como adolescente brasileiro de 13 a 14 anos escreve num comentário: curto,
  informal, no máximo ${MAX_CARACTERES} caracteres. Uma frase, no máximo duas.
- Use SOMENTE os handles do elenco abaixo. Nunca invente perfil.
- Discorde da IDEIA quando fizer sentido. Nunca ofenda a pessoa.
- PROIBIDO: link, telefone, e-mail, rede social real, pedir foto, perguntar idade,
  onde mora ou onde estuda, propor encontro.
- PROIBIDO pedir curtida, seguida, salvamento ou compartilhamento.
- PROIBIDO falar de algoritmo, recomendação, viés, bolha, perfil de valores,
  experimento, simulação, professor, aula, escola ou inteligência artificial.
  Você é uma pessoa comum usando um app.
- Sem MAIÚSCULAS gritadas. Emoji com parcimônia.
`;

/** Constrói o prompt sem jamais pedir ao modelo que "seja seguro" — as regras são explícitas. */
function prompt(opts: {
  elenco: PersonaParaReagir[];
  perguntaChave: string;
  textoDoEstudante: string;
  contexto: string;
  quantas: number;
}): string {
  const elenco = opts.elenco
    .map((persona) => `- ${persona.handle} (${persona.displayName}): ${persona.voz}`)
    .join("\n");

  return `Você escreve comentários de perfis fictícios num app de fotos, num debate sobre:
"${opts.perguntaChave}"
 
ELENCO (use só estes handles):
${elenco}

${opts.contexto}
O QUE O ESTUDANTE ESCREVEU: "${opts.textoDoEstudante}"

Escreva ${opts.quantas} reação(ões) de perfis DIFERENTES do elenco, reagindo ao que ele
escreveu. Cada perfil fala do jeito dele. Reaja ao CONTEÚDO — concorde, discorde,
acrescente um fato, faça uma pergunta sobre a ideia.
${REGRAS}`;
}

/**
 * Gera e **filtra** as reações. Devolve só o que passou.
 *
 * Nunca lança: quem chama está no meio de uma interação do estudante, e uma exceção
 * aqui não pode derrubar a publicação dele. Erro vira lista vazia.
 */
export async function gerarReacoes(
  provider: AiProvider,
  opts: {
    elenco: PersonaParaReagir[];
    perguntaChave: string;
    textoDoEstudante: string;
    /** Uma frase dizendo a que ele reagiu — post próprio ou post do feed. */
    contexto: string;
    quantas?: number;
  },
): Promise<{ reacoes: Reacao[]; recusadas: number }> {
  if (opts.elenco.length === 0 || opts.textoDoEstudante.trim().length === 0) {
    return { reacoes: [], recusadas: 0 };
  }

  const quantas = Math.min(3, Math.max(1, opts.quantas ?? 2));
  const handles = opts.elenco.map((persona) => persona.handle);

  try {
    const bruto = await provider.generateJson<{ reacoes: unknown }>({
      prompt: prompt({ ...opts, quantas }),
      system:
        "Você escreve comentários curtos de perfis fictícios para adolescentes. " +
        "Obedece às regras duras sem exceção. Devolve apenas JSON.",
      responseSchema: ESQUEMA,
      // Uma tentativa só: o estudante está esperando. Regerar dobraria a espera.
      tentativas: 1,
      temperatura: 1.1,
      validar: (resposta) => resposta as { reacoes: unknown },
    });

    const { aprovadas, recusadas } = filtrarReacoes(bruto.reacoes, handles);

    if (recusadas.length > 0) {
      // Registrado para auditoria: o professor não vê, mas nós precisamos saber
      // com que frequência o modelo tenta sair da linha.
      logger.warn(
        { codigo: "ia.reacoes-recusadas", quantas: recusadas.length, motivos: recusadas.map((r) => r.motivo) },
        "reações recusadas pelo guardrail",
      );
    }

    return { reacoes: aprovadas.slice(0, quantas), recusadas: recusadas.length };
  } catch (falha) {
    logger.error({ err: falha, codigo: "ia.reacoes-falhou" }, "geração de reação falhou; nada será exibido");
    return { reacoes: [], recusadas: 0 };
  }
}
