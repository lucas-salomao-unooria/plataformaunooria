/**
 * Porte de `lib/gemini/imagem.ts` — SÓ o builder do prompt. A geração dos bytes
 * vive no provider (`AiProvider.generateImage`) e a conversão webp 4:5 + a
 * gravação/URL pública viraram responsabilidade do `AssetsService`
 * (`salvarImagemDePost`) — o filesystem local do origem não existe no Cloud Run.
 */

/** Prompt de imagem do doc 05 §2 (etapa 3), com o estilo travado por atividade. */
export function promptDeImagem(estiloVisual: string, imageBrief: string): string {
  return [
    `${estiloVisual}.`,
    `${imageBrief}.`,
    "Sem texto, sem letras, sem números, sem logotipos, sem marcas d'água.",
    'Nada de fotorrealismo de pessoas contemporâneas identificáveis.',
    'Nenhuma violência gráfica: temas duros recebem tratamento simbólico e estilizado.',
    'Adequado a adolescentes. Proporção 4:5, composição vertical.',
  ].join(' ');
}
