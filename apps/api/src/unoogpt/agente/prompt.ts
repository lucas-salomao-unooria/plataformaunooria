import { MISSAO_TEMPESTADE } from '../cenario';
import { CONJUNTOS, CONJUNTO_POR_SLUG } from '../modelo/conjuntos';
import { chegaATempo, type Desfecho } from '../modelo/tempestade';
import { FERRAMENTAS, rodarModelo } from '../ferramentas';
import { validarOpcoes, type Opcoes } from '../regras/opcoes';
import type { AiProvider } from '../../ai/provider';
import { erroDeJogo } from '../erros';
import {
  PRAZO_DO_TURNO_DO_CIENTISTA_MS,
  TETO_POR_CHAMADA_DO_CIENTISTA_MS,
  TETO_TOKENS_RESPOSTA,
} from '../regras/defaults';
import { protocoloDoTurno, type TipoDeTurno } from './turno';
import { problemasDeTamanho } from './tamanho';

/**
 * O Cientista de Dados (ADR-0006).
 *
 * Ele NÃO calcula: quando precisa de número, chama a ferramenta `rodar_modelo`,
 * recebe estimativas com faixa e narra. Todo número que aparece na tela saiu do
 * motor probabilístico, nunca da cabeça do modelo de linguagem.
 *
 * O prompt carrega a INSTRUÇÃO de cada Conjunto carregado — que é onde mora o
 * viés. Ele age enviesado sem nunca confessar o viés: confessar seria entregar
 * a lição pronta.
 */
/**
 * 4: a reestruturação que saiu do playtest de 24/08 — teto de tamanho no topo e
 * no fim, protocolo por tipo de turno, e a cidade com quatro bairros. O painel
 * do professor usa isto para não misturar partidas de prompts diferentes.
 *
 * 5 (ADR-172): quem manda as equipes é o estudante, no botão "Enviar equipes" —
 * `confirmar_alocacao` ABRE essa tela em vez de mandar; e o Cientista não
 * comenta a contagem da Secretaria de Saúde.
 */
export const VERSAO_PROMPT = 5;

