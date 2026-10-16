import { embaralhar, type Nivel } from '../../evidencias/regras';
import { lista, nomeDoBairro, ORDEM_DO_MAPA } from './canal-a';

/**
 * O ALERTA para os bairros sem equipe, no registro da operação (EM13CO24,
 * ADR-172). PURO.
 *
 * Três partes, quatro opções em cada uma: a certa, duas erradas extremas e uma
 * errada MODERADA — para a certa não ser sempre "a do meio". Frequência e tom
 * pesam na saúde mental de quem recebe (pânico, cansaço de alerta, aflição que
 * não termina); o conteúdo, na física.
 *
 * | Partes certas | Nível |
 * | --- | --- |
 * | 3 | demonstra |
 * | 2 | em desenvolvimento |
 * | 0 ou 1 | não demonstra |
 * | não montou | sem marca |
 *
 * 64 combinações: 1 demonstra, 9 em desenvolvimento, 54 não demonstra.
 *
 * O CANAL não entra: alcançar quem não tem celular é acessibilidade (EM13CO15).
 * O alcance do alerta aparece só no painel do professor (`ALCANCE_DO_ALERTA`),
 * porque mostrá-lo ao grupo adiantaria a falha da fonte "sinal de celular".
 */
export const PARTES_DO_ALERTA = [
  {
    id: 'frequencia',
    titulo: 'Com que frequência',
    opcoes: [
      { id: 'agora-e-ao-passar', texto: 'Um aviso agora e outro quando o perigo passar', certa: true },
      { id: 'cinco-minutos', texto: 'Um aviso a cada cinco minutos até a chuva parar', certa: false },
      { id: 'so-se-piorar', texto: 'Nenhum aviso agora, só se a chuva piorar muito', certa: false },
      { id: 'so-agora', texto: 'Um aviso agora e nenhum outro depois disso', certa: false },
    ],
  },
  {
    id: 'tom',
    titulo: 'Em que tom',
    opcoes: [
      { id: 'calmo', texto: 'Calmo e direto: o que acontece e o que fazer', certa: true },
      { id: 'assustador', texto: 'Assustador, para ninguém ignorar: PERIGO! PERIGO!', certa: false },
      { id: 'tranquilizador', texto: 'Tranquilo: provavelmente não vai acontecer nada', certa: false },
      { id: 'tecnico', texto: 'Técnico, com as palavras do boletim oficial', certa: false },
    ],
  },
  {
    id: 'conteudo',
    titulo: 'O que o alerta diz',
    opcoes: [
      { id: 'abrigo', texto: 'Onde fica o abrigo mais perto e como chegar lá', certa: true },
      { id: 'milimetros', texto: 'Quantos milímetros de chuva estão previstos', certa: false },
      { id: 'link', texto: 'Um link para o site da prefeitura, com detalhes', certa: false },
      { id: 'cuidado', texto: 'Que a chuva vai ser forte e é bom ter cuidado', certa: false },
    ],
  },
] as const;

export type ParteDoAlerta = (typeof PARTES_DO_ALERTA)[number]['id'];
export type RespostasDoAlerta = Record<ParteDoAlerta, string>;

/** A frase fixa do painel do professor, para o debate (nunca para o grupo). */
export const ALCANCE_DO_ALERTA =
  'O aviso no celular não chega a quem não tem aparelho: é a mesma gente que o sinal de celular não conta.';

/** Os bairros que ficaram sem equipe, na ordem do mapa. */
export function bairrosSemEquipe(alocacao: { alfa: string | null; bravo: string | null }): string[] {
  return ORDEM_DO_MAPA.filter((b) => b !== alocacao.alfa && b !== alocacao.bravo);
}

/** O enunciado: "Vale Verde e Industrial ficaram sem equipe. …". */
export function enunciadoDoAlerta(semEquipe: readonly string[]): string {
  const nomes = lista(semEquipe.map(nomeDoBairro));
  const verbo = semEquipe.length === 1 ? 'ficou' : 'ficaram';
  return `${nomes} ${verbo} sem equipe. O sistema vai mandar um alerta para os celulares de quem está lá. Monte o alerta.`;
}

/** A APRESENTAÇÃO: a ordem embaralhada de cada parte, que vai gravada. */
export function montarAlerta(semEquipe: readonly string[], aleatorio: () => number) {
  return {
    enunciado: enunciadoDoAlerta(semEquipe),
    partes: PARTES_DO_ALERTA.map((p) => ({
      id: p.id,
      titulo: p.titulo,
      ordem: embaralhar(
        p.opcoes.map((o) => o.id),
        aleatorio,
      ),
    })),
  };
}

export function respostaDoAlertaValida(r: Record<string, string>): r is RespostasDoAlerta {
  return PARTES_DO_ALERTA.every((p) => p.opcoes.some((o) => o.id === r[p.id]));
}

export function partesCertas(r: RespostasDoAlerta): number {
  return PARTES_DO_ALERTA.filter((p) => p.opcoes.find((o) => o.id === r[p.id])?.certa).length;
}

export function nivelDoAlerta(r: RespostasDoAlerta): Nivel {
  const certas = partesCertas(r);
  if (certas === 3) return 'atingiu';
  if (certas === 2) return 'em_processo';
  return 'nao_atingiu';
}

/** O texto de uma opção, para o relatório do professor. */
export function textoDaOpcaoDoAlerta(parte: string, opcao: string): string | null {
  return PARTES_DO_ALERTA.find((p) => p.id === parte)?.opcoes.find((o) => o.id === opcao)?.texto ?? null;
}
