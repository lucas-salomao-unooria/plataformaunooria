# Figuras externas

**Vazio de propósito.** Todo diagrama deste documento é vetorial, desenhado
nativamente em TikZ (`preambulo/diagramas.tex`) — não há imagem rasterizada de
diagrama em lugar nenhum, e a fonte Mermaid equivalente de cada figura está no
Apêndice A.

Esta pasta existe para imagem externa que um dia seja necessária. Duas regras:

- **Asset de marca não entra no git.** O logotipo institucional vive no bucket de
  assets do contrato, não aqui — pela mesma razão que a mídia pesada das
  experiências não entra: `.gitignore` cobre `>2MB`, e binário de marca muda por
  decisão que não é de engenharia. A capa usa assinatura **tipográfica**
  (`preambulo/capa.tex`), que não depende de arquivo.
- **Diagrama novo nasce em TikZ**, não como PNG exportado de outra ferramenta.
  PNG de diagrama envelhece sem ninguém notar: o texto não é pesquisável, a
  tipografia diverge do documento, e quem precisa corrigir uma seta não tem a
  fonte.
