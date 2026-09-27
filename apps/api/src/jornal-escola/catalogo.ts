import type { NoticiaDoPacote } from "./contrato-de-rotas";
import { IDS_DE_BLOCO, TIPOS_DE_PISTA, type IdDeBloco } from "./vocabulario";

/**
 * O CATÁLOGO da exp04ef1b — o BANCO PADRÃO "Feira de Ciências e Notícias da
 * Cidade", os seis blocos da Chave do Editor, o roteiro da mediação e a
 * curiosidade da espera. Mora na api, e não no bundle, por três motivos:
 *
 * 1. O gabarito de cada notícia (se é publicável, o pilar que falta) e a
 *    consequência são a RESPOSTA da missão (regra inviolável nº 3): quem os
 *    entrega é o servidor, cada um no seu portão (`contrato-de-rotas.ts`).
 * 2. O banco padrão é também a QUEDA do preparo: sem homologação, a turma roda
 *    este pacote (`garantirPacote`), e é a mesma régua (`invariantes.ts`) que o
 *    confere — `tests/jornal-escola-regras.spec.ts` cobra `problemasDoPacote`
 *    vazio.
 * 3. Corrigir uma notícia não pode exigir republicar a experiência.
 *
 * **O texto das oito notícias é da equipe e conta como texto gerado por IA**:
 * o dono do produto dispensou a aprovação pedagógica (2026-09-25). As sementes
 * são as dos artefatos: a feira de ciências, a horta, o ônibus para o museu, o
 * planetário, a oficina de robótica de 2018 como a isca antiga apresentada
 * como atual (a imagem MAIS bonita do lote, brief §2.1), e o boato do corte de
 * água sem fonte nem autoria. As reações são as do PRD (`e4.reacao.*` da copy
 * revisada) como molde, uma por notícia (PDF §7).
 *
 * O boato da mesa NÃO é o do Desafio Final (`e6.cenario.boato_chat`, "a água
 * de todas as escolas do bairro"): lá a criança transfere o critério para uma
 * mensagem nova, e repetir o texto da mesa trocaria transferência por memória.
 *
 * Composição (PDF §3; `invariantes.ts#COMPOSICAO`): quatro publicáveis (portal,
 * TV, jornal, blog), duas antigas (rádio de 2018, mural de 2017) e dois avisos
 * sem confirmação (a mensagem sem autoria, o post sem fonte). Entre as
 * publicáveis e entre as não publicáveis há meio tradicional E digital — e
 * imagem —, então nem o meio nem a beleza carregam a resposta.
 */

export const TEMA_PADRAO = "Feira de Ciências e Notícias da Cidade";

/** O componente do banco padrão: ele não é de uma disciplina só. */
export const DISCIPLINA_PADRAO = "Projeto interdisciplinar";

/**
 * As oito notícias do banco padrão, NA ORDEM DA MESA (os ids são a posição).
 * A ordem mistura os papéis de propósito: as publicáveis não vêm juntas.
 */
