import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeUnv,
  BottomSheetUnv,
  ButtonUnv,
  Chip,
  IconUnv,
  InlineHint,
  MediaGrid,
  SearchField,
  TopBar,
  type UnvMediaItem,
} from "@edu/ui/ds-unoovista";
import { casaComABusca, classificarBusca, comCerquilha, frasesDaLegenda } from "../../lib/regras";
import { E2, E3, E4 } from "../../lib/textos";
import {
  ACOES_DA_REVISAO,
  type AcaoDaGaleria,
  type AcaoDaRevisao,
  type Area,
  type Cartao,
  type Categoria,
  type Galeria as DadosDaGaleria,
  type MotivoDaRevisao,
  type ProjetoDaGaleria,
  type Voto,
} from "../../lib/tipos";
import { srcDoEstande, usePaleta } from "../componentes/midia";
import { Escolha } from "./escolha";

/** Quanto a digitação precisa parar para a busca valer como UMA busca (para a api). */
const PAUSA_DA_BUSCA_MS = 1_200;

/**
 * E4-ALU-02/03 — a Galeria Oculta: o AHA e o MEMORÁVEL na mesma tela.
 *
 * - **A taxa é a REAL desta sessão** (`GaleriaSchema.invisibilidade`, calculada
 *   no servidor sobre os posts que o feed serviu). Nada cravado: quem curtiu a
 *   mesma área duas vezes vê ~9 de 16; quem não interagiu, ~6. A grade tem o
 *   tamanho que tiver.
 * - **A grade abre com os OCULTOS** (os que nunca chegaram ao feed). A busca e
 *   as quatro hashtags filtram os DEZESSEIS — é assim que a criança descobre
 *   que os estandes da área dela também estavam lá o tempo todo.
 * - **Da busca, a api recebe só o TIPO e a área que casou** (`AcaoDaGaleria`):
 *   o texto digitado é de menor e nunca sai do aparelho. Uma busca conta
 *   quando a digitação para (ou no toque do chip), e a mesma busca seguida não
 *   conta duas vezes.
 * - **A ficha de cada estande abre numa folha** (`BottomSheetUnv` modal), e a
 *   abertura é registrada — é o que a EF06CO01 lê na revisão do voto.
 * - **"Manter" e "Revisar"** abrem a cédula extraordinária (LATCH 2), que
 *   mostra a justificativa de ANTES (o cartão e a frase grifada na cédula) ao
 *   lado da mostra inteira: é o contraste "Antes eu pensava… Agora eu percebo…"
 *   que o PO pediu. A criança decide manter, trocar ou COMPLEMENTAR (manter o
 *   voto e indicar outro estande), e justifica com um cartão novo e uma frase
 *   da legenda do estande da decisão. Manter vale, desde que justificado. Quem
 *   decide se a decisão vale é a api; a tela só não oferece o próprio voto como
 *   troca nem como complemento.
 */

/** A decisão montada na cédula extraordinária, como a api a recebe. */
export type CorpoDaRevisao =
  | { acao: "manter"; motivo: MotivoDaRevisao; trecho: number }
  | { acao: "trocar" | "complementar"; projetoId: string; motivo: MotivoDaRevisao; trecho: number };