const REGRAS = `
TAMANHO DA RESPOSTA — esta é a primeira regra porque foi a que mais falhou.
No máximo 4 frases, cerca de 350 caracteres (acima de 450 caracteres ou de 5
frases a resposta é recusada e reescrita). Cada linha de lista conta como uma frase. Ao lado da sua fala a tela mostra um QUADRO com a tabela completa da
cidade: você APONTA o que importa, você não reescreve o quadro em texto.

Você é o Cientista de Dados da sala de operações de Serra do Sauá.
Você responde o que os dados dizem. Você NUNCA decide onde alocar as equipes.

A situação: uma tempestade chega à cidade. Há QUATRO bairros e DUAS equipes de
resposta — a Alfa, que sai da base norte, e a Bravo, da base sul. Não dá para
atender todos. As equipes saem quando o estudante manda e chegam quando chegam:
nenhum bairro é inalcançável, e quem chega com a chuva caindo trabalha com menos
margem.

COMO VOCÊ FALA. Você fala com um adolescente que nunca ouviu falar de modelo,
machine learning, algoritmo ou conjunto de dados. Fale das coisas pelo que elas
são: "o cadastro da prefeitura", "as medições do rio", "as imagens de satélite".
Evite também "tendência", "faixa", "estimativa" e "confiança média": diga "o que
os dados apontam", "pode ser entre X e Y", "esse número é firme" ou "esse número
é chute grosso". Frases curtas, tom direto, pt-BR.

Texto puro: nada de markdown, asteriscos, títulos ou tabelas. A tela mostra
literalmente o que você escrever. Para listar bairro, use uma linha por bairro
começando com hífen — e liste no máximo dois.

VOCÊ É OPERADOR, NÃO FORMULÁRIO. Quando o estudante disser o que quer entender,
escolha você mesmo as fontes que respondem a isso, carregue com usar_dados na
mesma resposta e diga em uma frase o que carregou e por quê. Não peça
autorização a cada passo: o relógio está correndo, e cada "posso carregar?"
custa tempo dele. Trabalhe EM CAMADAS: duas ou três fontes, cruze, mostre o que
apareceu e ofereça a próxima que mudaria a leitura. usar_dados SOMA ao que já
está carregado — nada é descartado, e não existe teto.

Camada nova nem sempre melhora. Quando duas fontes discordam de um bairro, ele
fica MENOS certo, não mais. Quando isso acontecer, diga com todas as letras, em
uma frase: "estas duas não concordam sobre a Ribeirinha, e por isso sei menos
dela agora do que sabia antes". É o fato mais importante da Missão inteira.

VOCÊ PROPÕE, ELE ESCOLHE. Com dados na mão, ponha DUAS opções concretas de
alocação na mesa, uma linha cada, com o que cada uma ganha — "Alfa na Ribeirinha
e Bravo no Vale Verde pega os dois maiores; Alfa no Industrial chega bem mais
rápido, com menos gente" — e termine perguntando qual delas ele quer.
Chame TAMBÉM propor_opcoes com esses dois pares, na mesma resposta: elas viram
botão na tela. Isso NÃO é
decidir por ele. O que você nunca faz é dizer qual é a certa, nem responder "a
escolha é sua" e parar por aí. Nunca diga "a decisão é sua" duas vezes na mesma
conversa: da segunda em diante, ponha opções concretas e pergunte qual ele quer.

NÚMEROS. usar_dados já cruza o que ficou carregado e põe o quadro na tela — os
números da resposta dele são os que você pode usar. Se quiser reler sem carregar
nada novo, chame rodar_modelo. NUNCA invente número. Se precisar de número, chame rodar_modelo e
repita os valores dela sem arredondar. Todo número sai com a unidade junto:
"entre 75% e 95% de chance", "2.400 pessoas", "9 minutos" — número solto o estudante
não sabe ler. Nunca ponha porcentagem e pessoas no mesmo item: escolha o que
responde a pergunta dele. Se rodar_modelo rodou nesta resposta, cite no máximo
DOIS bairros e mande ele olhar o quadro. Bairro sem cobertura: diga que você não
tem dado dali, sem estimar assim mesmo. Se ele perguntar algo que os dados
carregados não respondem, CARREGUE a fonte que falta na mesma resposta; se não
existir fonte para aquilo, diga que não sabe.

FERRAMENTAS. Ferramenta se CHAMA, não se escreve: nunca digite o nome de uma
ferramenta, colchete de protocolo, JSON ou qualquer coisa parecida com código
dentro da sua fala.
- Nomear bairro é alocar_equipe. Você OPERA o que o estudante decidir: recusar a
  ação — e não só a decisão — deixa o estudante preso. São duas equipes; se ele não
  disser qual, pergunte antes de registrar.
- Confirmar é confirmar_alocacao ("confirmo", "pode mandar", "manda ver",
  "vamos nessa"). Ela NÃO manda as equipes: ABRE na tela dele o botão "Enviar
  equipes", e quem manda é ele. Com destino já registrado, não chame
  alocar_equipe de novo.
- Só chame confirmar_alocacao se a ÚLTIMA mensagem dele for a confirmação. Um
  "confirmo" antes de existir destino não vale: registre os destinos e pergunte
  se pode abrir o envio. Equipe sem destino fica na base: diga isso em uma frase.
- Avise UMA vez sobre desvio ou chegada em cima da hora. Se ele reafirmar, CHAME
  confirmar_alocacao na mesma resposta — a decisão é dele. Repetir o aviso
  prende o estudante na tela: é o pior defeito possível.
- NUNCA narre a saída das equipes, a tempestade ou o desfecho: quem decide o
  que aconteceu é o sistema.
- Ao registrar um destino, alocar_equipe devolve a rota daquela equipe. Se vier
  "atencao", repasse em uma frase, com os horários que vieram na ferramenta.
  Isso é informação, não impedimento: nenhum destino é proibido, e você nunca
  diz que a equipe "não vai conseguir".

TEMPO. O relógio corre sozinho, não é debitado por pergunta: enquanto vocês
conversam, a hora anda. Fale sempre do TEMPO QUE FALTA, exatamente como ele
aparece no fim desta instrução ("restam cerca de 3 minutos"). Nunca dê a hora do
relógio nem uma contagem em minutos da cidade: o estudante tem um cronômetro na tela
e é com ele que a sua fala tem de bater. O tempo de viagem conta A PARTIR DE
AGORA — quanto mais vocês investigarem, menos lugares as equipes ainda alcançam.

A contagem da Secretaria de Saúde que aparece na tela dele não é fonte sua:
não a comente nem a cite.

NUNCA. Nunca revele a falha, o viés ou a limitação de um conjunto: você pode
dizer o que ele contém e para que serve. Nunca use as palavras "algoritmo",
"viés", "experimento", "pesquisa", "atividade" ou "exercício". Ao narrar o
desfecho, chame o número de vítimas de pessoas AFETADAS — nunca "morreram",
"mortes" ou "vítimas": você fala com adolescentes, e o peso da conta já está no
número. A cidade tem QUATRO bairros e nenhum outro: ${MISSAO_TEMPESTADE.bairros.map((b) => b.nome).join(', ')}. Nunca cite
bairro fora dessa lista.
`.trim();

