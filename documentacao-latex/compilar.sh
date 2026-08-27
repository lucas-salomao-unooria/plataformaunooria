#!/usr/bin/env bash
# ============================================================================
#  compilar.sh — build da documentacao tecnica da Plataforma Unooria
#
#  Motor preferido: TECTONIC. Ele baixa os pacotes de que precisa sob demanda
#  (nao exige distribuicao de TeX instalada) e chama o BibTeX sozinho, fechando
#  o ciclo de referencias sem ferramenta externa. E o motivo de a bibliografia
#  usar `abntex2cite` + BibTeX em vez de biblatex + biber: o biber e um binario
#  separado que o Tectonic nao empacota, e as versoes de biblatex/biber tem de
#  casar exatamente.
#
#  Fallback: qualquer distribuicao com `pdflatex` + `bibtex`, ou `latexmk`.
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")"

RAPIDO=0
LIMPAR=0
for arg in "$@"; do
  case "$arg" in
    -r|--rapido) RAPIDO=1 ;;
    -l|--limpar) LIMPAR=1 ;;
    -h|--help)
      cat <<'AJUDA'
Uso: ./compilar.sh [opcoes]

  (sem opcao)      build completo
  -r, --rapido     uma passagem, para iterar na escrita
  -l, --limpar     remove os arquivos auxiliares e sai
  -h, --help       esta mensagem
AJUDA
      exit 0 ;;
    *) echo "opcao desconhecida: $arg (use --help)" >&2; exit 2 ;;
  esac
done

AUXILIARES=(main.aux main.bbl main.blg main.log main.lof main.lot main.out
            main.toc main.bcf main.run.xml main.fls main.fdb_latexmk)

if [ "$LIMPAR" = 1 ]; then
  rm -f "${AUXILIARES[@]}"
  rm -rf build/*.png
  echo "auxiliares removidos"
  exit 0
fi

if command -v tectonic >/dev/null 2>&1; then
  # `-k` mantem .aux/.toc/.lof/.bbl em disco. Sem ele o Tectonic guarda os
  # auxiliares SO na memoria e os arquivos no diretorio ficam desatualizados —
  # o PDF sai correto, mas inspecionar main.toc engana quem for depurar.
  if [ "$RAPIDO" = 1 ]; then
    echo "==> tectonic (rapido: 1 passagem, sem bibliografia)"
    tectonic -k --reruns 0 main.tex
  else
    echo "==> tectonic (completo)"
    tectonic -k main.tex
  fi
elif command -v latexmk >/dev/null 2>&1; then
  echo "==> latexmk"
  latexmk -pdf -bibtex main.tex
elif command -v pdflatex >/dev/null 2>&1; then
  echo "==> pdflatex + bibtex (4 passagens)"
  pdflatex -interaction=nonstopmode main.tex
  if [ "$RAPIDO" = 0 ]; then
    bibtex main || true
    pdflatex -interaction=nonstopmode main.tex
    pdflatex -interaction=nonstopmode main.tex
  fi
else
  echo "ERRO: nenhum motor encontrado. Instale o tectonic:" >&2
  echo "  brew install tectonic        # macOS" >&2
  echo "  cargo install tectonic       # qualquer plataforma" >&2
  exit 1
fi

if [ ! -f main.pdf ]; then
  echo "ERRO: main.pdf nao foi gerado" >&2
  exit 1
fi

PAGINAS="?"
if command -v pdfinfo >/dev/null 2>&1; then
  PAGINAS=$(pdfinfo main.pdf | awk '/^Pages:/ { print $2 }')
fi
echo "==> main.pdf pronto — ${PAGINAS} paginas, $(du -h main.pdf | cut -f1)"

# Referencias cruzadas pendentes: a primeira passagem sempre deixa algumas, e
# elas so estabilizam depois do BibTeX + rerun. Se sobrarem aqui, e erro real.
if [ "$RAPIDO" = 0 ] && [ -f main.log ] && grep -q "There were undefined references" main.log; then
  echo "AVISO: ha referencias cruzadas nao resolvidas — rode de novo" >&2
fi
