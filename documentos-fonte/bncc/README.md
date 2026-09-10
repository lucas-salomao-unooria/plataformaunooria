# documentos-fonte/bncc — os PDFs oficiais da Base

**Os PDFs NÃO são versionados** (regra do `AGENTS.md` da raiz: nada de binário
acima de 2 MB no git). O que está no repositório é o EXTRATO deles, em
`apps/api/src/curriculo/dados/*.ts`, gerado por `node scripts/extrair-bncc.mjs`.

Para reextrair, baixe os arquivos com estes nomes exatos:

| Arquivo esperado | O que é | Onde baixar |
|---|---|---|
| `bncc-completa-2018.pdf` | BNCC homologada (Educação Infantil + Fundamental + **Médio**), dez/2018, ~600 p. | `https://basenacionalcomum.mec.gov.br/images/BNCC_EI_EF_110518_versaofinal_site.pdf` |
| `bncc-computacao-2022.pdf` | Anexo ao Parecer CNE/CEB nº 2/2022 — Computação | `https://www.gov.br/mec/pt-br/cne/pdf/pareceres-do-cne/ceb/2022/anexo-ao-parecer-cneceb-no-2-2022-bncc-computacao.pdf` |

Depois: `node scripts/extrair-bncc.mjs` (exige `pdftotext` e `pdfinfo`, do
poppler — `brew install poppler`).

## A armadilha que já custou tempo: o rascunho do Ensino Médio

O nome do primeiro arquivo diz `EI_EF`, mas ele é a Base **completa** — traz as
183 habilidades do Ensino Médio no fim. Use só ele.

A página do Ensino Médio do próprio MEC serve um PDF de **11/05/2018**, anterior
à homologação, com 179 habilidades e **textos diferentes**. A `EM13MAT101` do
rascunho diz "Interpretar situações econômicas"; a homologada diz "Interpretar
**criticamente** situações econômicas, sociais **e fatos relativos** às Ciências
da Natureza". Um plano de ensino que cite a redação do rascunho está citando
norma que nunca vigorou — e num contrato B2G isso é apontamento de auditoria.

`curriculo.spec.ts` guarda esse caso: há um teste que falha se o texto de
`EM13MAT101` perder essas palavras.

## Temas Contemporâneos Transversais

Os cadernos de TCT (Saúde, Meio Ambiente, Economia) não são extraídos hoje — o
produto os menciona no prompt como articulação possível, sem base estruturada.
Se algum dia entrarem, entram como fonte própria: eles não têm código de
habilidade, e enfiá-los na mesma tabela faria parecer que têm.