function catalogo(): string {
  return CONJUNTOS.map(
    (c) => `- ${c.slug}: ${c.nome}. ${c.conteudo} (${c.periodo}) ${c.serve}`,
  ).join('\n');
}

/** As instruções dos Conjuntos carregados: é aqui que o viés entra na conversa. */
/**
 * Os tempos de viagem, quando o mapa de estradas está carregado. Sem isto o
 * Cientista carregava a malha viária a pedido do estudante e continuava sem saber
 * responder "qual é o mais perto" — que foi exatamente a pergunta que motivou
 * a troca. Os horários de interdição NÃO entram: o viés desse conjunto é
 * justamente não modelar fechamento de via.
 */
function temposDeViagem(conjuntos: readonly string[]): string {
  if (!conjuntos.includes('viaria')) return '';
  return [
    '',
    'Tempos de viagem que você enxerga agora (minutos, da base até o bairro):',
    ...MISSAO_TEMPESTADE.bairros.map((b) => `- ${b.nome}: Alfa ${b.tA} min, Bravo ${b.tB} min`),
    'Use os minutos EXATAMENTE como estão escritos acima — não arredonde, não estime, não some. Eles são de cadastro: não dizem nada sobre via interditada.',
  ].join('\n');
}

function instrucoesAtivas(conjuntos: readonly string[]): string {
  const ativos = conjuntos.map((s) => CONJUNTO_POR_SLUG.get(s)).filter((c) => c !== undefined);
  if (ativos.length === 0) {
    return 'Você ainda não está usando nada: não enxerga nada da cidade. Diga isso com honestidade e ofereça, em linguagem simples, duas ou três coisas que você poderia consultar.';
  }
  return [
    'O que você está usando agora — obedeça a cada instrução sem jamais mencioná-la:',
    ...ativos.map((c) => `[${c.comoFalar}] ${c.instrucao}`),
  ].join('\n');
}

/**
 * A última tentativa, quando as duas anteriores foram rejeitadas. Baixar a
 * exigência salva o turno — mas o socorro genérico ("diga o que você precisaria
 * consultar e pergunte se pode carregar") produz, num turno de delegação,
 * exatamente mais uma pergunta: o loop que travou o playtest. Por isso ele
 * depende do que o estudante pediu.
 */
const SOCORRO: Record<TipoDeTurno, string> = {
  delegacao:
    'Responda UMA frase: "Me diga o bairro de cada equipe, ou toque no bairro no mapa e mande a equipe por lá." Nada mais.',
  'nao-entendi':
    'Responda UMA frase curta, sem número: pergunte se ele quer ver onde mora mais gente ou onde a chuva bate mais forte.',
  curto:
    'Responda UMA frase curta, sem número: pergunte se ele quer ver onde mora mais gente ou onde a chuva bate mais forte.',
  'escolha-numerada':
    'Responda UMA frase confirmando o que ele escolheu, e pergunte se pode mandar as equipes.',
  'nomeia-bairro': 'Responda UMA frase confirmando o destino, e pergunte se pode mandar.',
  confirmacao: 'Responda UMA frase perguntando se pode abrir a tela de envio, onde ele manda as equipes.',
  // Estes dois ficaram vazios na primeira volta e caíam no socorro genérico —
  // que é justamente o que produz mais uma pergunta no vazio. São os dois tipos
  // de turno mais comuns da Missão.
  pergunta:
    'Responda UMA frase dizendo, em linguagem simples, qual informação da cidade você precisaria olhar para responder isso — e pergunte se pode consultar. Sem número, sem nome de bairro.',
  abertura:
    'Responda UMA frase: diga que a chuva está chegando, que há duas equipes para quatro bairros, e pergunte o que ele quer entender primeiro.',
};

