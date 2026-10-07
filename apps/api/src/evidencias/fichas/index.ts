import { FICHA_EXP02EM1B } from "./exp02em1b";
import { FICHA_EXP04EF1B } from "./exp04ef1b";
import { FICHA_EXP05EF1B } from "./exp05ef1b";
import { FICHA_EXP06EF1B } from "./exp06ef1b";
import { FICHA_EXP07EF1B } from "./exp07ef1b";
import type { FichaPedagogica } from "./tipos";

export type { FichaPedagogica, HabilidadeDaFicha, MarcadorDaFicha, PerguntaDaFicha } from "./tipos";

/**
 * O REGISTRO DAS FICHAS — uma por missão, estático, no código.
 *
 * A plataforma da evidência entrou antes de qualquer missão medir alguma coisa;
 * a primeira foi Quem Mandou Isso? v2.2 (exp05ef1b), a segunda A Seleção
 * (exp07ef1b) a terceira o Jornal da Escola (exp04ef1b), a quarta O Júri Estadual de Projetos (exp06ef1b) e a Missão Tempestade (exp02em1b), a primeira do EM e a única que só conta ao encerrar (ADR-154). Cada missão que for adaptada acrescenta a ficha dela aqui (um
 * arquivo `fichas/<expId>.ts`), no MESMO trabalho que faz a missão chamar
 * `EvidenciasService.marcar` e `registrarContexto`.
 *
 * No código, e não numa tabela, pela mesma razão de
 * `equipes/regras.ts#EXPERIENCIAS_COM_EQUIPE`: "esta ação mede a EF08CO05" é
 * propriedade do DESENHO da missão, versionada junto com ela — e o gabarito das
 * perguntas não pode ficar num lugar que uma tela edita sem revisão.
 *
 * `tests/evidencias-fichas.spec.ts` confere cada ficha daqui: os códigos
 * existem na BNCC, o `expId` existe nos manifestos, o gabarito só usa níveis
 * válidos e todo marcador de pergunta aponta para uma pergunta que existe.
 */
export const FICHAS: readonly FichaPedagogica[] = [
  FICHA_EXP05EF1B,
  FICHA_EXP07EF1B,
  FICHA_EXP04EF1B,
  FICHA_EXP06EF1B,
  FICHA_EXP02EM1B,
];