export const NOTICIAS_PADRAO: readonly NoticiaDoPacote[] = [
  {
    id: "n1",
    meio: "portal",
    veiculo: "Portal da Educação da Cidade",
    falante: null,
    manchete: "Feira de Ciências da escola abre inscrições para as turmas",
    resumo:
      "A Feira de Ciências acontece no próximo sábado, no pátio da escola. As turmas podem inscrever experimentos até sexta-feira, com a ajuda dos professores, na secretaria ou pelo portal.",
    corpo:
      "A Secretaria de Educação confirmou a Feira de Ciências da escola para o próximo sábado, das 9h às 13h, no pátio. Cada turma pode apresentar até dois experimentos. As inscrições vão até sexta-feira e são feitas com o professor de Ciências, na secretaria da escola ou pelo formulário do portal.",
    legenda: "Estudantes montam um vulcão de argila para a feira",
    descricaoImagem:
      "Ilustração de crianças de costas montando um vulcão de argila e um circuito com pilhas numa mesa do pátio da escola.",
    pistas: {
      fonte: "Portal da Educação da Cidade: canal oficial da Secretaria que cuida das escolas.",
      data: "Publicado ontem. A feira é no próximo sábado, das 9h às 13h.",
      autoria: "Texto assinado pela jornalista Marta Ribeiro, da equipe do portal.",
    },
    gabarito: {
      publicavel: true,
      pilarEmFalta: null,
      explicacao: "Canal oficial, publicado ontem e com autora identificada: a notícia pode ir para a capa.",
    },
    consequencia: {
      leitor: "Professor Marcos, de Ciências",
      fala: "Excelente informe! O local e a data estavam certinhos e deu tempo de inscrever a turma na feira!",
    },
  },
  {
    id: "n2",
    meio: "radio",
    veiculo: "Rádio Comunitária Onda Azul",
    falante: "Locutor Beto Lima",
    manchete: "Oficina de robôs solares com medalhas neste sábado",
    resumo:
      "O locutor da rádio do bairro anuncia uma oficina de robótica no pátio da escola neste sábado, com robôs movidos a luz do sol, medalhas e balões para todas as crianças.",
    corpo:
      "Bom dia, ouvintes! Neste sábado tem oficina de robótica no pátio da escola! A criançada vai montar robôs que andam com a luz do sol, ganhar medalhas e soltar balões coloridos. É só chegar às nove horas. Não percam!",
    legenda: "Robôs solares coloridos na oficina de robótica",
    descricaoImagem:
      "Ilustração vibrante de crianças de costas montando robôs solares coloridos, com medalhas douradas e balões no pátio da escola.",
    pistas: {
      fonte: "Rádio Comunitária Onda Azul, do bairro, lendo o boletim da coordenação da escola.",
      data: "O boletim foi gravado em maio de 2018, há mais de oito anos.",
      autoria: "Lido pelo locutor Beto Lima, que apresenta o programa da manhã.",
    },
    gabarito: {
      publicavel: false,
      pilarEmFalta: "data",
      explicacao:
        "A oficina existiu, mas foi em maio de 2018. O boletim antigo foi repetido como se fosse um aviso de hoje.",
    },
    consequencia: {
      leitor: "Família do Davi, no portão",
      fala: "Chegamos arrumados no sábado e o vigia avisou que essa oficina de robótica aconteceu em 2018!",
    },
  },
  {
    id: "n3",
    meio: "mensagem",
    veiculo: "Grupo Famílias da Escola",
    falante: "Contato sem nome",
    manchete: "Mensagem avisa corte de água na escola amanhã",
    resumo:
      "Uma mensagem encaminhada no grupo das famílias diz que a água da escola será cortada amanhã por causa de um vazamento e pede que todos repassem o aviso.",
    corpo:
      "URGENTE!!! Vão cortar a água da escola amanhã o dia inteiro por causa de um vazamento. Mandem as crianças com garrafas cheias e repassem para todos os grupos agora!",
    legenda: null,
    descricaoImagem: null,
    pistas: {
      fonte: "Não diz de onde veio: não tem link nem nome da escola ou da companhia de água.",
      data: "Não mostra quando foi escrita; chegou encaminhada muitas vezes.",
      autoria: "Ninguém assina a mensagem, e o nome de quem escreveu não aparece.",
    },
    gabarito: {
      publicavel: false,
      pilarEmFalta: "autoria",
      explicacao:
        "Ninguém se responsabiliza pelo aviso, e ele também não diz de onde veio. Sem quem assine, não há como publicar.",
    },
    consequencia: {
      leitor: "Dona Cida, da secretaria",
      fala: "A secretaria da escola parou de atender porque ninguém sabe quem inventou essa mensagem de corte de água!",
    },
  },
  {
    id: "n4",
    meio: "tv",
    veiculo: "TV Cidade",
    falante: "Repórter Paula Nogueira",
    manchete: "Planetário móvel chega à praça central na segunda",
    resumo:
      "Uma cúpula de planetário vai ficar montada na praça central por uma semana. As escolas podem agendar sessões gratuitas para as turmas pelo telefone da Secretaria de Cultura.",
    corpo:
      "A partir da próxima segunda-feira, um planetário móvel fica montado na praça central. Dentro da cúpula, as turmas assistem a uma sessão de vinte minutos sobre as estrelas e os planetas. A Secretaria de Cultura informou que as sessões são gratuitas e precisam de agendamento.",
    legenda: "Cúpula do planetário montada na praça central",
    descricaoImagem:
      "Ilustração de uma cúpula azul de planetário móvel numa praça arborizada, com uma fila de crianças vistas de costas.",
    pistas: {
      fonte: "TV Cidade, emissora de notícias da cidade, com entrevista da Secretaria de Cultura.",
      data: "Reportagem exibida ontem à noite; o planetário chega na próxima segunda.",
      autoria: "Reportagem da jornalista Paula Nogueira, com o nome dela no fim do vídeo.",
    },
    gabarito: {
      publicavel: true,
      pilarEmFalta: null,
      explicacao:
        "Emissora conhecida, reportagem de ontem, fonte oficial ouvida e repórter identificada: pode ir para a capa.",
    },
    consequencia: {
      leitor: "Professora Lúcia, do 4º ano",
      fala: "Que informe útil! Agendamos pelo telefone certo e a turma inteira visitou o planetário na praça!",
    },
  },
  {
    id: "n5",
    meio: "rede_social",
    veiculo: "@novidades_do_bairro",
    falante: null,
    manchete: "Tirolesa gigante e grátis no parque neste domingo",
    resumo:
      "Um post diz que o parque da cidade vai inaugurar uma tirolesa gigante neste domingo, com entrada grátis para as crianças, e já tem centenas de compartilhamentos no bairro.",
    corpo:
      "Gente, ouvi falar na padaria que o parque da cidade vai abrir uma tirolesa gigante neste domingo, de graça para as crianças! Não sei o horário, mas vai ser demais. Compartilhem!",
    legenda: "Imagem compartilhada no post sobre a tirolesa",
    descricaoImagem:
      "Ilustração colorida de uma tirolesa entre árvores altas de um parque, com uma faixa escrita GRÁTIS.",
    pistas: {
      fonte: "O post diz que ouviu falar na padaria; não cita o parque nem a prefeitura.",
      data: "Postado hoje de manhã, falando do domingo desta semana.",
      autoria: "Postado por Rafa Souza, morador do bairro, com o nome no perfil.",
    },
    gabarito: {
      publicavel: false,
      pilarEmFalta: "fonte",
      explicacao:
        "O autor e a data aparecem, mas o aviso não tem fonte: ninguém do parque ou da prefeitura confirmou a tirolesa.",
    },
    consequencia: {
      leitor: "Seu Jorge, pai da Bia",
      fala: "Levamos as crianças ao parque no domingo, mas lá ninguém tinha ouvido falar de tirolesa nenhuma!",
    },
  },
  {
    id: "n6",
    meio: "jornal",
    veiculo: "Gazeta do Bairro",
    falante: null,
    manchete: "Horta da escola chama famílias para mutirão de plantio",
    resumo:
      "A horta da escola vai ganhar novos canteiros de alface, cenoura e temperos. Famílias e estudantes estão convidados para um mutirão de plantio no sábado, às nove horas.",
    corpo:
      "A diretora da escola contou à Gazeta que a horta vai ganhar três canteiros novos. O mutirão de plantio é neste sábado, às nove horas, e cada família pode levar uma muda ou sementes. As verduras colhidas vão para a merenda.",
    legenda: "Canteiros da horta prontos para o mutirão",
    descricaoImagem:
      "Ilustração de canteiros de horta escolar com alfaces, regadores e placas de madeira com o nome de cada planta.",
    pistas: {
      fonte: "Gazeta do Bairro, jornal impresso da região, que entrevistou a diretora da escola.",
      data: "Edição impressa de ontem; o mutirão é neste sábado, às nove horas.",
      autoria: "Reportagem assinada por Caio Martins, repórter da Gazeta do Bairro.",
    },
    gabarito: {
      publicavel: true,
      pilarEmFalta: null,
      explicacao:
        "Jornal do bairro, edição de ontem, diretora entrevistada e repórter com nome: a notícia tem fonte, data e autoria.",
    },
    consequencia: {
      leitor: "Seu Antônio, avô da Júlia",
      fala: "A notícia estava certinha! Levei minhas mudas de manjericão no sábado e plantamos juntos na horta!",
    },
  },
  {
    id: "n7",
    meio: "mural",
    veiculo: "Mural do corredor da escola",
    falante: null,
    manchete: "Festa junina com quadrilha gigante na quadra",
    resumo:
      "Um cartaz no mural do corredor convida toda a escola para a festa junina na quadra, com quadrilha gigante, barracas de comida e concurso de fantasia caipira.",
    corpo:
      "Arraiá da Escola! Venha dançar a quadrilha gigante na quadra no dia 20 de junho, às 15 horas. Vai ter pipoca, milho verde, pescaria e concurso da melhor fantasia caipira. Traga a família!",
    legenda: "Cartaz da festa junina pregado no mural",
    descricaoImagem:
      "Cartaz colorido de festa junina com bandeirinhas, fogueira desenhada e crianças dançando quadrilha, vistas de longe.",
    pistas: {
      fonte: "Cartaz da direção da escola, com o carimbo oficial da secretaria.",
      data: "O cartaz é de junho de 2017 e ficou pregado no mural até hoje.",
      autoria: "Assinado pela diretora da escola, no rodapé do cartaz.",
    },
    gabarito: {
      publicavel: false,
      pilarEmFalta: "data",
      explicacao:
        "A festa aconteceu de verdade, mas em junho de 2017. Um cartaz antigo não serve como convite para hoje.",
    },
    consequencia: {
      leitor: "Enzo, do 3º ano",
      fala: "Fui fantasiado de caipira para a quadra e descobri que essa festa junina foi em 2017!",
    },
  },
  {
    id: "n8",
    meio: "blog",
    veiculo: "Blog da Biblioteca da Escola",
    falante: null,
    manchete: "Ônibus leva as turmas ao Museu de Ciências na quinta",
    resumo:
      "A coordenação confirmou o passeio de ônibus ao Museu de Ciências nesta quinta-feira. As autorizações assinadas pelas famílias precisam ser entregues na biblioteca até terça-feira, às 17 horas.",
    corpo:
      "Oi, turma! A coordenação confirmou: o ônibus sai da escola nesta quinta-feira, às 8 horas, para o Museu de Ciências, e volta antes do almoço. Quem ainda não entregou a autorização assinada pode deixar aqui na biblioteca até terça-feira.",
    legenda: null,
    descricaoImagem: null,
    pistas: {
      fonte: "A coordenação da escola confirmou o passeio no blog, com o horário do ônibus.",
      data: "Publicado nesta segunda-feira; o passeio é na quinta-feira desta semana.",
      autoria: "Texto da bibliotecária Rosa Almeida, que assina todas as postagens do blog.",
    },
    gabarito: {
      publicavel: true,
      pilarEmFalta: null,
      explicacao:
        "Blog da própria escola, post desta semana, coordenação confirmando e bibliotecária que assina: dá para publicar.",
    },
    consequencia: {
      leitor: "Coordenadora Regina",
      fala: "Ótimo aviso! As autorizações chegaram no dia certo e o ônibus saiu cheio para o museu!",
    },
  },
];

