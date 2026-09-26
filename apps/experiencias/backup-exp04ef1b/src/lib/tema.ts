/**
 * Aparência clara/escura do UnooTube.
 *
 * A 0.1.14 do DS publica os DOIS modos da seção Unootube (antes só o escuro),
 * cada um atrás de um seletor: `[data-uni-theme=light|dark]` no clone e a
 * classe `.unooria-theme-dark` na seção da plataforma — que é a que desenha o
 * ranking. Por isso a troca escreve nos dois lugares ao mesmo tempo: sem a
 * classe, o estudante escolhe escuro no feed e a virada do ranking volta branca.
 *
 * A escolha é lembrada em `localStorage`. Isso NÃO fere a regra do CLAUDE.md,
 * que proíbe `localStorage` para TOKEN — aqui é preferência de tela, sem valor
 * de segurança. O acesso vai em try/catch porque o armazenamento pode estar
 * bloqueado (janela anônima, terceiros bloqueados) e nesse caso a experiência
 * simplesmente abre no padrão em vez de quebrar no boot.
 */
export type Aparencia = "claro" | "escuro";

const CHAVE = "unootube:aparencia";

/** Claro é o padrão: é o que o estudante já via antes desta migração. */
export const APARENCIA_PADRAO: Aparencia = "claro";

export function lerAparencia(): Aparencia {
  try {
    return window.localStorage.getItem(CHAVE) === "escuro" ? "escuro" : APARENCIA_PADRAO;
  } catch {
    return APARENCIA_PADRAO;
  }
}

export function guardarAparencia(aparencia: Aparencia): void {
  try {
    window.localStorage.setItem(CHAVE, aparencia);
  } catch {
    // Armazenamento indisponível: a escolha vale só para esta sessão.
  }
}

/** Escreve nos dois seletores de tema — o do clone e o da plataforma. */
export function aplicarAparencia(aparencia: Aparencia): void {
  const raiz = document.documentElement;
  raiz.dataset.uniTheme = aparencia === "escuro" ? "dark" : "light";
  raiz.classList.toggle("unooria-theme-dark", aparencia === "escuro");
}