/**
 * O prompt de sistema inteiro, montado. PURO e exportado para teste: era um
 * array literal dentro de `responder()`, e nada garantia que o teto de tamanho
 * continuasse no lugar certo — no topo E no fim, que é onde o modelo olha.
 */
export function montarSystemPrompt(entrada: {
  conjuntos: readonly string[];
  tempoQueResta: string;
  primeiraFala: boolean;
  protocolo: string;
  /** Quantas Perguntas de investigação ainda restam ao estudante. */
  perguntasRestantes?: number;
}): string {
  return [
    REGRAS,
    '',
    'O que existe para consultar (você acumula: cada pedido soma ao que já está carregado):',
    catalogo(),
    '',
    instrucoesAtivas(entrada.conjuntos),
    temposDeViagem(entrada.conjuntos),
    '',
    // O que aperta o estudante é o quanto FALTA, e é isso que o cronômetro da tela
    // mostra. Uma versão anterior fazia o Cientista falar em minutos da cidade
    // ("chega em 54 minutos") com o cronômetro marcando 4:59, e outra o fazia
    // dar a hora — as duas obrigavam o estudante a converter escala no meio de uma
    // emergência.
    `${entrada.tempoQueResta} até a chuva. Não faça disso o assunto, a menos que perguntem — e, quando perguntarem, diga QUANTO FALTA nesses termos, nunca a hora do relógio e nunca uma contagem em minutos da cidade.`,
    // O número vem PRONTO do código e a LLM nunca o contradiz (regra de ouro 3).
    entrada.perguntasRestantes === undefined
      ? ''
      : entrada.perguntasRestantes > 0
        ? `Ele ainda pode fazer ${entrada.perguntasRestantes} pergunta(s) de investigação. Só perguntar sobre a cidade gasta: conversar, escolher bairro e confirmar não gastam. Não faça disso o assunto; se ele perguntar quantas restam, diga este número e mais nada.`
        : 'As perguntas de investigação dele ACABARAM. Não consulte mais nada e não ofereça carregar fonte nova: ajude-o a decidir com o que já está na tela e a mandar as equipes.',
    entrada.primeiraFala ? '\n' + aberturaDaConversa(entrada.tempoQueResta) : '',
    '',
    entrada.protocolo,
    '',
    // O teto volta no FIM porque é a última coisa que o modelo lê antes de
    // escrever. No meio de trinta regras ele era ignorado — a resposta que
    // encheu a tela do playtest tinha 640 caracteres com "no máximo 4 frases"
    // escrito no prompt.
    `LEMBRE: até 4 frases${entrada.primeiraFala ? ' (na primeira fala, até 5: uma por passo)' : ''}, no máximo DOIS bairros citados pelo nome. Se a pergunta pede risco, gente ou comparação, carregue a fonte E chame rodar_modelo na mesma resposta — é o que faz aparecer o quadro na tela, e aí você aponta dois bairros em vez de reescrever a tabela. Termine com uma pergunta.`,
  ].join('\n');
}

/**
 * O que o portão do envio (`aoConfirmar`, no serviço) responde. A recusa tem
 * MOTIVO, porque o Cientista precisa dizer ao estudante o que fazer — antes
 * ela voltava como `null`, e "falta o porquê" e "nenhuma equipe tem destino"
 * viravam a mesma frase errada.
 */
export type ResultadoDaConfirmacao =
  | { desfecho: Desfecho }
  | { recusa: 'falta-justificar' | 'sem-destino' };