/** Uma cópia profunda do banco padrão — quem recebe pode editar sem tocar no catálogo. */
export function noticiasPadrao(): NoticiaDoPacote[] {
  return NOTICIAS_PADRAO.map((n) => ({
    ...n,
    pistas: { ...n.pistas },
    gabarito: { ...n.gabarito },
    consequencia: { ...n.consequencia },
  }));
}

/**
 * Os seis blocos da Chave do Editor: os três pilares com o rótulo e a legenda
 * da copy revisada (`e5.rotulo.bloco_*`, `e5.ui.legenda_*`) e três ISCAS no
 * mesmo tom — os critérios da aposta ingênua ("fotos mais chamativas e avisos
 * mais urgentes", e o "quantos colegas já receberam" da P1).
 *
 * O rótulo vai SEM o emoji da copy (🏛️ 📅 ✍️), nos seis: o ícone é da
 * experiência, pelo id. Com o emoji só nos pilares, a forma do bloco
 * denunciaria a isca — a mesma razão de a imagem antiga não poder parecer
 * velha (brief §3.1). E vai em CAIXA NORMAL, não em "FONTE": a caixa alta é
 * do CSS do `PuzzleBlock`, e escrita em maiúsculas o leitor de tela soletra.
 */
export const BLOCOS_DA_CHAVE: Readonly<Record<IdDeBloco, { rotulo: string; legenda: string }>> = {
  fonte: { rotulo: "Fonte", legenda: "De onde veio? É canal oficial ou confiável?" },
  data: { rotulo: "Data", legenda: "Quando aconteceu? É de hoje ou do passado?" },
  autoria: { rotulo: "Autoria", legenda: "Quem assina? Alguém se responsabiliza pelo texto?" },
  foto: { rotulo: "Foto", legenda: "Tem foto bonita? Chama a atenção de quem vê?" },
  urgencia: { rotulo: "Urgência", legenda: "Diz que é urgente? Pede pressa para espalhar?" },
  compartilhada: { rotulo: "Compartilhada", legenda: "Muita gente já mandou? Está em todos os grupos?" },
};

