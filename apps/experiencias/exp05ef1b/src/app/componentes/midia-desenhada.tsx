import { dividirLegenda, percentualDaBarra, type EstiloDeImagem } from "../../lib/regras";
import { TEXTOS } from "../../lib/textos";

/**
 * O que vai DENTRO da moldura do `MessageBubble.Media` sem `src` — a mídia
 * DESENHADA que a 0.2.4 do DS passou a aceitar (`children` + `alt`).
 *
 * **Zero mídia binária, e é decisão de produto**: um comunicado por turma
 * gerado por IA é conteúdo que ninguém revisa como imagem, uma foto de aviso
 * escolar é PII de uma escola real, e a missão mede a leitura do TEXTO. Então o
 * "comunicado" é o próprio texto do pacote composto como papel, e o gráfico da
 * turma são duas barras.
 *
 * Nada aqui é CONTROLE: são desenhos estáticos dentro de uma moldura que o DS
 * marca como `role="img"` com o `alt` — por isso o texto desenhado está também
 * no `alt` de quem usa. A cor sai só dos tokens `--unc-*` (ver `globals.css`,
 * seção "mídia desenhada").
 */

/** A proporção da moldura de cada desenho: o cartaz é em pé, o print é quadrado. */
export const PROPORCAO_DO_DESENHO: Readonly<Record<EstiloDeImagem, string>> = {
  comunicado: "4 / 3",
  cartaz: "3 / 4",
  print: "1 / 1",
  bilhete: "4 / 3",
};

/** Uma imagem do grupo, no desenho que `estiloDaImagem` escolheu para ela. */
export function ImagemDesenhada({ legenda, estilo }: { legenda: string; estilo: EstiloDeImagem }) {
  if (estilo === "cartaz") return <CartazDesenhado legenda={legenda} />;
  if (estilo === "print") return <PrintDesenhado legenda={legenda} />;
  if (estilo === "bilhete") return <BilheteDesenhado legenda={legenda} />;
  return <ComunicadoDesenhado legenda={legenda} />;
}

/** Um cartaz de mural: faixa colorida, título grande e o aviso centralizado. */
function CartazDesenhado({ legenda }: { legenda: string }) {
  const { rotulo, corpo } = dividirLegenda(legenda);
  return (
    <div className="desenho-cartaz">
      <span className="desenho-cartaz__faixa" aria-hidden="true" />
      {rotulo && <p className="desenho-cartaz__titulo">{rotulo}</p>}
      <p className="desenho-cartaz__corpo">{corpo}</p>
      <span className="desenho-cartaz__estrelas" aria-hidden="true">
        ★ ★ ★
      </span>
    </div>
  );
}

/** Um print de tela de publicação: cabeçalho com avatar, texto e a barra de reações. */
function PrintDesenhado({ legenda }: { legenda: string }) {
  const { rotulo, corpo } = dividirLegenda(legenda);
  return (
    <div className="desenho-print">
      <div className="desenho-print__topo" aria-hidden="true">
        <span className="desenho-print__avatar" />
        <span className="desenho-print__nome" />
      </div>
      {rotulo && <p className="desenho-print__titulo">{rotulo}</p>}
      <p className="desenho-print__corpo">{corpo}</p>
      <div className="desenho-print__reacoes" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

/** Um bilhete à mão: papel pautado, margem e o texto inclinado. */
function BilheteDesenhado({ legenda }: { legenda: string }) {
  const { rotulo, corpo } = dividirLegenda(legenda);
  return (
    <div className="desenho-bilhete">
      {rotulo && <p className="desenho-bilhete__titulo">{rotulo}</p>}
      <p className="desenho-bilhete__corpo">{corpo}</p>
    </div>
  );
}

/** O comunicado de uma mensagem `imagem`: papel timbrado, cabeçalho, corpo, carimbo e assinatura. */
export function ComunicadoDesenhado({ legenda }: { legenda: string }) {
  const { rotulo, corpo } = dividirLegenda(legenda);
  return (
    <div className="desenho-comunicado">
      <div className="desenho-comunicado__timbre" aria-hidden="true" />
      {rotulo && <p className="desenho-comunicado__titulo">{rotulo}</p>}
      <p className="desenho-comunicado__corpo">{corpo}</p>
      <div className="desenho-comunicado__rodape" aria-hidden="true">
        <span className="desenho-comunicado__assinatura" />
        <span className="desenho-comunicado__carimbo" />
      </div>
    </div>
  );
}

/**
 * A lâmina da síntese (E5-ALU-01): as quatro embalagens da `frase` e o filtro
 * de checagem que elas desarmam. As palavras são as da própria frase da copy.
 */
export function LaminaDaSintese() {
  const s = TEXTOS.sintese;
  return (
    <div className="desenho-lamina">
      <p className="desenho-lamina__titulo">{s.titulo}</p>
      <div className="desenho-lamina__embalagens">
        {s.embalagens.map((e) => (
          <span key={e} className="desenho-lamina__embalagem">
            {e}
          </span>
        ))}
      </div>
      <span className="desenho-lamina__seta" aria-hidden="true">
        ↓
      </span>
      <span className="desenho-lamina__filtro">{s.filtro}</span>
    </div>
  );
}

/**
 * O resumo de duas barras da TURMA, na revelação (a sala sem projetor). As
 * contas são do servidor — por computador quando há equipe, sem nome nenhum —,
 * e os rótulos são os do telão do professor.
 */
export function TermometroDaTurma({
  falsaNeutra,
  verdadeiraEmocionalDescartada,
}: {
  falsaNeutra: number;
  verdadeiraEmocionalDescartada: number;
}) {
  const t = TEXTOS.revelacao.termometro;
  const barras = [
    { rotulo: t.falsaNeutra, valor: percentualDaBarra(falsaNeutra), legenda: t.falsaNeutraValor },
    {
      rotulo: t.verdadeiraEmocional,
      valor: percentualDaBarra(verdadeiraEmocionalDescartada),
      legenda: t.verdadeiraEmocionalValor,
    },
  ];
  return (
    <div className="desenho-termometro">
      <p className="desenho-termometro__titulo">{t.titulo}</p>
      {barras.map((b) => (
        <div key={b.rotulo} className="desenho-termometro__linha">
          <p className="desenho-termometro__rotulo">{b.rotulo}</p>
          <div className="desenho-termometro__trilho" aria-hidden="true">
            <span className="desenho-termometro__barra" style={{ width: `${b.valor}%` }} />
          </div>
          <p className="desenho-termometro__valor">{b.legenda(b.valor)}</p>
        </div>
      ))}
    </div>
  );
}

/** O texto alternativo do termômetro: as mesmas quatro frases, na ordem em que o desenho as mostra. */
export function altDoTermometro(falsaNeutra: number, verdadeiraEmocionalDescartada: number): string {
  const t = TEXTOS.revelacao.termometro;
  return [
    t.titulo,
    `${t.falsaNeutra}: ${t.falsaNeutraValor(percentualDaBarra(falsaNeutra))}`,
    `${t.verdadeiraEmocional}: ${t.verdadeiraEmocionalValor(percentualDaBarra(verdadeiraEmocionalDescartada))}`,
  ].join(". ");
}
