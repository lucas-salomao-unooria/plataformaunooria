/**
 * O FUSO da plataforma, do lado da api.
 *
 * **É o MESMO padrão e a MESMA variável de ambiente de `packages/sdk/src/fuso.ts`,
 * copiados.** A api não consome pacote de workspace — `packages/AGENTS.md`
 * registra a regra e a exceção do logger —, e arrastar o `@edu/sdk` inteiro
 * (handshake, `postMessage`, telemetria de navegador) para dentro do NestJS por
 * causa de uma string seria pior que a cópia.
 *
 * O que segura a igualdade **não é confiança**: `tests/fuso-da-plataforma.spec.ts`
 * lê o arquivo do SDK e reprova se os dois divergirem — o valor padrão E o nome
 * da variável.
 *
 * O fuso existia desde sempre em `src/bemestar/catalogo.ts`, onde ninguém fora
 * do bem-estar o acharia — e por isso o hub formatou data sem fuso nenhum por
 * meses (ADR-98). Desde a ADR-99 ele é CONFIGURÁVEL: o valor vem da env
 * `FUSO_DA_PLATAFORMA`, porque 1 contrato = 1 stack de infra e haverá rede fora
 * de Brasília. Ausente = `FUSO_PADRAO`; nada quebra por falta da variável.
 *
 * **Aqui, ao contrário do hub, fuso inválido DERRUBA O BOOT** (`config/env.ts`
 * valida com Zod). Um typo como `America/SaoPaulo` só apareceria na hora de
 * renderizar uma data — no meio de uma requisição, dias depois do deploy —, e o
 * lugar barato de descobrir isso é a subida do processo.
 */

/** O valor quando a variável está ausente. O mesmo do SDK, por teste. */
export const FUSO_PADRAO = "America/Sao_Paulo";

/** O nome da variável, num lugar só — ele aparece no schema de env e aqui. */
export const ENV_DO_FUSO = "FUSO_DA_PLATAFORMA";

/**
 * Válido = o `Intl` aceita. Não há lista IANA para conferir contra:
 * `Intl.supportedValuesOf("timeZone")` omite os aliases legados
 * (`America/Sao_Paulo` está lá, `Brazil/East` não), e recusar um alias que o
 * `Intl` aceita seria recusar configuração que funciona.
 *
 * **Um offset fixo (`-03:00`) PASSA**, porque o `Intl` o aceita. Ele congela o
 * deslocamento: se a rede voltar a ter horário de verão, fica uma hora atrasada
 * sem nada acusar. Não recusamos — recusar o que o `Intl` aceita é recusar
 * configuração que funciona —, mas a documentação pede o nome IANA.
 */
export function fusoEhValido(fuso: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: fuso });
    return true;
  } catch {
    return false;
  }
}

/**
 * O fuso em vigor, lido do ambiente.
 *
 * **Não é memorizado.** Diferente do SDK — que precisa disso porque formata
 * cada linha de uma tabela no navegador —, aqui a leitura é de `process.env` e
 * acontece em rotas, não em laços de renderização. Reler mantém o teste honesto:
 * é o que permite provar, no mesmo processo, que trocar a variável muda o dia.
 *
 * Valor inválido cai no padrão em vez de lançar: quem barra o typo é o boot, e
 * uma exceção aqui transformaria um erro de configuração num 500 no meio de uma
 * aula.
 */
export function fusoDaPlataforma(env: NodeJS.ProcessEnv = process.env): string {
  const bruto = env[ENV_DO_FUSO];
  if (bruto === undefined || bruto === "") return FUSO_PADRAO;
  return fusoEhValido(bruto) ? bruto : FUSO_PADRAO;
}

/**
 * `2026-09-11` — o DIA no fuso da plataforma.
 *
 * `toISOString().slice(0, 10)` daria o dia em UTC, e às 22h de Brasília isso é
 * o dia seguinte: um check-in feito à noite contaria como o de amanhã, e o de
 * amanhã seria recusado por "já respondeu hoje".
 */
export function diaDaPlataforma(instante: Date, fuso: string = fusoDaPlataforma()): string {
  // `en-CA` porque o formato dele JÁ é `YYYY-MM-DD`; montar a string a partir
  // das partes de `pt-BR` reintroduziria a inversão de dia e mês.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instante);
}
