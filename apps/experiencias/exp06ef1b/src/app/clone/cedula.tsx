import { useState } from "react";
import { BottomSheetUnv, ButtonUnv, Chip, IconUnv, InlineHint } from "@edu/ui/ds-unoovista";
import type { EstandeDoFeed } from "../../lib/regras";
import { E3 } from "../../lib/textos";
import { CONVICCOES, type Conviccao } from "../../lib/tipos";
import { srcDoEstande, usePaleta } from "../componentes/midia";
import { Escolha } from "./escolha";

/**
 * E3-ALU-01 — a cédula: a folha modal do app (`BottomSheetUnv`) sobre o feed,
 * com QUATRO elementos e nenhum a mais (PRD v2, melhoria 6):
 *
 * 1. o cabeçalho (o título da folha);
 * 2. os estandes que APARECERAM no feed (a api recusa os outros);
 * 3. a certeza — a pergunta e as duas respostas, que AFIRMAM certeza de
 *    propósito ("Sim" / "Com certeza"): é a aposta que a galeria confronta;
 * 4. o botão, travado até as duas escolhas.
 *
 * **O aviso de inatividade** (E3-SIS-01): 60 s sem toque com a cédula ABERTA,
 * a linha da comissão aparece NO TOPO DA FOLHA, numa região `role="alert"`
 * sempre montada (o leitor de tela anuncia quando ela se enche). O relógio e o
 * batimento ao servidor são da casca (`juri-app.tsx`).
 *
 * O voto só existe quando a api confirma: o botão espera a resposta, e fechar a
 * folha não grava nada. Fechar e reabrir mantém a escolha (estado da casca).
 */
export function Cedula({
  aberta,
  estandes,
  parado,
  enviando,
  aoFechar,
  aoVotar,
}: {
  aberta: boolean;
  estandes: readonly EstandeDoFeed[];
  /** 60 s sem toque com a folha aberta. */
  parado: boolean;
  enviando: boolean;
  aoFechar: () => void;
  aoVotar: (voto: { projetoId: string; conviccao: Conviccao }) => void;
}) {
  const paleta = usePaleta();
  const [projeto, setProjeto] = useState<string | null>(null);
  const [conviccao, setConviccao] = useState<Conviccao | null>(null);
  const pode = projeto !== null && conviccao !== null && !enviando;

  return (
    <BottomSheetUnv
      open={aberta}
      modal
      title={E3.cabecalho}
      maxHeight="88%"
      onOpenChange={(abrir) => {
        if (!abrir && !enviando) aoFechar();
      }}
    >
      <div className="cedula">
        <div className="cedula__alerta" role="alert">
          {parado && (
            <InlineHint tone="friction">
              <IconUnv name="warning" size="sm" tone="inherit" /> {E3.inatividade}
            </InlineHint>
          )}
        </div>
        <Escolha
          rotulo={E3.grupoDosProjetos}
          valor={projeto}
          desabilitada={enviando}
          aoEscolher={setProjeto}
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
        <div className="cedula__confirmar">
          <ButtonUnv
            variant="primary"
            size="lg"
            block
            disabled={!pode}
            leadingIcon={<IconUnv name="lock" size={18} tone="inherit" />}
            onClick={() => {
              if (projeto && conviccao) aoVotar({ projetoId: projeto, conviccao });
            }}
          >
            {E3.confirmar}
          </ButtonUnv>
        </div>
      </div>
    </BottomSheetUnv>
  );
}
