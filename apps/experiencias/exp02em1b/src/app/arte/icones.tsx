/**
 * Ícones das fontes de dados. Linha simples, herdam a cor do texto.
 *
 * Existem porque a lista do Resultado — "o que você não consultou" — é oito
 * blocos de texto iguais, e o estudante lê os dois primeiros e desiste. Ícone dá
 * ponto de entrada por item.
 *
 * POR QUE NÃO SÃO O `Icon` DO PACOTE, desde a 0.1.14 que o publica:
 *
 * O registro do módulo `chatgpt` tem treze vetores, e eles são o vocabulário de
 * um cliente de conversa — `chatText`, `trash`, `sun`, `user`, `signOut`. Estas
 * oito são fontes de DADO de defesa civil: sirene, nível de rio, cadastro de
 * moradores, satélite, telefonia, malha viária, estudo de campo. Dois ou três
 * dariam para forçar (`user` para o censo, `sun` para a previsão), e os outros
 * cinco cairiam num ícone que diz outra coisa — o que é pior do que um desenho
 * honesto, porque desinforma sobre a fonte que o estudante deixou de consultar.
 *
 * Então são ilustração de domínio, como o terreno do mapa (`mapa-base.tsx`), e
 * ficam aqui declaradas em um lugar só. Isto NÃO contradiz a proibição do DS de
 * desenhar ícone à mão (§7.4): aquela regra é sobre substituir um ícone DO
 * PACOTE por uma aproximação. Onde o pacote tem o ícone certo — os três passos
 * do Briefing — quem desenha é ele.
 */
const traco = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden>
      {children}
    </svg>
  );
}

const ICONES: Record<string, React.ReactNode> = {
  // Chamados de socorro: sirene.
  ocorrencias: (
    <Moldura>
      <path d="M6 17h12M8 17v-5a4 4 0 0 1 8 0v5M12 4v2" {...traco} />
    </Moldura>
  ),
  // Nível do rio: onda medida.
  sensores: (
    <Moldura>
      <path d="M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0M6 11V5m12 6V7" {...traco} />
    </Moldura>
  ),
  // Cadastro de moradores: pessoas.
  censo: (
    <Moldura>
      <path
        d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 19c0-3 3-5 6-5s6 2 6 5M17 8a2.5 2.5 0 1 0 0-5M18 19c0-2-1-3.5-2.5-4.5"
        {...traco}
      />
    </Moldura>
  ),
  // Previsão: nuvem com chuva.
  previsao: (
    <Moldura>
      <path
        d="M7 15a4 4 0 0 1 .8-7.9 5 5 0 0 1 9.5 1.6A3.2 3.2 0 0 1 17 15H7ZM9 18l-1 2m4-2-1 2m4-2-1 2"
        {...traco}
      />
    </Moldura>
  ),
  // Satélite: órbita.
  satelite: (
    <Moldura>
      <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" {...traco} />
      <path d="M4.5 6.5c-1.6 2.4 3 8.6 7 12s10 3.6 8.5.5" {...traco} />
    </Moldura>
  ),
  // Telefonia: celular com sinal.
  telefonia: (
    <Moldura>
      <path d="M8 3h8v18H8zM11 18h2" {...traco} />
      <path d="M18 6c1.2 1.2 1.2 4.8 0 6" {...traco} />
    </Moldura>
  ),
  // Malha viária: estrada.
  viaria: (
    <Moldura>
      <path d="M8 3 5 21M16 3l3 18M12 4v3m0 4v3m0 4v3" {...traco} />
    </Moldura>
  ),
  // Estudo de campo: lupa sobre a casa.
  estudo: (
    <Moldura>
      <path d="M11 4 4 9v11h14V9l-7-5Z" {...traco} />
      <path d="M13 13a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm3 6 2.5 2.5" {...traco} />
    </Moldura>
  ),
};

export function IconeDaFonte({ slug }: { slug: string }) {
  return <span className="text-gpt-azul">{ICONES[slug] ?? ICONES.censo}</span>;
}
