/**
 * O contrato da exp09ef1b como o cliente o vê — espelho de
 * `apps/api/src/dossie-invisivel/contrato-de-rotas.ts#SessaoSchema`, só com o
 * que a TELA lê. O gabarito (o certo do protocolo, a régua das habilidades, os
 * cadernos antes da digitalização) nunca aparece aqui: é segredo de servidor
 * (regra 3), e o bundle é público. `espelho.test.ts` lê a api e reprova a
 * divergência nas listas.
 */

export const EXP_ID = "exp09ef1b";

/** A versão vive em TRÊS lugares: aqui, no `package.json` e no `public/experiencia.json` (`versao.test.ts`). */
export const EXP_VERSION = "0.1.3";

export const PASSOS = ["abertura", "conversa", "espera1", "revelacao", "espera2", "explicar", "concluida"] as const;
export type Passo = (typeof PASSOS)[number];

export const PROJETOS = ["papel", "parcial", "nuvem"] as const;
export type ProjetoId = (typeof PROJETOS)[number];

export const CRITERIOS = ["regularidade", "urgencia", "capacidade"] as const;
export type Criterio = (typeof CRITERIOS)[number];

export const PILULAS = ["custo", "assinaturas"] as const;
export type PilulaId = (typeof PILULAS)[number];

export const ANCORAS = ["contraste", "parecer-inicial", "inversao"] as const;
export type AncoraId = (typeof ANCORAS)[number];

export type BlocoId = "auditar-fontes" | "normalizar-impacto" | "sinalizar-pendencias" | "desclassificar-sem-pdf";
export type EtapaDoGate = "exploracao" | "revelacao" | "revoto" | "explicar";
export type Caminho = "A1" | "A2" | "B";

export interface Mensagem {
  id: string;
  autor: "estudante" | "assistente" | "sistema";
  texto: string;
  ancora: AncoraId | null;
  anexos: string[];
}

export interface DecisaoGravada {
  projeto: ProjetoId;
  ranking: Criterio[];
  em: string;
}

export interface LinhaDaTabela {
  projeto: ProjetoId;
  nome: string;
  rotulo: string;
  documentos: string;
  vagas: string;
  custo: string;
}

export interface Documento {
  arquivo: string;
  resumo: string;
}

export interface ProjetoNaTela {
  id: ProjetoId;
  nome: string;
  coordenador: string;
  idade: number;
  vagas: number;
  custoPorVaga: number;
  card: string;
  area: string;
  documentos: Documento[];
}

export interface Sessao {
  preparada: boolean;
  atividade: { pacoteId: string; rodada: number } | null;
  etapaDaTurma: EtapaDoGate | null;
  passo: Passo;
  revotoAberto: boolean;
  chat: {
    mensagens: Mensagem[];
    consultas: number;
    podeEscolher: boolean;
    limiteAtingido: boolean;
    sugestoesVisiveis: boolean;
    cadernosOferecidos: boolean;
    cadernosDigitalizados: boolean;
  };
  ordemDosCriterios: Criterio[];
  decisao: DecisaoGravada | null;
  caminho: Caminho | null;
  revelacao: {
    comparado: ProjetoId;
    contrafactual: string | null;
    tabela: LinhaDaTabela[];
    constatacao: string;
    pilulas: PilulaId[];
  } | null;
  revoto: (DecisaoGravada & { manteve: boolean }) | null;
  explicar: { falaDeAmara: string; ancoras: AncoraId[] } | null;
  protocolo: {
    banco: BlocoId[];
    enviado: { slots: (BlocoId | null)[]; descarte: BlocoId[]; em: string } | null;
  } | null;
  concluido: boolean;
  conteudo: {
    projetos: ProjetoNaTela[];
    cadernos: { arquivo: string; amostras: string[]; resumo: string } | null;
  } | null;
  textos: {
    tela: Record<string, string>;
    amara: string;
    conceitos: { termo: string; definicao: string }[];
    conceitosResumo: string;
    sugestoes: string[];
    criterios: Record<Criterio, string>;
    blocos: Record<BlocoId, string>;
    pilulas: Record<PilulaId, string>;
  };
}
