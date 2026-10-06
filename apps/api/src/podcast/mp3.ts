/**
 * EMENDAR MP3s — os trechos do podcast viram um arquivo só, sem ffmpeg
 * (não há ffmpeg neste repositório, `ai/AGENTS.md`). Função pura; o teste monta
 * quadros sintéticos.
 *
 * MP3 é uma fila de QUADROS independentes, e dois fluxos com o mesmo formato
 * (a síntese devolve sempre o mesmo: MPEG-2 camada III, taxa constante) tocam
 * emendados byte a byte. O que atrapalha são três coisas que cada arquivo traz
 * NA PONTA, e que valem só para ele:
 *
 * - a etiqueta ID3v2 no começo e a ID3v1 ("TAG") nos últimos 128 bytes;
 * - o quadro "Xing"/"Info" (ou "VBRI") logo no início, que declara a DURAÇÃO
 *   daquele arquivo: deixado no meio do episódio, o navegador leria a duração
 *   do primeiro trecho como a do episódio inteiro e a barra de posição mentiria.
 *
 * Sem o quadro de duração, o navegador calcula a duração pela taxa constante e
 * pelo tamanho — o certo para o episódio emendado.
 */

/** Taxas de bits da camada III, em kbit/s, pelo índice do cabeçalho. */
const TAXAS_MPEG1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const TAXAS_MPEG2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];

/** Frequências de amostragem, pelo índice do cabeçalho, por versão (3 = MPEG-1, 2 = MPEG-2, 0 = MPEG-2.5). */
const AMOSTRAGENS: Record<number, number[]> = {
  3: [44100, 48000, 32000],
  2: [22050, 24000, 16000],
  0: [11025, 12000, 8000],
};

/** O tamanho do quadro de camada III que começa em `pos`, ou `null` se não há cabeçalho válido ali. */
export function tamanhoDoQuadro(bytes: Buffer, pos: number): number | null {
  if (pos + 4 > bytes.length) return null;
  const b0 = bytes[pos] as number;
  const b1 = bytes[pos + 1] as number;
  const b2 = bytes[pos + 2] as number;
  if (b0 !== 0xff || (b1 & 0xe0) !== 0xe0) return null;
  const versao = (b1 >> 3) & 0x03;
  const camada = (b1 >> 1) & 0x03;
  if (versao === 1 || camada !== 1) return null; // versão reservada, ou não é camada III
  const taxa = (versao === 3 ? TAXAS_MPEG1 : TAXAS_MPEG2)[b2 >> 4] ?? 0;
  const amostragem = AMOSTRAGENS[versao]?.[(b2 >> 2) & 0x03];
  if (!taxa || !amostragem) return null;
  const preenchimento = (b2 >> 1) & 0x01;
  const coeficiente = versao === 3 ? 144 : 72;
  return Math.floor((coeficiente * taxa * 1000) / amostragem) + preenchimento;
}

/** Tira a ID3v2 do começo e a ID3v1 do fim. */
function semEtiquetas(bytes: Buffer): Buffer {
  let inicio = 0;
  if (bytes.length >= 10 && bytes.toString("latin1", 0, 3) === "ID3") {
    const tamanho =
      ((bytes[6] as number) << 21) | ((bytes[7] as number) << 14) | ((bytes[8] as number) << 7) | (bytes[9] as number);
    const temRodape = ((bytes[5] as number) & 0x10) !== 0;
    inicio = 10 + tamanho + (temRodape ? 10 : 0);
  }
  let fim = bytes.length;
  if (fim - inicio >= 128 && bytes.toString("latin1", fim - 128, fim - 125) === "TAG") fim -= 128;
  return bytes.subarray(inicio, fim);
}

/** Se o primeiro quadro é o de duração ("Xing", "Info" ou "VBRI"), o tamanho dele; senão 0. */
function quadroDeDuracao(bytes: Buffer, pos: number): number {
  const tamanho = tamanhoDoQuadro(bytes, pos);
  if (tamanho === null) return 0;
  const corpo = bytes.toString("latin1", pos + 4, Math.min(bytes.length, pos + Math.min(tamanho, 64)));
  return /Xing|Info|VBRI/.test(corpo) ? tamanho : 0;
}

/**
 * Emenda os trechos na ordem dada. Lança se um trecho não tem quadro de áudio
 * nenhum — melhor falhar a montagem do episódio do que publicar um arquivo que
 * o navegador recusa.
 */
export function concatenarMp3(partes: readonly Buffer[]): Buffer {
  const pedacos: Buffer[] = [];
  partes.forEach((parte, indice) => {
    const limpo = semEtiquetas(parte);
    let pos = 0;
    while (pos < limpo.length && tamanhoDoQuadro(limpo, pos) === null) pos += 1;
    if (pos >= limpo.length) throw new Error(`O trecho ${indice + 1} não tem quadro de MP3.`);
    pos += quadroDeDuracao(limpo, pos);
    pedacos.push(limpo.subarray(pos));
  });
  return Buffer.concat(pedacos);
}
