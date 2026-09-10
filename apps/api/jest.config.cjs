/** Jest + ts-jest. Os testes de integração (tests/) exigem o Postgres local
 *  do README (`docker run ... postgres:16`) com a migration aplicada. */
module.exports = {
  /**
   * SERIALIZADO, e a razão é medida.
   *
   * Vinte das 94 suítes falam com o MESMO Postgres, e várias afirmam contagem
   * exata sobre tabelas de nível de CONTRATO — `experiencias`,
   * `periodos_letivos`, `disponibilidades` — que não têm `escola_id` e
   * portanto não isolam por suíte. Em paralelo isso produz um vermelho
   * intermitente que aponta para o lugar errado: a suíte que reprova é a que
   * LEU, não a que escreveu.
   *
   * MEDIDO em 2026-09-10, depois de consertar quatro defeitos reais de
   * isolamento (o `GRANT` concorrente de `role-de-runtime`, a limpeza de
   * catálogo de `oneroster-modelos`, e duas suítes minhas escrevendo em tabela
   * global): em paralelo, ~1 falha a cada 60 corridas completas, em suíte
   * DIFERENTE a cada vez; serializado, ZERO em 25.
   *
   * O custo é 17,6s contra 5,4s. Doze segundos por corrida contra um vermelho
   * que custa um diagnóstico inteiro cada vez que aparece — e que já custou
   * três nesta sessão. Não é sofisticação que falta: um `projects` do Jest com
   * o grupo de banco em série e o resto em paralelo exigiria manter uma lista
   * de caminhos à mão, que é a lista que ninguém atualiza.
   *
   * GATILHO PARA REAVALIAR: quando a suíte passar de ~60s. Aí o caminho é
   * fixture por suíte nas tabelas de contrato (cada uma com o próprio
   * `exp-99-*`, como as suítes de recursos fazem), e não voltar a paralelizar
   * com o problema no lugar.
   */
  maxWorkers: 1,
  /**
   * O CATÁLOGO REAL, uma vez, antes de qualquer suíte — a razão inteira está em
   * `tests/catalogo-real.ts`. Resumo: `experiencias` é tabela de contrato e
   * várias suítes só a LEEM; no banco de dev o seed a preencheu, no Postgres
   * descartável do CI ela nasce vazia, e o vermelho aparecia como "a guarda de
   * disponibilidade não funciona" em vez de "faltou o dado".
   */
  globalSetup: "<rootDir>/tests/catalogo-real.ts",
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }],
  },
  testTimeout: 30000,
};
