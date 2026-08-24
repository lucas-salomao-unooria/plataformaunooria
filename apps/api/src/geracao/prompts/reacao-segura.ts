/**
 * A validação das reações que a IA escreve **ao vivo**, na frente de uma criança
 * de 13 anos.
 *
 * Esta é a única parte do sistema em que texto de modelo chega ao aluno sem
 * ninguém ter lido antes. Todo o resto do conteúdo é gerado em lote e o professor
 * aprova post por post. Aqui não há essa rede — então a rede é esta função.
 *
 * Três princípios, na ordem em que importam:
 *
 * 1. **Falha fechada.** Qualquer dúvida, a reação é descartada e nada aparece.
 *    Silêncio é sempre seguro; um comentário estranho num app que a criança acha
 *    real, não.
 * 2. **Sem estado e sem rede.** É função pura, então dá para testar exaustivamente
 *    o que é aceito e o que é recusado — e é isso que faz a proteção auditável.
 * 3. **O disfarce também é proteção.** Uma reação que mencione algoritmo ou
 *    professor não é "só" um vazamento de mecanismo: quebra a experiência que dá
 *    sentido à revelação no fim.
 *
 * O que NÃO fazemos: substituir por um texto genérico ("interessante!") quando a
 * validação recusa. Seria inventar uma fala e atribuí-la a uma persona — pior que
 * não ter fala nenhuma.
 */
import { PALAVRAS_BLOQUEADAS } from './guardrails';

/** Limite de tamanho. Comentário de rede social é curto; texto longo é sinal de que o modelo saiu do papel. */
export const MAX_CARACTERES = 180;
const MIN_CARACTERES = 3;

/**
 * Vocabulário que denuncia o mecanismo ou a escola. Reaproveita a lista de
 * geração em lote e acrescenta o que só faz sentido numa reação conversada.
 */
const VOCABULARIO_PROIBIDO = [
  ...PALAVRAS_BLOQUEADAS,
  'perfil de valores',
  'abertura à mudança',
  'autotranscendência',
  'autopromoção',
  'recomendação',
  'personalizado',
  'experimento',
  'aula',
  'educacional',
  'pedagóg',
];

/**
 * Padrões que não podem existir num comentário para criança, cada um por um
 * motivo diferente:
 *
 * - **contato e link**: uma persona não pede nem oferece meio de falar fora do app;
 * - **dado pessoal**: nada de "onde você mora", "quantos anos", "manda foto";
 * - **encontro**: qualquer combinação de encontrar-se fora dali;
 * - **ataque à pessoa**: discordar da ideia é o exercício; ofender não;
 * - **instrução de comportamento**: o motor mede comportamento espontâneo, então
 *   uma persona não pode pedir curtida, seguida ou salvamento (regra de ouro 3).
 */
const PADROES_PROIBIDOS: { nome: string; regex: RegExp }[] = [
  { nome: 'link', regex: /https?:\/\/|www\.|\.com\b|\.net\b|\.br\b/i },
  {
    nome: 'contato',
    // `discord` precisa de fronteira à direita: sem ela, "discordo" e "discordar"
    // eram recusados como contato — justamente o comportamento que a atividade
    // quer, que é discordar da ideia.
    regex: /whats|telegram|\bdiscord\b|zap\b|\bdm\b|chama no|meu (?:número|numero|insta)/i,
  },
  { nome: 'telefone', regex: /\b\d{4,}[-\s]?\d{4,}\b/ },
  { nome: 'email', regex: /[\w.+-]+@[\w-]+\.[\w.]+/ },
  {
    nome: 'dado pessoal',
    regex: /(?:onde|qual)\s+(?:você|vc|voce)\s+(?:mora|estuda)|quantos anos (?:você|vc|voce)|manda (?:uma )?(?:foto|selfie)|sua idade|seu endereço|sua escola/i,
  },
  { nome: 'encontro', regex: /(?:vamos|quer|bora)\s+(?:se\s+)?(?:encontrar|marcar)|te espero|me encontra/i },
  {
    nome: 'ataque à pessoa',
    regex: /\b(?:idiota|burro|burra|imbecil|otário|otaria|retardad|lixo|nojent|cala a boca|ninguém te perguntou)\b/i,
  },
  {
    /**
     * Recusa o VERBO, sem exigir o que vem depois. "segue a gente pra ver mais"
     * passava pela versão anterior, que pedia um complemento fixo.
     *
     * Aceito o custo de recusar um falso positivo ("quem curte história vai
     * gostar"): o princípio é falha fechada, e deixar passar uma instrução
     * contamina o dwell e as curtidas — o aluno passa a agir para atender ao
     * pedido, e a bolha medida deixa de ser dele (regra de ouro 3).
     */
    nome: 'instrução de comportamento',
    regex:
      /\b(?:curte|curta|curtam|segue|siga|sigam|salva|salve|salvem|compartilha|compartilhe|compartilhem|marca|marque)\b/i,
  },
  { nome: 'maiúsculas gritadas', regex: /\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{6,}\b/ },
];

