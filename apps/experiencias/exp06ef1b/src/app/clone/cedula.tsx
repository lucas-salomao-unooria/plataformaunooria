import { useState } from "react";
import { BottomSheetUnv, ButtonUnv, Chip, IconUnv, TopBar } from "@edu/ui/ds-unoovista";
import { frasesDaLegenda, type EstandeDoFeed } from "../../lib/regras";
import { E2, E3 } from "../../lib/textos";
import { CONVICCOES, type Cartao, type Conviccao, type MotivoDoVoto } from "../../lib/tipos";
import { srcDoEstande, usePaleta } from "../componentes/midia";
import { Escolha } from "./escolha";

/**
 * E3-ALU-02 — a cédula: a folha modal do app (`BottomSheetUnv`) sobre o feed,
 * com os estandes que APARECERAM no feed (a api recusa os outros), a convicção,
 * a JUSTIFICATIVA de antes (um cartão de motivo e a frase grifada da legenda do
 * estande — o "Antes eu pensava…" que o PO pediu, sem digitação) e o botão
 * travado até as quatro escolhas. Trocar de projeto apaga a frase grifada: ela
 * era da legenda do outro.
 *
 * As DUAS convicções afirmam certeza, de propósito (`vocabulario.ts`): é a
 * aposta que a galeria vai confrontar. A tela não oferece "não vi tudo".
 *
 * O voto só existe quando a api confirma: o botão espera a resposta, e o
 * fechamento da folha não grava nada. Fechar e reabrir mantém a escolha
 * (estado da casca), mas um F5 antes de confirmar a perde — é a única coisa
 * que a missão aceita perder, porque ainda não é voto.
 */
export function Cedula({
  aberta,
  estandes,
  motivos,
  enviando,
  aoFechar,
  aoVotar,
}: {
  aberta: boolean;
  estandes: readonly EstandeDoFeed[];
  /** Os cartões de motivo de ANTES (`sessao.motivos.voto`). */
  motivos: readonly Cartao[];
  enviando: boolean;
  aoFechar: () => void;
  aoVotar: (voto: { projetoId: string; conviccao: Conviccao; motivo: MotivoDoVoto; trecho: number }) => void;
}) {
  const paleta = usePaleta();
  const [projeto, setProjeto] = useState<string | null>(null);
  const [conviccao, setConviccao] = useState<Conviccao | null>(null);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [trecho, setTrecho] = useState<number | null>(null);
  const frases = frasesDaLegenda(estandes.find((e) => e.projetoId === projeto)?.legenda ?? "");
  const pode = projeto !== null && conviccao !== null && motivo !== null && trecho !== null && !enviando;

  return (
    <BottomSheetUnv
      open={aberta}
      modal
      title={E3.urna}
      maxHeight="88%"
      onOpenChange={(abrir) => {
        if (!abrir && !enviando) aoFechar();
      }}
    >
      <div className="cedula">
        <p className="cedula__instrucao">{E3.selecione}</p>
        <Escolha
          rotulo={E3.grupoDosProjetos}
          valor={projeto}
          desabilitada={enviando}
          aoEscolher={(id) => {
            if (id !== projeto) setTrecho(null);
            setProjeto(id);
          }}
          opcoes={estandes.map((e) => ({
            id: e.projetoId,
            titulo: e.titulo,
            subtitulo: e.escola,
            imagem: { src: srcDoEstande(e, paleta), alt: "" },
          }))}
        />
        <p className="cedula__instrucao">{E3.certeza}</p>
        <div className="cedula__certeza" role="group" aria-label={E3.grupoDaCerteza}>
          {CONVICCOES.map((c) => (
            <Chip key={c} selected={conviccao === c} disabled={enviando} onClick={() => setConviccao(c)}>
              {E3.conviccao[c]}
            </Chip>
          ))}
        </div>
        <p className="cedula__instrucao">{E3.motivo}</p>
        <Escolha
          rotulo={E3.grupoDoMotivo}
          valor={motivo}
          desabilitada={enviando}
          aoEscolher={setMotivo}
          opcoes={motivos.map((m) => ({ id: m.id, titulo: m.texto }))}
        />
        <p className="cedula__instrucao">{projeto ? E3.trecho : E3.escolhaOProjeto}</p>
        {projeto && (
          <Escolha
            rotulo={E3.grupoDoTrecho}
            valor={trecho === null ? null : String(trecho)}
            desabilitada={enviando}
            aoEscolher={(id) => setTrecho(Number(id))}
            opcoes={frases.map((f, i) => ({ id: String(i), titulo: f }))}
          />
        )}
        <div className="cedula__confirmar">
          <ButtonUnv
            variant="primary"
            size="lg"
            block
            disabled={!pode}
            leadingIcon={<IconUnv name="lock" size={18} tone="inherit" />}
            onClick={() => {
              if (projeto && conviccao && motivo && trecho !== null) {
                aoVotar({ projetoId: projeto, conviccao, motivo: motivo as MotivoDoVoto, trecho });
              }
            }}
          >
            {E3.confirmar}
          </ButtonUnv>
        </div>
      </div>
    </BottomSheetUnv>
  );
}

/**
 * E3-ALU-03 — o lacre: o carimbo e o protocolo, logo depois de a api confirmar
 * o voto. Fica alguns segundos e dá lugar à plenária (o PICO); num F5 depois do
 * voto a criança já cai direto na plenária (o lacre é a passagem, não um passo).
 */
export function Lacre({ protocolo, titulo }: { protocolo: string; titulo: string | null }) {
  return (
    <div className="tela">
      <TopBar title={E2.topo} withStatusBarInset={false} />
      <div className="lacre" role="status">
        <div className="lacre__carimbo">
          <IconUnv name="lock" size={48} tone="link" />
          <p className="lacre__titulo">{E3.lacrado}</p>
          {titulo && <p className="lacre__projeto">{titulo}</p>}
        </div>
        <p className="lacre__protocolo">{E3.protocolo(protocolo)}</p>
      </div>
    </div>
  );
}
