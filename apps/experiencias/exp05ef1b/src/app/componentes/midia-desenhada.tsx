import { dividirLegenda, percentualDaBarra } from "../../lib/regras";
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
 * no `alt` de quem usa. A cor sai só dos tokens `--wa-*` (ver `globals.css`,
 * seção "mídia desenhada").
 */

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
