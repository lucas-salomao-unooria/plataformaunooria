import type { FichaPedagogica } from "./tipos";

export type { FichaPedagogica, HabilidadeDaFicha, MarcadorDaFicha, PerguntaDaFicha } from "./tipos";

/**
 * O REGISTRO DAS FICHAS — uma por missão, estático, no código.
 *
 * VAZIO nesta frente, de propósito: a plataforma da evidência entra antes de
 * qualquer missão medir alguma coisa. Cada missão que for adaptada acrescenta a
 * ficha dela aqui (um arquivo `fichas/<expId>.ts`), no MESMO trabalho que faz a
 * missão chamar `EvidenciasService.marcar`.
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
export const FICHAS: readonly FichaPedagogica[] = [];
