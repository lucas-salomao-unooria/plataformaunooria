/**
 * Parser CSV mínimo (RFC 4180): separador vírgula, aspas duplas para campos
 * com vírgula/quebra de linha, `""` como aspas escapada. Sem dependência —
 * o formato de entrada é nosso (documentado na tela de importação).
 */
export function parseCsv(texto: string): string[][] {
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let dentroDeAspas = false;

  const empurrarCampo = () => {
    linha.push(campo);
    campo = "";
  };
  const empurrarLinha = () => {
    empurrarCampo();
    // linha totalmente vazia (ex.: \n final) não vira registro
    if (linha.length > 1 || (linha[0] ?? "").trim() !== "") linhas.push(linha);
    linha = [];
  };

  const s = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto; // tira BOM
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (dentroDeAspas) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          campo += '"';
          i += 1;
        } else {
          dentroDeAspas = false;
        }
      } else {
        campo += c;
      }
    } else if (c === '"') {
      dentroDeAspas = true;
    } else if (c === ",") {
      empurrarCampo();
    } else if (c === "\n") {
      empurrarLinha();
    } else if (c === "\r") {
      // \r\n vira \n; \r solto idem
      if (s[i + 1] === "\n") i += 1;
      empurrarLinha();
    } else {
      campo += c;
    }
  }
  if (campo !== "" || linha.length > 0) empurrarLinha();
  return linhas;
}
