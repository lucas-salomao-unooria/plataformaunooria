import { FICHA_EXP01EM1B } from "./exp01em1b";
import { FICHA_EXP02EF1B } from "./exp02ef1b";
import { FICHA_EXP02EM1B } from "./exp02em1b";
import { FICHA_EXP02EM1B_V0 } from "./exp02em1b-v0";
import { FICHA_EXP03EF1B } from "./exp03ef1b";
import { FICHA_EXP03EM1B } from "./exp03em1b";
import { FICHA_EXP04EF1B } from "./exp04ef1b";
import { FICHA_EXP05EF1B } from "./exp05ef1b";
import { FICHA_EXP06EF1B } from "./exp06ef1b";
import { FICHA_EXP07EF1B } from "./exp07ef1b";
import { FICHA_EXP08EF1B } from "./exp08ef1b";
import type { FichaPedagogica } from "./tipos";

export type { FichaPedagogica, HabilidadeDaFicha, MarcadorDaFicha, PerguntaDaFicha } from "./tipos";

/**
 * O REGISTRO DAS FICHAS — uma por missão, estático, no código.
 *
 * A plataforma da evidência entrou antes de qualquer missão medir alguma coisa;
 * a primeira foi Quem Mandou Isso? v2.2 (exp05ef1b), a segunda A Seleção
 * (exp07ef1b), a terceira o Jornal da Escola (exp04ef1b), a quarta O Júri Estadual de Projetos (exp06ef1b) a quinta O Conteúdo que não chegou (exp08ef1b) e a sexta a Missão Tempestade (hoje `exp02em1b-v0`, a versão anterior da ADR-181), e a sétima O Efeito Amplificador (`exp02em1b`, ADR-181), só Canal A, a primeira do EM e a única que só conta ao encerrar (ADR-154), e a oitava O Enigma da Capa da Rádio (`exp02ef1b`, ADR-184), 100% Canal A, a primeira do 2º ano, e a nona O Assistente Invisível (`exp01em1b`, ADR-185), 100% Canal A, as quatro marcas no latch do Publicar, e a décima Nina e a Notícia que Desapareceu (`exp03ef1b`, ADR-197), 100% Canal A, a primeira do 3º ano, e a décima primeira O Porta-Voz dos Dados (`exp03em1b`, ADR-198), 100% Canal A, seis habilidades marcadas no Publicar, na decisão da errata e na perícia. Cada missão que for adaptada acrescenta a ficha dela aqui (um
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
  FICHA_EXP08EF1B,
  FICHA_EXP02EM1B_V0,
  FICHA_EXP02EM1B,
  FICHA_EXP02EF1B,
  FICHA_EXP01EM1B,
  FICHA_EXP03EF1B,
  FICHA_EXP03EM1B,
];
