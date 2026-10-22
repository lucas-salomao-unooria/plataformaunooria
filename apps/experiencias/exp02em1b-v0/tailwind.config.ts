import type { Config } from 'tailwindcss';

/**
 * NENHUMA cor nasce aqui.
 *
 * `@unooria/design-system` é a única fonte de decisão visual. Este arquivo não
 * define paleta: ele APELIDA, para o Tailwind, as variáveis CSS que a seção
 * `unooriaai` publica — o Tailwind não enxerga `dist/styles-unooriaai.css`
 * sozinho, e sem esta ponte cada tela voltaria a escrever hexadecimal na mão.
 *
 * POR QUE TAILWIND NUMA EXPERIÊNCIA: as ~15 telas desta missão foram medidas em
 * playtest com estas classes, e reescrevê-las em CSS à mão arriscaria a medida
 * sem nenhum ganho. Precedente no repo: `exp08ef1b` também usa. O
 * Tailwind aqui é ferramenta de LAYOUT; componente de interface continua vindo
 * do pacote, pela ponte `@edu/ui/ds-unooriaai`.
 *
 * O bloco `un-*` do projeto de origem NÃO veio: lá o mesmo config servia à área
 * do estudante e ao painel do professor. Aqui o painel é do hub, e dentro do iframe
 * só existe o clone — a marca institucional é chrome do HUB, desenhada acima do
 * aparelho.
 *
 * ATENÇÃO a modificador de opacidade: `bg-uai-superficie/40` NÃO funciona — o
 * valor é um `var()` com hexadecimal, e o Tailwind não sabe fatiá-lo. Onde for
 * preciso translucidez, use as escadas que o próprio pacote publica
 * (`uai-fill-*`, `uai-veu-escuro`).
 */
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Seção unooriaai · área do estudante ──────────────────────────
        // As cores semânticas da seção (ADR-138). Trocam sozinhas com
        // `data-uai-theme`, e cada valor de cada tema é um degrau nomeado da
        // paleta da Unooria — nenhum é derivado por cálculo.
        uai: {
          fundo: 'var(--uai-bg-primary)',
          superficie: 'var(--uai-bg-secondary)',
          afundado: 'var(--uai-bg-tertiary)',
          inverso: 'var(--uai-bg-inverse)',
          marca: 'var(--uai-bg-brand)',

          tinta: 'var(--uai-text-primary)',
          'tinta-2': 'var(--uai-text-secondary)',
          'tinta-3': 'var(--uai-text-tertiary)',
          'tinta-inv': 'var(--uai-text-inverse)',
          'tinta-marca': 'var(--uai-text-brand)',
          elo: 'var(--uai-text-link)',

          borda: 'var(--uai-border-default)',
          'borda-forte': 'var(--uai-border-strong)',
          'borda-marca': 'var(--uai-border-brand)',

          acao: 'var(--uai-interactive-primary)',
          'acao-hover': 'var(--uai-interactive-hover)',

          ok: 'var(--uai-status-success)',
          erro: 'var(--uai-status-error)',
          alerta: 'var(--uai-status-warning)',
          info: 'var(--uai-status-info)',

          // Escada translúcida dos componentes do kit: espelha em branco no
          // tema escuro, e é por isso que ela substitui `bg-preto/4`.
          'fill-2': 'var(--uai-fill-2)',
          'fill-4': 'var(--uai-fill-4)',
          'fill-8': 'var(--uai-fill-8)',
          'fill-10': 'var(--uai-fill-10)',
          'suave-40': 'var(--uai-text-soft-40)',
          'suave-60': 'var(--uai-text-soft-60)',
          'suave-80': 'var(--uai-text-soft-80)',
          // O véu escuro. A seção `chatgpt` tinha uma escada de preto (40% e
          // 80%); a `unooriaai` publica um degrau só, em roxo a 50%.
          'veu-escuro': 'var(--uai-overlay-scrim)',

          // Cliente web (`--uai-web-*`). São a segunda régua da seção: a tela
          // de nova conversa nos dois temas, e três desses pares NÃO são
          // espelho um do outro (o fio da barra, o véu da doca e o acento).
          // Por isso eles existem à parte da escada semântica, e não se
          // derivam dela.
          tela: 'var(--uai-web-canvas)',
          fio: 'var(--uai-web-hairline)',
          destaque: 'var(--uai-web-accent)',
          sugestao: 'var(--uai-web-suggestion)',
          veu: 'var(--uai-web-veil)',

          // As duas Equipes. A seção NÃO publica cor primitiva (nenhuma: só
          // semântica), e o estudante precisa reencontrar no mapa as duas
          // cores que viu no briefing. Saem do token semântico mais próximo do
          // par que existia — azul e roxo —, nunca de hexadecimal nem do
          // `--gpt-color-*` da outra seção. O roxo da Bravo é o da marca: é o
          // preço de não inventar cor.
          'equipe-alfa': 'var(--uai-status-info)',
          'equipe-bravo': 'var(--uai-bg-brand)',
        },

      },
      fontFamily: {
        // A Open Sans vem com a folha de fonte do pacote
        // (`fonts/unooriaai.css`). Nenhuma família é declarada aqui.
        uai: ['var(--uai-font-sans)', 'Open Sans', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        // Raio é decisão do pacote: a escada `--uai-radius-*` da seção.
        'uai-sm': 'var(--uai-radius-sm)',
        'uai-md': 'var(--uai-radius-md)',
        'uai-lg': 'var(--uai-radius-lg)',
        'uai-xl': 'var(--uai-radius-xl)',
        'uai-2xl': 'var(--uai-radius-2xl)',
        'uai-3xl': 'var(--uai-radius-3xl)',
        'uai-full': 'var(--uai-radius-full)',
      },
      boxShadow: {
        // A seção publica dois degraus de sombra (a escada sm/md/lg/xl da
        // `chatgpt` não veio): o de sobreposição e o do diálogo.
        'uai-overlay': 'var(--uai-elevation-overlay)',
        'uai-modal': 'var(--uai-elevation-modal)',
      },
      keyframes: {
        // O relógio avançou: um pulso curto, o suficiente para o olho ir lá.
        'pulso-relogio': {
          '0%': { transform: 'scale(1)' },
          '35%': { transform: 'scale(1.06)' },
          '100%': { transform: 'scale(1)' },
        },
        // Bairro que acabou de ganhar dado: pisca para o estudante ligar a fonte
        // que ele pediu ao que apareceu no mapa. A cor sai do token da marca.
        acender: {
          '0%': { boxShadow: '0 0 0 0 transparent', transform: 'scale(1)' },
          '30%': {
            boxShadow: '0 0 0 8px var(--uai-fill-10)',
            transform: 'scale(1.04)',
          },
          '100%': { boxShadow: '0 0 0 0 transparent', transform: 'scale(1)' },
        },
        // A chuva do Briefing: as linhas diagonais escorrem devagar. Só
        // cenário — e some inteira com prefers-reduced-motion.
        chuva: {
          '0%': { transform: 'translateY(-48px)' },
          '100%': { transform: 'translateY(0)' },
        },
        // Relatório novo entra deslizando: o olho acompanha a chegada dele.
        'entrar-cartao': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // "+4 min" sobe e some, como um dano em jogo: o tempo foi embora.
        'subir-e-sumir': {
          '0%': { opacity: '0', transform: 'translate(-50%, 6px)' },
          '20%': { opacity: '1' },
          '100%': { opacity: '0', transform: 'translate(-50%, -18px)' },
        },
      },
      animation: {
        'pulso-relogio': 'pulso-relogio 600ms ease-out',
        'subir-e-sumir': 'subir-e-sumir 2s ease-out forwards',
        'entrar-cartao': 'entrar-cartao 400ms ease-out',
        acender: 'acender 1.6s ease-out',
        chuva: 'chuva 1.4s linear infinite',
      },
      spacing: {
        // Nome de componente, não número solto: auditável contra a fonte da
        // verdade. A largura da barra é a do `Sidebar` da seção unooriaai.
        topbar: '56px',
        trilha: '260px',
      },
    },
  },
  plugins: [],
};

export default config;
