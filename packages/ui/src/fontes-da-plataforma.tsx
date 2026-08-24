/**
 * Carrega as fontes do Design System da plataforma.
 *
 * Por que isto existe: o `unooria.css` do DS declara as duas fontes com
 * `@import` de URL remota na primeira linha — o jeito certo em CSS puro. Mas o
 * **Next remove `@import` externo** de CSS importado por JS, e o resultado é
 * silencioso: a regra `font-family: "Open Sans"` continua no CSS, o
 * `getComputedStyle` continua respondendo "Open Sans", e o navegador desenha com
 * a fonte de sistema porque nunca baixou nada. Zero requisição para
 * `fonts.gstatic.com`.
 *
 * O sintoma mais visível eram os ícones: `Material Symbols Rounded` é uma fonte
 * de ligaduras, então sem ela o `<span>material-symbols-rounded</span>` mostra o
 * NOME do ícone como texto — "addInvestigação", "checkResposta". Parecia bug do
 * componente; era a fonte faltando.
 *
 * Fica nas superfícies da PLATAFORMA (login, professor, admin, análise) e nunca
 * no aparelho do aluno: lá dentro a tipografia é a do Instanooria.
 */
export function FontesDaPlataforma() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
      />
    </>
  );
}