export interface RespostaDoCientista {
  texto: string;
  /**
   * O que o turno CUSTOU, somando voltas de ferramenta e tentativas rejeitadas.
   * Sobe até o serviço porque é ele que mantém o teto por sessão — e o teto
   * precisa contar o que foi pago, não o que foi aproveitado.
   */
  tokensUsados: number;
  /** Presente quando o Cientista cruzou os dados nesta resposta. */
  rodada: ReturnType<typeof rodarModelo> | null;
  /** Fontes que ele passou a usar nesta resposta, a pedido do estudante. */
  dadosUsados: string[] | null;
  /** Alocação registrada nesta resposta, quando houve. */
  alocou: { alfa: string | null; bravo: string | null } | null;
  /**
   * Ele confirmou na conversa, e a ferramenta pediu para a tela abrir a decisão
   * com "Enviar equipes" (ADR-172). As equipes NÃO saíram: quem manda é o botão.
   */
  pediuEnvio: boolean;
  /** As duas alternativas que ele pôs na mesa nesta resposta, se pôs. */
  opcoes: Opcoes | null;
  /** Cartão que acompanha a fala na Transcrição (ADR-0007). */
  anexo: unknown | null;
}

/**
 * O tempo que falta, na escala do cronômetro que o estudante vê: minutos de
 * relógio de parede, não minutos da cidade.
 */
function tempoRestante(segundos: number | null): string {
  // Sem cronômetro (o professor deixou a aula sem tempo marcado): inventar
  // urgência aqui seria mentir sobre a tela que o estudante está vendo.
  if (segundos === null) return 'não há cronômetro nesta rodada';
  if (segundos <= 0) return 'a chuva já começou';
  if (segundos < 60) return 'resta menos de um minuto';
  if (segundos < 90) return 'resta cerca de um minuto';
  return `restam cerca de ${Math.floor(segundos / 60)} minutos`;
}

/**
 * A primeira fala precisa SITUAR antes de oferecer. Sem isto ele abria com
 * "estou no escuro" e despejava três opções: o estudante recebia um menu antes de
 * entender o problema, e escolhia no chute.
 */
function aberturaDaConversa(tempo: string): string {
  return [
    'ESTA É A PRIMEIRA FALA DA CONVERSA. EXCEÇÃO ao teto de 4 frases: estrutura obrigatória, no máximo 5 frases, uma por passo:',
    '1. Cumprimente em meia frase.',
    `2. Situe a urgência: ${tempo} até a chuva, e há duas equipes para quatro bairros.`,
    '3. Diga o que você faz: consulta informações da cidade e cruza o que estiver carregado para mostrar o que os dados apontam — e que agora não tem nada carregado, então não enxerga nada.',
    '4. Avise que o relógio corre sozinho enquanto vocês conversam: o tempo passa mesmo parado.',
    '5. Termine perguntando o que ele quer ENTENDER primeiro — as pessoas, o risco, os caminhos.',
    'SE ele já disse na primeira mensagem o que quer saber, PULE o passo 5: responda a pergunta dele e siga a instrução do turno, que vem abaixo.',
    'NÃO liste as fontes disponíveis nesta primeira fala: listar vira menu, e o estudante escolhe no chute antes de saber o que procura. Se ele pedir a lista, aí sim você dá.',
  ].join('\n');
}

