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
import { casaComABusca, classificarBusca, comCerquilha } from "../../lib/regras";
import { E2, E4 } from "../../lib/textos";
import type { AcaoDaGaleria, Area, Categoria, Galeria as DadosDaGaleria, ProjetoDaGaleria, Voto } from "../../lib/tipos";
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
 * - **"Manter" e "Revisar"** fecham a galeria (LATCH 2). Quem decide se o voto
 *   pode trocar e para qual é a api; a tela só não oferece o próprio voto como
 *   troca.
 */
export function Galeria({
  galeria,
  categorias,
  voto,
  enviando,
  aoAcao,
  aoManter,
  aoTrocar,
}: {
  galeria: DadosDaGaleria;
  categorias: readonly Categoria[];
  voto: Voto | null;
  enviando: boolean;
  aoAcao: (acao: AcaoDaGaleria) => void;
  aoManter: () => void;
  aoTrocar: (projetoId: string) => void;
}) {
  const paleta = usePaleta();
  const [texto, setTexto] = useState("");
  const [chip, setChip] = useState<Area | null>(null);
  const [ficha, setFicha] = useState<ProjetoDaGaleria | null>(null);
  const [revisando, setRevisando] = useState(false);
  const [troca, setTroca] = useState<string | null>(null);
  const ultimaBusca = useRef<string | null>(null);

  const porId = useMemo(() => new Map(galeria.projetos.map((p) => [p.id, p])), [galeria.projetos]);
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
        <ButtonUnv variant="secondary" size="md" block disabled={enviando} onClick={aoManter}>
          {E4.manter}
        </ButtonUnv>
        <ButtonUnv
          variant="primary"
          size="md"
          block
          disabled={enviando}
          leadingIcon={<IconUnv name="search" size={18} tone="inherit" />}
          onClick={() => setRevisando(true)}
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
          <p className="cedula__instrucao">{E4.revisaoInstrucao}</p>
          <Escolha
            rotulo={E4.grupoDaRevisao}
            valor={troca}
            desabilitada={enviando}
            aoEscolher={setTroca}
            opcoes={galeria.projetos
              .filter((p) => p.id !== voto?.projetoId)
              .map((p) => ({
                id: p.id,
                titulo: p.titulo,
                subtitulo: p.escola,
                imagem: { src: srcDoEstande({ projetoId: p.id, titulo: p.titulo, imagem: p.imagem }, paleta), alt: "" },
              }))}
          />
          <div className="cedula__confirmar">
            <ButtonUnv
              variant="primary"
              size="lg"
              block
              disabled={troca === null || enviando}
              onClick={() => troca && aoTrocar(troca)}
            >
              {E4.revisar}
            </ButtonUnv>
          </div>
        </div>
      </BottomSheetUnv>
    </div>
  );
}
