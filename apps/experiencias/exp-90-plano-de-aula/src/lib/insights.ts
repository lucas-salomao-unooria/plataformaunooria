// Insights sobre IA na educação exibidos enquanto o plano é gerado.
//
// Lista fixa (semente do app origem). A versão gerada por IA (`/api/insights`)
// ficou de fora da migração: era cosmética, gastava tokens e a lista já cobre
// os minutos de espera — a tela nunca fica vazia.

export type Insight = {
  /** Rótulo curto da categoria, exibido como Tag. */
  categoria: string;
  titulo: string;
  texto: string;
  /** Nome do glifo no Material Symbols Rounded — a iconografia do DS. */
  icone: string;
};

export const INSIGHTS_SEMENTE: Insight[] = [
  {
    categoria: "Planejamento",
    titulo: "A IA rascunha; quem valida é você",
    texto:
      "Modelos de linguagem produzem texto plausível, não texto verificado. Trate o plano gerado como um primeiro rascunho: confira se as habilidades citadas existem mesmo na BNCC e se a progressão faz sentido para a sua turma.",
    icone: "edit_document",
  },
  {
    categoria: "Avaliação",
    titulo: "Peça critérios, não só atividades",
    texto:
      "Ao pedir uma atividade à IA, peça junto a rubrica de avaliação. Ter os critérios explícitos antes de aplicar ajuda a perceber quando a tarefa mede outra coisa diferente do que você queria avaliar.",
    icone: "checklist",
  },
  {
    categoria: "Sala de aula",
    titulo: "Use a IA como objeto de estudo, não só como ferramenta",
    texto:
      "Mostrar à turma uma resposta errada da IA e pedir que encontrem o erro desenvolve leitura crítica. O estudante deixa de ser consumidor da resposta e passa a avaliá-la.",
    icone: "psychology",
  },
  {
    categoria: "Prompt",
    titulo: "Contexto vale mais que capricho na redação",
    texto:
      "Informar ano, tempo de aula, recursos disponíveis e o que a turma já viu muda mais o resultado do que floreios no pedido. Seja específico sobre as restrições reais da sua escola.",
    icone: "tips_and_updates",
  },
  {
    categoria: "Equidade",
    titulo: "Nem todo estudante chega com o mesmo acesso",
    texto:
      "Antes de propor uma atividade que dependa de IA em casa, verifique quem tem dispositivo e internet. Prever uma alternativa offline evita transformar a proposta em mais um filtro de desigualdade.",
    icone: "diversity_3",
  },
  {
    categoria: "Dados",
    titulo: "Dado de estudante não entra no prompt",
    texto:
      "Nome, matrícula, laudo, endereço e foto de estudante não devem ser colados em ferramentas de IA. Descreva a situação de forma anônima — “estudante do 6º ano com dificuldade em interpretação” já basta para obter uma boa sugestão.",
    icone: "shield_lock",
  },
  {
    categoria: "Autoria",
    titulo: "Combine as regras de uso antes da atividade",
    texto:
      "Deixar explícito o que é permitido — pesquisar, revisar texto, gerar ideias — e o que não é evita conflito depois. Regras combinadas no início funcionam melhor que proibições aplicadas no fim.",
    icone: "handshake",
  },
  {
    categoria: "Tempo",
    titulo: "O ganho real está na revisão, não na criação",
    texto:
      "A economia costuma vir de adaptar material que já existe: mudar o nível de leitura de um texto, gerar variações de um exercício, resumir um documento longo da rede. Criar do zero exige mais conferência.",
    icone: "schedule",
  },
];