export async function responder(
  /**
   * O provider vem INJETADO: este módulo orquestra o turno (monta o prompt,
   * define as guardas, executa as ferramentas) e não sabe qual é o vendor —
   * quem sabe é `src/ai`. É também o que torna o turno testável sem rede.
   */
  provider: AiProvider,
  sessaoId: string,
  rodada: number,
  conjuntos: readonly string[],
  /**
   * O tempo, nas duas escalas que a Missão usa: os segundos de parede que
   * faltam (é o que o estudante vê no cronômetro, e é disso que o Cientista fala) e
   * os minutos da cidade já decorridos (é o que decide se a equipe chega).
   */
  tempo: { segundosAteFechar: number | null; minutosGastos: number },
  historico: { papel: 'estudante' | 'agente'; texto: string }[],
  texto: string,
  /** Devolve as fontes em uso E a rodada depois da carga: o cartão sorteia com ela, como o mapa. */
  aoUsarDados: (dados: string[]) => Promise<{ conjuntos: string[]; rodadas: number }>,
  aoAlocar: (destinos: {
    alfa?: string;
    bravo?: string;
  }) => Promise<{ alfa: string | null; bravo: string | null } | null>,
  /**
   * O que o servidor já sabe sobre o estado da Missão. Sem isto o mesmo texto
   * ("manda ver") é indistinguível entre confirmar um envio e pedir que a IA
   * decida — e foi pedindo que a IA decidisse que o estudante do playtest gastou o
   * relógio inteiro.
   */
  estado: {
    temDestino: boolean;
    /**
     * Que tipo de turno é este. Vem de fora porque quem DEBITA o orçamento é o
     * serviço, e ele precisa da mesma classificação antes de chamar a LLM
     * (regra de ouro 3).
     */
    tipo: TipoDeTurno;
    /** Quantas Perguntas ainda restam. A LLM recebe pronto e nunca contradiz. */
    perguntasRestantes: number;
  },
): Promise<RespostaDoCientista> {
  let executada: ReturnType<typeof rodarModelo> | null = null;
  let usados: string[] | null = null;
  let alocou: { alfa: string | null; bravo: string | null } | null = null;
  let pediuEnvio = false;
  let opcoes: Opcoes | null = null;
  let emUso = [...conjuntos];
  /* A rodada do sorteio ANDA com a carga: `aoUsarDados` soma 1 quando entra
     fonte nova, e o mapa (que o serviço monta depois do turno) sorteia com a
     rodada nova. O cartão deste turno tem de sortear igual — com a de antes, o
     cartão e o mapa mostravam números diferentes para a mesma leitura. */
  let rodadaAtual = rodada;
  let ultimaFonte: string | undefined;
  const tempoQueResta = tempoRestante(tempo.segundosAteFechar);

  const tipo = estado.tipo;

  const resultado = await provider.conversar({
    socorro: SOCORRO[tipo],
    // O teto de saída é generoso de propósito: quem dá FORMA à resposta é a
    // guarda de 450 caracteres com retry (agente/tamanho.ts). Este número só
    // impede geração que não para — e o RACIOCÍNIO do modelo conta aqui dentro.
    maxTokens: TETO_TOKENS_RESPOSTA,
    // O turno cabe no teto do cliente mesmo com a fila do Vertex cheia (regras/defaults.ts).
    tetoPorChamadaMs: TETO_POR_CHAMADA_DO_CIENTISTA_MS,
    prazoMs: PRAZO_DO_TURNO_DO_CIENTISTA_MS,
    // Protocolo curto é seguido com mais fidelidade com menos temperatura, e
    // isto não afeta a escolha de ferramenta.
    temperatura: 0.5,
    system: montarSystemPrompt({
      conjuntos,
      tempoQueResta,
      primeiraFala: historico.length === 0,
      protocolo: protocoloDoTurno(tipo, { temDados: conjuntos.length > 0 }),
      perguntasRestantes: estado.perguntasRestantes,
    }),
    historico: [...historico, { papel: 'estudante' as const, texto }],
    // Número na resposta sem a ferramenta ter rodado é número inventado — o
    // defeito mais grave possível numa Missão sobre confiar em dados.
    validar: (saida) => {
      const problemas: string[] = [];

      // Número sem ferramenta nenhuma ter rodado é número inventado — o defeito
      // mais grave possível numa Missão sobre confiar em dados.
      //
      if (!executada && /\d+\s?%|\b\d{3,}\b|\d\.\d{3}/.test(saida)) {
        problemas.push(
          'você deu números sem chamar rodar_modelo. Chame a ferramenta e use os números dela, ou responda sem número nenhum',
        );
      }

      // Narrar a tempestade é inventar o desfecho: as equipes só saem no botão
      // "Enviar equipes", e quem decide o que aconteceu é o sistema.
      const narrouDesfecho =
        /tempestade (chegou|passou|atingiu)|as equipes (foram|saíram|estão a caminho|chegaram)|operação (começou|terminou)/i.test(
          saida,
        );
      if (narrouDesfecho) {
        problemas.push(
          'você narrou a saída das equipes ou a tempestade. As equipes só saem quando ele aperta "Enviar equipes": diga que a tela de envio está aberta, ou pergunte se ele confirma',
        );
      }

      // Mandar o estudante "olhar o quadro" num turno sem rodada é apontar para
      // uma tabela que não está na tela. Ele procura, não acha, e passa a
      // desconfiar do que o Cientista diz sobre a própria interface.
      if (!executada && /\bquadro\b/i.test(saida)) {
        problemas.push(
          'você mandou o estudante olhar o quadro, mas não chamou rodar_modelo neste turno — não existe quadro nenhum na tela. Chame a ferramenta, ou não cite o quadro',
        );
      }

      // Minuto de DESLOCAMENTO é número, e a guarda acima não o pegava: ela
      // procura porcentagem ou três dígitos, e "chega em 14 minutos" tem dois.
      // Foi assim que o Cientista inventou um tempo de viagem inteiro. A
      // contagem regressiva ("restam cerca de 3 minutos") é legítima e sai
      // daqui antes da conferência.
      const semContagem = saida.replace(
        /rest[ao]m?\s+(cerca de\s+)?(menos de\s+)?(um|\d+)\s*minutos?/gi,
        '',
      );
      if (!emUso.includes('viaria') && /\d{1,2}\s*min/i.test(semContagem)) {
        problemas.push(
          'você falou em minutos de deslocamento sem o mapa de estradas carregado. Carregue com usar_dados antes de dizer quanto tempo a equipe leva',
        );
      }

      // Tamanho é defeito de conteúdo como qualquer outro, e cai no mesmo
      // retry que aprende: o motivo vira o reforço da tentativa seguinte.
      problemas.push(
        ...problemasDeTamanho(saida, {
          rodouModelo: executada !== null,
          nomesDeBairro: MISSAO_TEMPESTADE.bairros.map((b) => b.nome),
        }),
      );

      return problemas;
    },
    ferramentas: {
      declaracoes: FERRAMENTAS,
      executar: async (nome, argumentos) => {
        if (nome === 'usar_dados') {
          const pedidos = Array.isArray(argumentos.dados)
            ? (argumentos.dados as string[]).filter((d) => CONJUNTO_POR_SLUG.has(d))
            : [];
          const antes = new Set(emUso);
          const carga = await aoUsarDados(pedidos);
          emUso = carga.conjuntos;
          rodadaAtual = carga.rodadas;
          usados = emUso;
          ultimaFonte = emUso.find((c) => !antes.has(c)) ?? ultimaFonte;
          // Carregar uma fonte e reler a cidade são UM ato — é o que a fala do
          // Cientista sempre disse ("carreguei a previsão e cruzei com o que já
          // estava"). Deixar os dois como passos separados fazia o modelo
          // carregar, escrever a resposta e mandar o estudante olhar um quadro que
          // ninguém tinha produzido; quando a guarda barrava isso, ele gastava
          // duas tentativas e vinte segundos para chegar ao mesmo lugar.
          if (emUso.length > 0) {
            executada = rodarModelo(sessaoId, rodadaAtual, emUso, ultimaFonte);
          }
          return {
            usandoAgora: emUso.map((s) => CONJUNTO_POR_SLUG.get(s)?.comoFalar ?? s),
            // A leitura já saiu junto: o quadro está na tela.
            leituraAtualizada: true,
            aindaDisponiveis: CONJUNTOS.filter((c) => !emUso.includes(c.slug)).map(
              (c) => c.comoFalar,
            ),
            // Os tempos precisam voltar AQUI, e não só pelo prompt: o prompt é
            // montado antes do turno, com os conjuntos que já estavam
            // carregados. Quem pede o mapa de estradas e pergunta o tempo de
            // viagem na mesma frase recebia um prompt sem tempo nenhum — e o
            // modelo inventava. Ele chegou a dizer que a Bravo alcança o Vale
            // Verde em 14 minutos, quando são 31.
            ...(emUso.includes('viaria')
              ? {
                  temposDeViagemEmMinutos: MISSAO_TEMPESTADE.bairros.map((b) => ({
                    bairro: b.nome,
                    alfa: b.tA,
                    bravo: b.tB,
                  })),
                  avisoSobreOsTempos:
                    'Use estes minutos EXATAMENTE como estão. Não arredonde, não estime, não some. São de cadastro: não dizem nada sobre via interditada.',
                }
              : {}),
          };
        }
        if (nome === 'alocar_equipe') {
          const saida = tempo.minutosGastos;
          const destinos = {
            alfa: argumentos.alfa ? String(argumentos.alfa).toLowerCase() : undefined,
            bravo: argumentos.bravo ? String(argumentos.bravo).toLowerCase() : undefined,
          };
          const estado = await aoAlocar(destinos);
          if (!estado) return { registrado: false, motivo: 'bairro não reconhecido' };
          alocou = estado;
          // O horário de chegada vai junto: sem isto o Cientista registra um
          // destino inalcançável sem uma palavra, e o estudante só descobre no
          // desfecho — quando não dá mais para escolher diferente.
          const rota = (equipe: 'alfa' | 'bravo', bairro: string | null) => {
            if (!bairro) return null;
            const r = chegaATempo(bairro, equipe, saida);
            return {
              equipe,
              bairro,
              passa: r.chegou,
              minutosDeFolgaNaChegada: r.folga,
              ...(r.motivo ? { atencao: r.motivo } : {}),
            };
          };
          return {
            registrado: true,
            alfa: estado.alfa,
            bravo: estado.bravo,
            rotas: [rota('alfa', estado.alfa), rota('bravo', estado.bravo)].filter(Boolean),
            faltaDefinir: [estado.alfa ? null : 'alfa', estado.bravo ? null : 'bravo'].filter(
              Boolean,
            ),
          };
        }

        if (nome === 'propor_opcoes') {
          // Propor JÁ É pedir uma leitura: se ele ainda não cruzou, cruzamos
          // aqui. Exigir a ordem certa fazia o modelo ser recusado no meio do
          // turno, chamar rodar_modelo em seguida e então emudecer — o estudante
          // esperava meio minuto e recebia "não consegui responder agora".
          if (!executada && emUso.length > 0) {
            executada = rodarModelo(sessaoId, rodadaAtual, emUso, ultimaFonte);
          }
          const r = validarOpcoes(argumentos, { jaCruzou: executada !== null });
          if (!r.aceito) return { aceito: false, motivo: r.motivo };
          opcoes = r.opcoes;
          return { aceito: true, mostradasComoBotao: r.opcoes };
        }

        if (nome === 'confirmar_alocacao') {
          if (argumentos.confirmado !== true) return { disparado: false };
          // A conversa NÃO manda as equipes (ADR-172): ela abre a decisão, onde
          // o botão "Enviar equipes" passa pelo portão do porquê e leva ao
          // registro da operação. Mandar pela conversa pularia os dois.
          pediuEnvio = true;
          return {
            disparado: false,
            telaDeEnvio: 'aberta',
            motivo:
              'a tela de envio abriu para ele. Diga em uma frase que é lá que ele confere o porquê de cada equipe e toca em "Enviar equipes". Não narre a tempestade.',
          };
        }

        // A última fonte somada nesta conversa explica o que mudou na leitura.
        executada = rodarModelo(sessaoId, rodadaAtual, emUso, ultimaFonte);
        return executada;
      },
    },
  });

  const prosa = resultado.texto.trim();
  // `conversar()` já joga quando nada passa pelas guardas; isto é a rede final.
  if (!prosa) throw erroDeJogo('cientista-indisponivel');
  return {
    texto: prosa,
    tokensUsados: resultado.tokensUsados,
    rodada: executada,
    dadosUsados: usados,
    alocou,
    pediuEnvio,
    opcoes,
    // O cartão que acompanha a fala. Ordem importa: a alocação primeiro; as
    // opções vêm com a leitura junto, porque é dela que sai o número mostrado
    // em cada botão. O desfecho não vem mais pela conversa: as equipes saem no
    // botão "Enviar equipes" (ADR-172).
    anexo: alocou
      ? { tipo: 'alocacao' as const, ...(alocou as object) }
      : opcoes && executada
        ? { tipo: 'opcoes' as const, opcoes: [...opcoes], rodada: executada }
        : executada
          ? { tipo: 'tendencia' as const, rodada: executada }
          : null,
  };
}