/** É pilar (fonte, data, autoria) ou isca? Só o professor recebe isto (`GET professor/material`). */
export function ehPilar(id: IdDeBloco): boolean {
  return (TIPOS_DE_PISTA as readonly string[]).includes(id);
}

/** Os seis blocos, na ordem canônica, com o `pilar` — o material do professor. */
export function blocosDoProfessor(): Array<{ id: IdDeBloco; rotulo: string; legenda: string; pilar: boolean }> {
  return IDS_DE_BLOCO.map((id) => ({ id, ...BLOCOS_DA_CHAVE[id], pilar: ehPilar(id) }));
}

/**
 * O roteiro oral da mediação (copy revisada §4b), para o professor ler entre
 * o resultado e a revisão. VERBATIM, com UMA adaptação: a primeira pergunta
 * dizia "a notícia da grande festa com a foto colorida", e no banco padrão a
 * isca das famílias no portão é a oficina de robôs — "a grande festa" apontaria
 * para a festa junina, que é a outra antiga.
 */
export const ROTEIRO_DA_MEDIACAO = {
  gatilhoDoResultado:
    "Editores, parem as máquinas e olhem para a tela principal! Nossa primeira edição já chegou aos leitores da escola. Vamos ver o que eles disseram antes de abrirmos a mesa de revisão.",
  perguntas: [
    "Vejam como a notícia da oficina de robôs com a foto colorida parecia a melhor escolha... mas olhem os balões dos leitores: por que as famílias ficaram tão bravas no portão da escola?",
    "Como uma notícia pode estar bem escrita, com foto bonita, e mesmo assim estar completamente errada para o dia de hoje?",
    "Quais são as três perguntas que todo editor precisa fazer antes de apertar o botão de publicar?",
  ] as const,
  gatilhoDaRevisao:
    "Acabei de liberar nos aparelhos de vocês a ferramenta do Bento. Conectem os três pilares que descobrimos para destravar a nossa mesa de revisão e consertar o jornal!",
} as const;

/**
 * A curiosidade da espera (`e4.curiosidade.texto`), verbatim da copy. Ela NÃO
 * desce pela api — o contrato não tem campo para ela, e a experiência a tem na
 * própria copy. Fica aqui como a fonte que a régua de termos confere
 * (`tests/jornal-escola-regras.spec.ts`), junto do resto do que a criança lê.
 */
export const CURIOSIDADE_DA_ESPERA =
  "O primeiro jornal impresso escolar do Brasil foi feito por estudantes há mais de cem anos!";
