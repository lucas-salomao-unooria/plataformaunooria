import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import next from "@next/eslint-plugin-next";

/**
 * ESLint 9 (flat config), único para o monorepo inteiro.
 *
 * Antes disto os scripts de `lint` de todos os pacotes eram `echo` — o
 * `pnpm turbo lint` passava sempre, e o verde não significava nada.
 *
 * A régua é deliberadamente CURTA: só o que o TypeScript não pega e que já
 * mordeu este projeto (promise solta, `any`, hook em condicional). Regra que
 * vira ruído é regra que ensina a ignorar o lint.
 */
export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/.next-prod/**",
      "**/node_modules/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/storage/**",
      "apps/api/prisma/migrations/**",
      /** Gerado pelo Next a cada build — não é nosso código. */
      "apps/hub/next-env.d.ts",
      /**
       * O jogo da Vila do Lume. NÃO é esquecimento: são scripts clássicos com
       * globais compartilhados (`state`, `zones`, `THREE`), linguagem própria em
       * pixel, e a decisão de mantê-los assim está registrada em
       * `apps/experiencias/app-70-vila-do-lume/ADR-0001-jogo-nao-e-typescript.md`.
       * Rodar esta régua ali produziria centenas de `no-undef` sem nenhum bug
       * atrás — e régua que grita sem motivo ensina a ignorar o lint.
       * O shim (`src/`) É lintado normalmente.
       */
      "apps/experiencias/app-70-vila-do-lume/public/jogo/**",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      /**
       * Regra inviolável do CLAUDE.md: sem `any` — use `unknown` + narrow.
       * Erro, não aviso: é a diferença entre a regra existir e ser cumprida.
       */
      "@typescript-eslint/no-explicit-any": "error",

      /** Variável não usada some; prefixo `_` é a saída explícita. */
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],

      /** `console.log` esquecido em produção; warn/error seguem liberados. */
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],

      /**
       * Texto em pt-BR usa espaço não-quebrável de propósito (números com
       * unidade, "1 200", nomes que não podem partir de linha). A regra fica,
       * mas só fora de string e comentário.
       */
      "no-irregular-whitespace": ["error", { skipStrings: true, skipComments: true, skipTemplates: true }],
    },
  },

  /**
   * Regras que EXIGEM informação de tipo — só onde há projeto TS. Fora daqui
   * (configs, scripts .mjs) o ESLint não consegue resolvê-las e aborta.
   */
  {
    files: ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      /**
       * Promise sem await/void/catch. Foi assim que o buffer de telemetria
       * perdia lote em silêncio no projeto origem.
       */
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
    },
  },

  /** React: as duas regras de hooks que o tsc não vê. */
  {
    files: ["apps/hub/**/*.{ts,tsx}", "apps/experiencias/**/*.{ts,tsx}", "packages/ui/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },

  /**
   * Regras do Next só no hub. As experiências são Vite puro: `<img>` ali é
   * correto (não existe next/image), e os `eslint-disable` de
   * `@next/next/no-img-element` que vieram no porte são resquício —
   * registrar o plugin aqui evita o erro de "regra não encontrada" e mantém
   * a verificação onde ela faz sentido.
   */
  {
    files: ["apps/hub/**/*.{ts,tsx}"],
    plugins: { "@next/next": next },
    rules: {
      ...next.configs.recommended.rules,
      ...next.configs["core-web-vitals"].rules,
      /** Regra do Pages Router: o hub é App Router e não tem `pages/`. */
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  {
    files: ["apps/experiencias/**/*.{ts,tsx}"],
    plugins: { "@next/next": next },
    rules: { "@next/next/no-img-element": "off" },
  },

  /**
   * NestJS usa decorators e injeção por tipo: parâmetro de construtor
   * "não usado" é o padrão do framework, e o service é resolvido em runtime.
   */
  {
    files: ["apps/api/**/*.ts"],
    rules: { "@typescript-eslint/no-extraneous-class": "off" },
  },

  /** Scripts e configs: Node puro, sem projeto TS — desliga o linting tipado. */
  {
    files: ["scripts/**/*.mjs", "**/*.config.{mjs,js,cjs,ts}", "**/*.cjs", "**/*.mjs"],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      globals: globals.node,
      // Estes arquivos ficam fora do `include` dos tsconfigs; sem desligar o
      // project service o parser aborta com "was not found by the project".
      parserOptions: { projectService: false, project: false },
    },
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      "no-console": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  /** Seeds e testes: console é a saída esperada. */
  {
    files: ["apps/api/prisma/**/*.ts", "**/*.spec.ts", "**/*.test.ts", "apps/api/tests/**/*.ts"],
    rules: { "no-console": "off" },
  },
);