export function Galeria({
  galeria,
  categorias,
  voto,
  motivos,
  enviando,
  aoAcao,
  aoRevisar,
}: {
  galeria: DadosDaGaleria;
  categorias: readonly Categoria[];
  voto: Voto | null;
  /** Os cartões de antes (para mostrar o que a criança escolheu) e os de depois. */
  motivos: { voto: readonly Cartao[]; revisao: readonly Cartao[] };
  enviando: boolean;
  aoAcao: (acao: AcaoDaGaleria) => void;
  aoRevisar: (corpo: CorpoDaRevisao) => void;
}) {
  const paleta = usePaleta();
  const [texto, setTexto] = useState("");
  const [chip, setChip] = useState<Area | null>(null);
  const [ficha, setFicha] = useState<ProjetoDaGaleria | null>(null);
  const [revisando, setRevisando] = useState(false);
  const [acao, setAcao] = useState<AcaoDaRevisao | null>(null);
  const [outro, setOutro] = useState<string | null>(null);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [trecho, setTrecho] = useState<number | null>(null);
  const ultimaBusca = useRef<string | null>(null);

  const porId = useMemo(() => new Map(galeria.projetos.map((p) => [p.id, p])), [galeria.projetos]);
  const doVoto = voto ? porId.get(voto.projetoId) : undefined;
  /* O estande da DECISÃO: o do voto ao manter, o escolhido ao trocar ou complementar. A frase grifada é da legenda dele. */
  const daDecisao = acao === "manter" ? doVoto : outro ? porId.get(outro) : undefined;
  const frasesDaDecisao = frasesDaLegenda(daDecisao?.legenda ?? "");
  const pode =
    acao !== null && motivo !== null && trecho !== null && (acao === "manter" || outro !== null) && !enviando;

  function abrirRevisao(inicial: AcaoDaRevisao | null) {
    setAcao(inicial);
    setOutro(null);
    setTrecho(null);
    setRevisando(true);
  }

  function registrar() {
    if (!pode || acao === null || motivo === null || trecho === null) return;
    const m = motivo as MotivoDaRevisao;
    if (acao === "manter") aoRevisar({ acao, motivo: m, trecho });
    else if (outro) aoRevisar({ acao, projetoId: outro, motivo: m, trecho });
  }
  const buscando = chip !== null || texto.trim() !== "";
  const visiveis = galeria.projetos.filter((p) =>
    chip !== null ? p.area === chip : texto.trim() ? casaComABusca(p, texto, categorias) : !p.exibidoNoSeuFeed,
  );
  const itens: UnvMediaItem[] = visiveis.map((p) => ({
    id: p.id,
    src: srcDoEstande({ projetoId: p.id, titulo: p.titulo, imagem: p.imagem }, paleta),
    alt: p.imagem.alt || p.titulo,
  }));

  function registrarBusca(acao: Extract<AcaoDaGaleria, { tipo: "buscar" }>) {
    const chave = `${acao.busca}:${acao.area ?? "-"}`;
    if (chave === ultimaBusca.current) return;
    ultimaBusca.current = chave;
    aoAcao(acao);
  }

  // A busca por texto vale quando a digitação para.
  useEffect(() => {
    if (chip !== null) return;
    const relogio = window.setTimeout(() => {
      const classe = classificarBusca(texto, categorias, galeria.projetos);
      if (classe) registrarBusca({ tipo: "buscar", ...classe });
    }, PAUSA_DA_BUSCA_MS);
    return () => window.clearTimeout(relogio);
    // `registrarBusca` lê só refs e a prop estável `aoAcao`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, chip, categorias, galeria.projetos]);

  function tocarNoChip(area: Area) {
    if (chip === area) {
      setChip(null);
      return;
    }
    setChip(area);
    setTexto("");
    registrarBusca({ tipo: "buscar", busca: "hashtag", area });
  }

  function abrir(projetoId: string) {
    const p = porId.get(projetoId);
    if (!p) return;
    setFicha(p);
    aoAcao({ tipo: "abrir", projetoId });
  }

  const { ocultos, total, percentual } = galeria.invisibilidade;
  const categoriaDaFicha = ficha ? categorias.find((c) => c.area === ficha.area) : undefined;

  return (
    <div className="tela">
      <h1 className="so-leitor">{E4.comunicado}</h1>
      <TopBar title={E2.topo} withStatusBarInset={false} />
      <div className="rolagem galeria">
        <div className="galeria__cabeca">
          <p className="galeria__comunicado">{E4.comunicado}</p>
          <InlineHint tone="friction" announce>
            {E4.taxa(ocultos, total, percentual)}
          </InlineHint>
          <p className="galeria__instrucao">{E4.instrucao}</p>
          <SearchField
            block
            value={texto}
            placeholder={E4.busca}
            ariaLabel={E4.busca}
            clearable
            clearLabel={E4.limparBusca}
            onClear={() => setTexto("")}
            onChange={(e) => {
              setChip(null);
              setTexto(e.target.value);
            }}
          />
          <div className="galeria__chips" role="group" aria-label={E4.hashtags}>
            {categorias.map((c) => (
              <Chip key={c.area} selected={chip === c.area} onClick={() => tocarNoChip(c.area)}>
                {comCerquilha(c.hashtag)}
              </Chip>
            ))}
          </div>
        </div>
        {itens.length > 0 ? (
          <MediaGrid
            items={itens}
            columns={3}
            ariaLabel={buscando ? E4.gradeBusca : E4.gradeOculta}
            onSelect={(item) => abrir(item.id)}
          />
        ) : (
          <p className="galeria__vazia" role="status">
            {E4.semResultados}
          </p>
        )}
      </div>
      <div className="doca">
        <ButtonUnv variant="secondary" size="md" block disabled={enviando} onClick={() => abrirRevisao("manter")}>
          {E4.manter}
        </ButtonUnv>
        <ButtonUnv
          variant="primary"
          size="md"
          block
          disabled={enviando}
          leadingIcon={<IconUnv name="search" size={18} tone="inherit" />}
          onClick={() => abrirRevisao(null)}
        >
          {E4.revisar}
        </ButtonUnv>
      </div>

      <BottomSheetUnv open={ficha !== null} modal title={ficha?.titulo} maxHeight="80%" onOpenChange={(o) => !o && setFicha(null)}>
        {ficha && (
          <div className="ficha">
            <div className="ficha__etiquetas">
              <BadgeUnv variant="neutral" wrap>
                {ficha.exibidoNoSeuFeed ? E4.vistoNoFeed : E4.ocultoNoFeed}
              </BadgeUnv>
              {voto?.projetoId === ficha.id && (
                <BadgeUnv variant="neutral" wrap>
                  {E4.seuVoto}
                </BadgeUnv>
              )}
            </div>
            <img
              className="ficha__imagem"
              src={srcDoEstande({ projetoId: ficha.id, titulo: ficha.titulo, imagem: ficha.imagem }, paleta)}
              alt={ficha.imagem.alt}
            />
            <dl className="ficha__lista">
              <dt>{E2.fichaEscola}</dt>
              <dd>{ficha.escola}</dd>
              <dt>{E2.fichaArea}</dt>
              <dd>{categoriaDaFicha ? `${categoriaDaFicha.nome} · ${comCerquilha(categoriaDaFicha.hashtag)}` : ""}</dd>
              <dt>{E2.fichaPerfil}</dt>
              <dd>{ficha.perfil}</dd>
            </dl>
            <p className="ficha__legenda">{ficha.legenda}</p>
            <p className="ficha__hashtags">{ficha.hashtags.join(" ")}</p>
          </div>
        )}
      </BottomSheetUnv>

      <BottomSheetUnv
        open={revisando}
        modal
        title={E4.revisaoTitulo}
        maxHeight="88%"
        onOpenChange={(o) => !o && !enviando && setRevisando(false)}
      >
        <div className="cedula">
          {doVoto && voto?.justificativa && (
            <div className="justificativa-de-antes" data-justificativa="antes">
              <p className="cedula__instrucao">{E4.antes}</p>
              <p className="justificativa-de-antes__voto">{E4.seuVotoLacrado(doVoto.titulo)}</p>
              <p className="justificativa-de-antes__motivo">
                {motivos.voto.find((m) => m.id === voto.justificativa?.motivo)?.texto ?? ""}
              </p>
              <p className="justificativa-de-antes__rotulo">{E4.voceGrifou}</p>
              <blockquote className="justificativa-de-antes__trecho">
                {frasesDaLegenda(doVoto.legenda)[voto.justificativa.trecho] ?? ""}
              </blockquote>
            </div>
          )}
          <p className="cedula__instrucao">{E4.decisao}</p>
          <div className="cedula__certeza" role="group" aria-label={E4.grupoDaDecisao}>
            {ACOES_DA_REVISAO.map((a) => (
              <Chip
                key={a}
                selected={acao === a}
                disabled={enviando}
                onClick={() => {
                  if (a !== acao) {
                    setOutro(null);
                    setTrecho(null);
                  }
                  setAcao(a);
                }}
              >
                {E4.acoes[a]}
              </Chip>
            ))}
          </div>
          {acao && <p className="cedula__explicacao">{E4.explicacao[acao]}</p>}
          {(acao === "trocar" || acao === "complementar") && (
            <>
              <p className="cedula__instrucao">{acao === "trocar" ? E4.revisaoInstrucao : E4.complementarInstrucao}</p>
              <Escolha
                rotulo={E4.grupoDaRevisao}
                valor={outro}
                desabilitada={enviando}
                aoEscolher={(id) => {
                  if (id !== outro) setTrecho(null);
                  setOutro(id);
                }}
                opcoes={galeria.projetos
                  .filter((p) => p.id !== voto?.projetoId)
                  .map((p) => ({
                    id: p.id,
                    titulo: p.titulo,
                    subtitulo: p.escola,
                    imagem: { src: srcDoEstande({ projetoId: p.id, titulo: p.titulo, imagem: p.imagem }, paleta), alt: "" },
                  }))}
              />
            </>
          )}
          {acao && (
            <>
              <p className="cedula__instrucao">{E4.motivoDepois}</p>
              <Escolha
                rotulo={E4.grupoDoMotivoDepois}
                valor={motivo}
                desabilitada={enviando}
                aoEscolher={setMotivo}
                opcoes={motivos.revisao.map((m) => ({ id: m.id, titulo: m.texto }))}
              />
            </>
          )}
          {daDecisao && (
            <>
              <p className="cedula__instrucao">{E4.trechoDepois(daDecisao.titulo)}</p>
              <Escolha
                rotulo={E3.grupoDoTrecho}
                valor={trecho === null ? null : String(trecho)}
                desabilitada={enviando}
                aoEscolher={(id) => setTrecho(Number(id))}
                opcoes={frasesDaDecisao.map((f, i) => ({ id: String(i), titulo: f }))}
              />
            </>
          )}
          <div className="cedula__confirmar">
            <ButtonUnv variant="primary" size="lg" block disabled={!pode} onClick={registrar}>
              {E4.registrar}
            </ButtonUnv>
          </div>
        </div>
      </BottomSheetUnv>
    </div>
  );
}
