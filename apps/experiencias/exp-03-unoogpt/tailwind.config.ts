import type { Config } from 'tailwindcss';

/**
 * NENHUMA cor nasce aqui.
 *
 * `@unooria/design-system` é a única fonte de decisão visual. Este arquivo não
 * define paleta: ele APELIDA, para o Tailwind, as variáveis CSS que a seção
 * `chatgpt` publica — o Tailwind não enxerga `dist/styles-chatgpt.css` sozinho,
 * e sem esta ponte cada tela voltaria a escrever hexadecimal na mão.
 *
 * POR QUE TAILWIND NUMA EXPERIÊNCIA: as ~15 telas desta missão foram medidas em
 * playtest com estas classes, e reescrevê-las em CSS à mão arriscaria a medida
 * sem nenhum ganho. Precedente no repo: `exp-01-instanooria` também usa. O
 * Tailwind aqui é ferramenta de LAYOUT; componente de interface continua vindo
 * do pacote, pela ponte `@edu/ui/ds-chatgpt`.
 *
 * O bloco `un-*` do projeto de origem NÃO veio: lá o mesmo config servia à área
 * do aluno e ao painel do professor. Aqui o painel é do hub, e dentro do iframe
 * só existe o clone — a marca institucional é chrome do HUB, desenhada acima do
 * aparelho.
 *
 * ATENÇÃO a modificador de opacidade: `bg-gpt-superficie/40` NÃO funciona — o
 * valor é um `var()` com hexadecimal, e o Tailwind não sabe fatiá-lo. Onde for
 * preciso translucidez, use as escadas que o próprio pacote publica
 * (`gpt-veu-*`, `gpt-fill-*`).
 */
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Módulo chatgpt · área do aluno ───────────────────────────────
        // Semantic/Colors do arquivo "ChatGPT UI Kit (AI Chat)". Trocam
        // sozinhas com `data-gpt-theme`.
        gpt: {
          fundo: 'var(--gpt-bg-primary)',
          superficie: 'var(--gpt-bg-secondary)',
          afundado: 'var(--gpt-bg-tertiary)',
          inverso: 'var(--gpt-bg-inverse)',
          marca: 'var(--gpt-bg-brand)',

          tinta: 'var(--gpt-text-primary)',
          'tinta-2': 'var(--gpt-text-secondary)',
          'tinta-3': 'var(--gpt-text-tertiary)',
          'tinta-inv': 'var(--gpt-text-inverse)',
          'tinta-marca': 'var(--gpt-text-brand)',
          elo: 'var(--gpt-text-link)',

          borda: 'var(--gpt-border-default)',
          'borda-forte': 'var(--gpt-border-strong)',
          'borda-marca': 'var(--gpt-border-brand)',

          acao: 'var(--gpt-interactive-primary)',
          'acao-hover': 'var(--gpt-interactive-hover)',

          ok: 'var(--gpt-status-success)',
          erro: 'var(--gpt-status-error)',
          alerta: 'var(--gpt-status-warning)',
          info: 'var(--gpt-status-info)',

          // Escada translúcida dos componentes do kit: espelha em branco no
          // tema escuro, e é por isso que ela substitui `bg-preto/4`.
          'fill-2': 'var(--gpt-fill-2)',
          'fill-4': 'var(--gpt-fill-4)',
          'fill-8': 'var(--gpt-fill-8)',
          'fill-10': 'var(--gpt-fill-10)',
          'suave-40': 'var(--gpt-text-soft-40)',
          'suave-60': 'var(--gpt-text-soft-60)',
          'suave-80': 'var(--gpt-text-soft-80)',
          'veu-40': 'var(--gpt-overlay-black-40)',
          'veu-80': 'var(--gpt-overlay-black-80)',

          // Cliente web (`--gpt-web-*`, 0.1.14). São a segunda régua do
          // arquivo: a página `🟪 ChatGPT UI Kit` mede a tela `New chat` nos
          // dois temas, e três desses pares NÃO são espelho um do outro (o fio
          // da barra, o véu da doca e o botão de nova conversa). Por isso eles
          // existem à parte da escada semântica, e não se derivam dela.
          tela: 'var(--gpt-web-canvas)',
          fio: 'var(--gpt-web-hairline)',
          destaque: 'var(--gpt-web-accent)',
          sugestao: 'var(--gpt-web-suggestion)',
          veu: 'var(--gpt-web-veil)',

          // Primitivas. Só onde a semântica não alcança: as duas Equipes
          // precisam de duas cores que o aluno reencontre no mapa, e o kit
          // não tem token para "Equipe Alfa".
          azul: 'var(--gpt-color-blue-500)',
          roxo: 'var(--gpt-color-purple-600)',
          verde: 'var(--gpt-color-green-500)',
          vermelho: 'var(--gpt-color-red-500)',
          laranja: 'var(--gpt-color-orange-500)',
          amarelo: 'var(--gpt-color-yellow-500)',
          rosa: 'var(--gpt-color-pink-400)',
          cinza200: 'var(--gpt-color-gray-200)',
          cinza600: 'var(--gpt-color-gray-600)',
          cinza700: 'var(--gpt-color-gray-700)',
          cinza800: 'var(--gpt-color-gray-800)',
        },

      },
      fontFamily: {
        // As duas fontes vêm com o CSS do pacote (Inter e Open Sans, cada uma
        // no `@import` da sua folha). Nenhuma família é declarada aqui.
        gpt: ['var(--gpt-font-sans)', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        // Raio é decisão do pacote: `Primitives/Radius` do arquivo de design.
        'gpt-sm': 'var(--gpt-radius-sm)',
        'gpt-md': 'var(--gpt-radius-md)',
        'gpt-lg': 'var(--gpt-radius-lg)',
        'gpt-xl': 'var(--gpt-radius-xl)',
        'gpt-2xl': 'var(--gpt-radius-2xl)',
        'gpt-3xl': 'var(--gpt-radius-3xl)',
        'gpt-full': 'var(--gpt-radius-full)',
      },
      boxShadow: {
        'gpt-sm': 'var(--gpt-elevation-sm)',
        'gpt-md': 'var(--gpt-elevation-md)',
        'gpt-lg': 'var(--gpt-elevation-lg)',
        'gpt-xl': 'var(--gpt-elevation-xl)',
        'gpt-modal': 'var(--gpt-elevation-modal)',
      },
      keyframes: {
        // O relógio avançou: um pulso curto, o suficiente para o olho ir lá.
        'pulso-relogio': {
          '0%': { transform: 'scale(1)' },
          '35%': { transform: 'scale(1.06)' },
          '100%': { transform: 'scale(1)' },
        },
        // Bairro que acabou de ganhar dado: pisca para o aluno ligar a fonte
        // que ele pediu ao que apareceu no mapa. A cor sai do token da marca.
        acender: {
          '0%': { boxShadow: '0 0 0 0 transparent', transform: 'scale(1)' },
          '30%': {
            boxShadow: '0 0 0 8px var(--gpt-fill-10)',
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
        // verdade. A largura da barra é a do `Sidebar` do módulo chatgpt.
        topbar: '56px',
        trilha: '260px',
      },
    },
  },
  plugins: [],
};

export default config;
