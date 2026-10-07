import type { FichaPedagogica } from "./tipos";

/**
 * A FICHA da Missão Tempestade (exp02em1b, UnooriaAI, 2º ano EM, unidade 1) —
 * versão 1, de 2026-10-07 (ADR-154).
 *
 * Quatro habilidades, quatro perguntas de múltipla escolha (o Canal B) na tela
 * de RESULTADO, depois do desfecho. O PO: nenhuma ação isolada da missão
 * (conversar com o Cientista, escolher fontes, mandar as equipes) diz se o
 * estudante compreendeu o mecanismo da IA, avaliou a confiabilidade dos dados,
 * percebeu o impacto do sistema nas pessoas ou ligou a experiência a direitos.
 *
 *   - **EM13CO14** (confiabilidade da informação digital) pela p1;
 *   - **EM13CO08** (segurança e dados pessoais) pela p2;
 *   - **EM13CO24** (artefatos computacionais e a vida das pessoas) pela p3;
 *   - **EM13CO26** (direito digital) pela p4.
 *
 * Enunciado e alternativas são o texto do PO, LITERAL. Os critérios foram
 * redigidos a partir das alternativas (o PO não mandou o "por que essa
 * calibragem" desta missão) e passam pela revisão do Lucas.
 *
 * Duas regras só desta régua (decisão do Lucas, 2026-10-07):
 *   - **vale a MELHOR resposta** (`respostas: "melhor"`): a pergunta reaparece no
 *     resultado de cada tentativa, e a resposta nova só substitui a guardada se
 *     for melhor;
 *   - **só conta quando o professor ENCERRA a missão na Sala de Aula**
 *     (`contaAoEncerrarAMissao`): até lá o painel não mostra nível.
 */
