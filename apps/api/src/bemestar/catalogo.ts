import { z } from "zod";

/**
 * DASS-21 — Depression Anxiety Stress Scales, forma curta (Lovibond &
 * Lovibond, 1995; domínio público — a Psychology Foundation of Australia
 * dispensa permissão para uso e reprodução). Versão brasileira validada por
 * Vignola & Tucci (2014, J Affect Disord 155:104-9).
 *
 * OS 21 ITENS SÃO O INSTRUMENTO. Ficam aqui, VERBATIM, e a IA NUNCA os
 * reescreve: reformular um item quebra a validação psicométrica e as faixas
 * de corte deixam de valer. O que a IA gera é o entorno (abertura e pergunta
 * aberta do dia) — `prompt-bem-estar.ts` + guardrails em `regras.ts`.
 *
 * Referência temporal do instrumento: "durante a última semana".
 */

export type Subescala = "depressao" | "ansiedade" | "estresse";

export interface ItemDass {
  numero: number;
  subescala: Subescala;
  texto: string;
}

export const ITENS: readonly ItemDass[] = [
  { numero: 1, subescala: "estresse", texto: "Achei difícil me acalmar" },
  { numero: 2, subescala: "ansiedade", texto: "Senti minha boca seca" },
  { numero: 3, subescala: "depressao", texto: "Não consegui vivenciar nenhum sentimento positivo" },
  {
    numero: 4,
    subescala: "ansiedade",
    texto:
      "Tive dificuldade em respirar em alguns momentos (ex.: respiração ofegante, falta de ar, sem ter feito nenhum esforço físico)",
  },
  { numero: 5, subescala: "depressao", texto: "Achei difícil ter iniciativa para fazer as coisas" },
  { numero: 6, subescala: "estresse", texto: "Tive a tendência de reagir de forma exagerada às situações" },
  { numero: 7, subescala: "ansiedade", texto: "Senti tremores (ex.: nas mãos)" },
  { numero: 8, subescala: "estresse", texto: "Senti que estava sempre nervoso(a)" },
  {
    numero: 9,
    subescala: "ansiedade",
    texto: "Preocupei-me com situações em que eu pudesse entrar em pânico e parecesse ridículo(a)",
  },
  { numero: 10, subescala: "depressao", texto: "Senti que não tinha nada a desejar" },
  { numero: 11, subescala: "estresse", texto: "Senti-me agitado(a)" },
  { numero: 12, subescala: "estresse", texto: "Achei difícil relaxar" },
  { numero: 13, subescala: "depressao", texto: "Senti-me depressivo(a) e sem ânimo" },
  {
    numero: 14,
    subescala: "estresse",
    texto: "Fui intolerante com as coisas que me impediam de continuar o que eu estava fazendo",
  },
  { numero: 15, subescala: "ansiedade", texto: "Senti que ia entrar em pânico" },
  { numero: 16, subescala: "depressao", texto: "Não consegui me entusiasmar com nada" },
  { numero: 17, subescala: "depressao", texto: "Senti que não tinha valor como pessoa" },
  { numero: 18, subescala: "estresse", texto: "Senti que estava um pouco emotivo(a)/sensível demais" },
  {
    numero: 19,
    subescala: "ansiedade",
    texto: "Sabia que meu coração estava alterado mesmo não tendo feito nenhum esforço físico",
  },
  { numero: 20, subescala: "ansiedade", texto: "Senti medo sem motivo" },
  { numero: 21, subescala: "depressao", texto: "Senti que a vida não tinha sentido" },
];

export const SUBESCALAS: readonly Subescala[] = ["depressao", "ansiedade", "estresse"];

export const ROTULO_SUBESCALA: Record<Subescala, string> = {
  depressao: "Depressão",
  ansiedade: "Ansiedade",
  estresse: "Estresse",
};

/** Escala Likert de 4 pontos do instrumento — âncoras da versão brasileira. */
export const ESCALA: ReadonlyArray<{ valor: 0 | 1 | 2 | 3; rotulo: string; curto: string }> = [
  { valor: 0, rotulo: "Não se aplicou de maneira alguma", curto: "Nunca" },
  { valor: 1, rotulo: "Aplicou-se em algum grau, ou por pouco tempo", curto: "Às vezes" },
  { valor: 2, rotulo: "Aplicou-se em um grau considerável, ou por uma boa parte do tempo", curto: "Boa parte" },
  { valor: 3, rotulo: "Aplicou-se muito, ou na maioria do tempo", curto: "Quase sempre" },
];

export const INSTRUCAO =
  "Pensando na última semana, o quanto cada frase se aplicou a você? Não existe resposta certa — é só um retrato de como você se sentiu.";

/**
 * Faixas de corte do DASS-21 (pontuação já ×2, comparável ao DASS-42), da
 * publicação original. Limites INFERIORES de cada faixa, em ordem.
 */
export const FAIXAS = ["normal", "leve", "moderado", "severo", "extremamente-severo"] as const;
export type Faixa = (typeof FAIXAS)[number];

export const CORTES: Record<Subescala, readonly [number, number, number, number]> = {
  // normal < 10 | leve 10–13 | moderado 14–20 | severo 21–27 | ext. severo 28+
  depressao: [10, 14, 21, 28],
  // normal < 8 | leve 8–9 | moderado 10–14 | severo 15–19 | ext. severo 20+
  ansiedade: [8, 10, 15, 20],
  // normal < 15 | leve 15–18 | moderado 19–25 | severo 26–33 | ext. severo 34+
  estresse: [15, 19, 26, 34],
};

export const ROTULO_FAIXA: Record<Faixa, string> = {
  normal: "Dentro do esperado",
  leve: "Leve",
  moderado: "Moderado",
  severo: "Elevado",
  "extremamente-severo": "Muito elevado",
};