export interface Reacao {
  handle: string;
  texto: string;
}

export interface Veredito {
  aprovadas: Reacao[];
  recusadas: { texto: string; motivo: string }[];
}

/**
 * Filtra as reações que podem aparecer.
 *
 * `handlesPermitidos` são as personas daquela atividade: uma reação assinada por
 * qualquer outro handle é descartada, porque o modelo inventar um perfil novo
 * quebra a consistência do feed que o professor revisou.
 */
export function filtrarReacoes(
  candidatas: unknown,
  handlesPermitidos: string[],
): Veredito {
  const aprovadas: Reacao[] = [];
  const recusadas: { texto: string; motivo: string }[] = [];

  if (!Array.isArray(candidatas)) return { aprovadas, recusadas };

  const permitidos = new Set(handlesPermitidos.map((handle) => handle.toLowerCase()));
  const jaVistos = new Set<string>();

  for (const bruta of candidatas) {
    const handle = String((bruta as Reacao)?.handle ?? '').trim();
    const texto = String((bruta as Reacao)?.texto ?? '')
      .replace(/\s+/g, ' ')
      .trim();

    const recusar = (motivo: string) => recusadas.push({ texto, motivo });

    if (texto.length < MIN_CARACTERES) {
      recusar('vazio');
      continue;
    }
    if (texto.length > MAX_CARACTERES) {
      recusar('longo demais');
      continue;
    }
    if (!permitidos.has(handle.toLowerCase())) {
      recusar(`handle fora do elenco: ${handle || '(vazio)'}`);
      continue;
    }

    const minusculo = texto.toLowerCase();
    const proibido = VOCABULARIO_PROIBIDO.find((termo) => minusculo.includes(termo));
    if (proibido) {
      recusar(`vocabulário proibido: ${proibido}`);
      continue;
    }

    const padrao = PADROES_PROIBIDOS.find(({ regex }) => regex.test(texto));
    if (padrao) {
      recusar(`padrão proibido: ${padrao.nome}`);
      continue;
    }

    /**
     * Menção a outro handle só vale se for do elenco. O modelo citando
     * "@qualquercoisa" criaria um perfil fantasma no feed.
     */
    const mencoes = texto.match(/@[\w.]+/g) ?? [];
    const mencaoInvalida = mencoes.find((mencao) => !permitidos.has(mencao.toLowerCase()));
    if (mencaoInvalida) {
      recusar(`menciona handle de fora: ${mencaoInvalida}`);
      continue;
    }

    // Duas personas dizendo a mesma coisa é sinal de modelo travado, e fica falso.
    const chave = minusculo;
    if (jaVistos.has(chave)) {
      recusar('repetida');
      continue;
    }
    jaVistos.add(chave);

    aprovadas.push({ handle, texto });
  }

  return { aprovadas, recusadas };
}