export const FICHA_EXP02EM1B: FichaPedagogica = {
  expId: "exp02em1b",
  versao: 1,
  respostas: "melhor",
  contaAoEncerrarAMissao: true,
  habilidades: [
    {
      codigo: "EM13CO14",
      marcadores: [{ id: "p1", tipo: "multipla_escolha", perguntaId: "p1" }],
      criterios: {
        atingiu:
          "Na 1ª pergunta, entende a faixa e o nível de confiança como o limite honesto do que os dados permitem prever: a informação é confiável dentro desse limite.",
        em_processo:
          "Na 1ª pergunta, atribui a incerteza à falta de dados e acha que mais fontes dariam um número exato.",
        nao_atingiu: "Na 1ª pergunta, considera a informação pouco confiável porque não veio um número exato.",
        observacao: "Vale a melhor resposta da rodada, e só depois que a missão é encerrada na Sala de Aula.",
      },
    },
    {
      codigo: "EM13CO08",
      marcadores: [{ id: "p2", tipo: "multipla_escolha", perguntaId: "p2" }],
      criterios: {
        atingiu:
          "Na 2ª pergunta, reconhece os dados como sensíveis (onde cada pessoa mora, quem está em área de risco) e pede proteção, uso só para o resgate e cuidado para não vazarem.",
        em_processo:
          "Na 2ª pergunta, pede dados corretos e atualizados, sem enxergar o risco de exposição de quem é vulnerável.",
        nao_atingiu: "Na 2ª pergunta, acha que a emergência dispensa qualquer cuidado com os dados.",
        observacao: "Vale a melhor resposta da rodada, e só depois que a missão é encerrada na Sala de Aula.",
      },
    },
    {
      codigo: "EM13CO24",
      marcadores: [{ id: "p3", tipo: "multipla_escolha", perguntaId: "p3" }],
      criterios: {
        atingiu:
          "Na 3ª pergunta, reconhece que o sistema usado na decisão interfere na segurança física das pessoas, e que o bairro sem equipe foi resultado do sistema e das perguntas que ele fez ou deixou de fazer.",
        em_processo: "Na 3ª pergunta, diz que a tecnologia ajuda se for bem usada, sem ligar o resultado à própria decisão.",
        nao_atingiu: "Na 3ª pergunta, descarta o resultado por ser uma simulação.",
        observacao: "Vale a melhor resposta da rodada, e só depois que a missão é encerrada na Sala de Aula.",
      },
    },
    {
      codigo: "EM13CO26",
      marcadores: [{ id: "p4", tipo: "multipla_escolha", perguntaId: "p4" }],
      criterios: {
        atingiu:
          "Na 4ª pergunta, aponta o direito de saber como a decisão automatizada foi tomada (dados, critérios, responsável) e de questioná-la.",
        em_processo: "Na 4ª pergunta, aponta o direito de reclamar e pedir revisão, sem exigir transparência da decisão.",
        nao_atingiu: "Na 4ª pergunta, acha que a emergência suspende os direitos das pessoas afetadas.",
        observacao: "Vale a melhor resposta da rodada, e só depois que a missão é encerrada na Sala de Aula.",
      },
    },
  ],
  perguntas: [
    {
      id: "p1",
      enunciado:
        "O Cientista de Dados nunca te deu um número fechado — sempre falou em faixa e nível de confiança. O que isso diz sobre a confiabilidade das informações que ele te passou?",
      alternativas: [
        {
          id: "A1",
          texto:
            "As informações eram confiáveis dentro de um limite: ele mostrava até onde os dados permitiam prever e onde começava a incerteza. A faixa e o nível de confiança são justamente o modo dele deixar claro o que é previsão firme e o que é estimativa.",
          status: "atingiu",
        },
        {
          id: "A2",
          texto:
            "Significa que ele não tinha todos os dados. Se eu tivesse pedido mais fontes, talvez as informações ficassem mais confiáveis e ele pudesse dar um número mais exato.",
          status: "em_processo",
        },
        {
          id: "A3",
          texto:
            "As informações não eram muito confiáveis, porque ele nunca conseguiu me dar uma resposta certa. Um sistema bom daria o número exato.",
          status: "nao_atingiu",
        },
      ],
    },
    {
      id: "p2",
      enunciado:
        "Para ajudar na sua decisão, o sistema usou dados como cadastro de moradores, previsão de chuva e registros por bairro. Se um sistema desses existisse de verdade, que cuidado ele exigiria com esses dados?",
      alternativas: [
        {
          id: "B1",
          texto:
            "São dados sensíveis — onde cada pessoa mora, qual bairro alaga mais, quem está em área de risco. O sistema precisaria proteger essas informações, usar só pra finalidade de resgate e garantir que não vazem, porque nas mãos erradas expõem justamente quem já está vulnerável.",
          status: "atingiu",
        },
        {
          id: "B2",
          texto: "Os dados precisariam estar corretos e atualizados, senão o sistema manda a equipe pro lugar errado.",
          status: "em_processo",
        },
        {
          id: "B3",
          texto: "Não precisa de cuidado especial. Em emergência, o importante é salvar vidas — o resto vem depois.",
          status: "nao_atingiu",
        },
      ],
    },
    {
      id: "p3",
      enunciado:
        "O resultado mostrou quantas pessoas foram resgatadas e quantas ficaram expostas. O que a missão mostra sobre como um sistema computacional pode afetar a vida das pessoas?",
      alternativas: [
        {
          id: "C1",
          texto:
            "Mostra que quando um sistema computacional é usado pra tomar decisões sobre emergências, ele interfere diretamente na segurança física das pessoas. O bairro que ficou sem equipe teve gente exposta por causa da combinação entre o sistema e as perguntas que eu fiz — ou deixei de fazer.",
          status: "atingiu",
        },
        {
          id: "C2",
          texto: "Mostra que a tecnologia pode ajudar a salvar vidas, mas só se for usada direito.",
          status: "em_processo",
        },
        {
          id: "C3",
          texto:
            "É uma simulação. Na vida real teria mais equipes e mais tempo, então o resultado seria diferente.",
          status: "nao_atingiu",
        },
      ],
    },
    {
      id: "p4",
      enunciado:
        "Na missão, um sistema de IA ajudou a decidir quais bairros receberiam resgate e quais ficariam sem equipe. Se isso fosse uma decisão real sobre a vida de pessoas, que direitos elas teriam?",
      alternativas: [
        {
          id: "D1",
          texto:
            "Teriam o direito de saber como a decisão foi tomada — quais dados foram usados, quais critérios pesaram, quem é responsável. Ninguém deveria ter o resgate negado por uma decisão automatizada sem transparência e sem possibilidade de questionar.",
          status: "atingiu",
        },
        {
          id: "D2",
          texto:
            "Teriam o direito de reclamar se o bairro delas ficasse sem equipe e de pedir que alguém revisasse a decisão.",
          status: "em_processo",
        },
        {
          id: "D3",
          texto:
            "Em emergência, alguém tem que decidir rápido. Não dá pra ficar discutindo direitos quando tem gente em risco.",
          status: "nao_atingiu",
        },
      ],
    },
  ],
};