/** Itens cuja resposta ≥ 2 acende o sinal de apoio (ideação/desvalor). */
export const ITENS_SENTINELA: readonly number[] = [17, 21];
export const VALOR_SENTINELA = 2;

// --------------------------------------------------------------- desenho

/** Itens por check-in: um de cada subescala. 7 check-ins fecham os 21. */
export const ITENS_POR_CHECKIN = 3;
export const CHECKINS_POR_CICLO = 7;
/**
 * O instrumento pergunta sobre "a última semana". Um ciclo que se arrasta por
 * mais de 3 semanas mistura semanas demais — expira e recomeça do zero.
 */
export const DIAS_VALIDADE_CICLO = 21;
/**
 * Fuso do "dia" do check-in.
 *
 * Reexportado de `comum/fuso.ts`, e não declarado aqui: era daqui que ele saía,
 * e ninguém fora do bem-estar o encontrava — o hub passou meses formatando data
 * sem fuso nenhum a três pastas de distância (ADR-98). Virou FUNÇÃO na ADR-99,
 * quando o valor passou a vir da env `FUSO_DA_PLATAFORMA`: constante seria lida
 * uma vez na importação do módulo, e o fuso é do deploy.
 */
export { fusoDaPlataforma } from "../comum/fuso";

export const MAX_TEXTO_LIVRE = 600;

// ---------------------------------------------------------------- textos

/**
 * Textos FIXOS que entram quando a IA não pode falar: provider fora,
 * guardrail barrou, quota esgotada — ou sinal de apoio (aí a IA nem é chamada).
 * Rotacionam pelo número do check-in para não repetir todo dia.
 */
export const ABERTURAS_FIXAS: readonly string[] = [
  "Um minuto para você antes de voltar para a sala.",
  "Três frases rápidas e um espaço para o que você quiser contar.",
  "Sem certo ou errado: é só um retrato da sua semana.",
  "Reservar 40 segundos para si também faz parte do trabalho.",
  "Como foi a semana por aí? Comece por estas três frases.",
  "Mais um passo do seu ciclo — obrigado por continuar.",
  "Último check-in do ciclo. Depois dele, o retrato completo.",
];

export const PERGUNTAS_FIXAS: readonly string[] = [
  "Se quiser, conte em uma linha: como você está hoje?",
  "O que mais pesou — ou mais aliviou — na sua semana?",
  "Teve algum momento bom em sala esta semana? Qual?",
  "O que você gostaria de deixar registrado sobre hoje?",
  "Tem algo ocupando a sua cabeça agora?",
  "Como está a sua energia nesta altura da semana?",
  "Olhando para a semana, o que você faria diferente — ou igual?",
];

export const ACOLHIMENTOS_FIXOS: readonly string[] = [
  "Obrigado por parar um minuto para isso. Registrado — a gente se vê no próximo check-in.",
  "Anotado. Reservar esse tempo para você conta, mesmo em semana corrida.",
  "Registrado. Não há resposta certa aqui; há a sua semana, do seu jeito.",
];

/**
 * Mensagem de SEGURANÇA, fixa, mostrada quando um item sentinela pontua alto
 * ou o texto livre traz sinal de risco. Não substitui atendimento: aponta
 * caminhos concretos e gratuitos. CVV 188 — 24h, ligação gratuita.
 */
export const MENSAGEM_DE_APOIO = {
  titulo: "Obrigado por confiar isso aqui.",
  texto:
    "Algumas das suas respostas sugerem que a semana está pesando muito. Você não precisa carregar isso sozinho(a): conversar com alguém de confiança ou com um profissional ajuda de verdade.",
  recursos: [
    { nome: "CVV — Centro de Valorização da Vida", detalhe: "Ligue 188 (gratuito, 24 horas) ou acesse cvv.org.br para chat" },
    { nome: "SAMU", detalhe: "192, em situação de emergência" },
    { nome: "CAPS / UBS da sua cidade", detalhe: "Atendimento em saúde mental pelo SUS, sem custo" },
  ],
} as const;

/** Texto de leitura do resultado por faixa — cuidadoso, sem diagnóstico. */
export const LEITURA_DA_FAIXA: Record<Faixa, string> = {
  normal: "Suas respostas ficaram na faixa esperada para a maioria das pessoas nesta dimensão.",
  leve: "Um pouco acima do esperado. Vale observar o que tem pesado e o que ajuda a aliviar.",
  moderado:
    "Acima do esperado. Considere conversar com alguém de confiança ou procurar um profissional — não precisa esperar piorar.",
  severo:
    "Bem acima do esperado. Procurar apoio profissional agora é um passo importante; o CAPS/UBS da sua cidade atende sem custo.",
  "extremamente-severo":
    "Muito acima do esperado. Recomendamos procurar apoio profissional o quanto antes. Se precisar falar com alguém agora, o CVV atende 24h no 188.",
};

export const AVISO_NAO_DIAGNOSTICO =
  "Este check-in usa o DASS-21, um instrumento de autorrelato validado — mas não é diagnóstico nem substitui avaliação profissional. Só você vê estas respostas.";

// ---------------------------------------------------------------- schemas

export const RespostaSchema = z.object({
  item: z.number().int().min(1).max(21),
  valor: z.number().int().min(0).max(3),
});
export type Resposta = z.infer<typeof RespostaSchema>;

export const ResponderSchema = z.object({
  respostas: z.array(RespostaSchema).length(ITENS_POR_CHECKIN),
  textoLivre: z.string().trim().max(MAX_TEXTO_LIVRE).optional().transform((t) => (t ? t : undefined)),
});
export type Responder = z.infer<typeof ResponderSchema>;
