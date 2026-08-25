/**
 * Exportação para Word — porte de `app/api/exportar-docx/route.ts` do app
 * origem para o CLIENTE: o arquivo é um HTML com os namespaces do MS Office
 * (o Word abre como documento), não um DOCX (zip). Não precisa de servidor
 * nem de lib; DOCX "de verdade" só se um cliente reclamar.
 *
 * Word não resolve CSS variables, então as cores vão como literais — todas
 * valores de token do @unooria/design-system:
 *   #22272A neutral-950 · #3D4448 neutral-800 · #383E41 neutral-900
 *   #475157 neutral-700 · #536167 neutral-600 · #CBD4D6 neutral-200
 *   #E4E8E9 neutral-150 · #F5F5F5 neutral-100 · #BDD0EF brandnavy-300
 */
export function montarDocumentoDoc(html: string): string {
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <style>
    @page Section1 { size: 21cm 29.7cm; margin: 2cm; mso-page-orientation: portrait; }
    div.Section1 { page: Section1; }
    body { font-family: 'Segoe UI', 'Open Sans', 'Calibri', Arial, sans-serif; font-size: 12pt; line-height: 1.5; color: #475157; margin: 0; }
    h1 { font-size: 18pt; font-weight: bold; color: #22272A; margin-top: 24pt; margin-bottom: 9pt; }
    h2 { font-size: 15pt; font-weight: 600; color: #383E41; margin-top: 18pt; margin-bottom: 6pt; }
    h3 { font-size: 13.5pt; font-weight: 600; color: #3D4448; margin-top: 12pt; margin-bottom: 6pt; }
    p { font-size: 12pt; color: #475157; margin-bottom: 9pt; line-height: 1.5; }
    ul, ol { margin-bottom: 9pt; padding-left: 18pt; }
    li { font-size: 12pt; color: #475157; margin-bottom: 3pt; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 12pt; }
    th, td { border: 1pt solid #CBD4D6; padding: 6pt 9pt; text-align: left; font-size: 10.5pt; }
    th { background-color: #F5F5F5; font-weight: 600; }
    blockquote { border-left: 3pt solid #BDD0EF; padding-left: 12pt; color: #536167; font-style: italic; margin: 12pt 0; }
    hr { border: none; border-top: 1pt solid #E4E8E9; margin: 18pt 0; }
    strong { font-weight: 600; }
    em { font-style: italic; }
  </style>
</head>
<body>
<div class="Section1">
${html}
</div>
</body>
</html>`;
}

/** Nome de arquivo seguro: só letras (com acento), dígitos, `_` e `-`. */
export function nomeDoArquivo(titulo: string): string {
  const limpo = titulo
    .replace(/[^a-zA-Z0-9À-ÿºª\s_-]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  return `${limpo || "Plano_de_Aula"}.doc`;
}

/** Dispara o download no navegador. */
export function baixarDoc(html: string, titulo: string): void {
  const blob = new Blob([montarDocumentoDoc(html)], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeDoArquivo(titulo);
  a.click();
  URL.revokeObjectURL(url);
}
