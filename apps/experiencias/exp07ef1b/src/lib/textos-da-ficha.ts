/**
 * A copy da FICHA TÉCNICA (E4-ALU-02) — a revelação.
 *
 * Mora num arquivo à parte, importado SÓ por `app/clone/ficha-tecnica.tsx`,
 * que entra por `React.lazy` quando a professora acende as fichas. Assim estas
 * palavras (e os nomes das três lentes) não viajam no chunk principal, legíveis
 * no DevTools antes da hora. O arquivo continua no bucket, que é público — o
 * cuidado é não ENTREGÁ-LO antes, não escondê-lo (o gabarito de cada post, que
 * é o que importa, só vem da api com `fichasReveladas`).
 *
 * Fonte: o sheet congelado (`design/06-copy-strings-revisada.md`).
 */
export const FICHA = {
  /** `e4.ui.btn_ver_detalhes` */
  verDetalhes: "Ver detalhes da postagem",
  /** `e4.ui.titulo_ficha` */
  titulo: "Ficha Técnica da Curadoria",
  /** `e4.feedback.label_fonte` */
  fonte: (tag: string) => `Fonte ouvida: ${tag}`,
  /** `e4.feedback.label_angulo` */
  angulo: (tag: string) => `Ângulo da imagem: ${tag}`,
  /** `e4.feedback.label_radar` */
  equilibrio: "Equilíbrio editorial da seleção",
  /** As três lentes, nos nomes do painel da professora (`prof.dash.distribuicao`). */
  lentes: { institucional: "Institucional", comunitario: "Comunitário", estatistico: "Estatístico" },
  /** `e4.instrucao.espera_etapa5` */
  esperaEtapa5: "Aguardando o professor liberar a próxima etapa...",
} as const;
