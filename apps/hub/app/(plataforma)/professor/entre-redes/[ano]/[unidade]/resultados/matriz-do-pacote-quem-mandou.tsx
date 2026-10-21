"use client";

import { useState } from "react";

import { Button, Tag, TextArea, TextField } from "@edu/ui/ds";
import {
  TETOS,
  agruparPorQuadrante,
  conferirMensagem,
  type CampoDaMensagem,
  type MensagemNaMatriz,
} from "@/lib/quem-mandou-regras";
import { ROTULO_DA_LEGENDA, ROTULO_DO_TIPO, type MensagemDoPacote } from "@/lib/quem-mandou-tipos";

/**
 * As oito mensagens nos quatro quadrantes, com os selos que SÓ o professor vê.
 * Com `onTrocar`, cada card ganha "Editar texto" (é a curadoria da criação,
 * `atividades/nova`); sem, é leitura (a página da atividade).
 *
 * Mora fora do passo de criação porque as duas telas a usam — e a matriz é UMA
 * só: o selo que a professora curou é o mesmo que ela relê durante a aula.
 */
export function MatrizDoPacote({
  mensagens,
  errosDaApi = {},
  onTrocar,
}: {
  mensagens: readonly MensagemDoPacote[];
  errosDaApi?: Record<string, string[]>;
  onTrocar?: (id: string, campo: CampoDaMensagem, valor: string) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {agruparPorQuadrante(mensagens).map((grupo) => (
        <section
          key={grupo.quadrante}
          className="flex flex-col gap-3 rounded-lg border border-unooria-neutral-200 p-3"
          data-quadrante={grupo.quadrante}
        >
          <Tag variant={grupo.quadrante.startsWith("V") ? "success" : "danger"} size="md" pill>
            {grupo.rotulo}
          </Tag>
          {grupo.mensagens.map((item) => (
            <CartaoDaMensagem
              key={item.mensagem.id}
              item={item}
              errosDaApi={errosDaApi[item.mensagem.id] ?? []}
              onTrocar={onTrocar}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

/**
 * O pacote de uma atividade JÁ CRIADA, recolhido atrás de um botão: na página
 * da atividade a professora o relê (é o gabarito com que ela conduz a roda),
 * mas ele não pode empurrar o painel da aula para baixo da dobra.
 *
 * Renderização condicional, e não `Collapse`: fechado, ele deixa os controles
 * focáveis dentro de `aria-hidden` (a lacuna registrada na exp-92).
 */
export function MensagensDoPacote({ mensagens }: { mensagens: readonly MensagemDoPacote[] }) {
  const [vendo, setVendo] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setVendo((v) => !v)}
          aria-expanded={vendo}
          data-acao="ver-mensagens"
        >
          {vendo ? `Esconder as ${mensagens.length} mensagens` : `Ver as ${mensagens.length} mensagens`}
        </Button>
      </div>
      {vendo ? <MatrizDoPacote mensagens={mensagens} /> : null}
    </div>
  );
}

function CartaoDaMensagem({
  item,
  errosDaApi,
  onTrocar,
}: {
  item: MensagemNaMatriz;
  errosDaApi: string[];
  onTrocar?: (id: string, campo: CampoDaMensagem, valor: string) => void;
}) {
  const { mensagem: m, posicao } = item;
  const [editando, setEditando] = useState(false);
  const conferencia = onTrocar ? conferirMensagem(m) : {};
  const temErro = Object.keys(conferencia).length > 0 || errosDaApi.length > 0;

  return (
    <article
      className={`flex flex-col gap-2 rounded-md border p-3 ${temErro ? "border-unooria-danger" : "border-unooria-neutral-200"}`}
      data-mensagem={m.id}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-unooria-neutral-500">
        {posicao}ª mensagem · {ROTULO_DO_TIPO[m.tipo]}
      </p>

      {editando && onTrocar ? (
        <div className="flex flex-col gap-3">
          <TextField
            label="Quem manda"
            value={m.remetente}
            maxLength={TETOS.remetenteMaxCaracteres}
            error={conferencia.remetente}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onTrocar(m.id, "remetente", e.target.value)}
          />
          <TextArea
            label="A mensagem, como a turma lê"
            rows={4}
            value={m.texto}
            maxLength={TETOS.textoMaxCaracteres}
            helperText={`Até ${TETOS.textoMaxPalavras} palavras.`}
            error={conferencia.texto}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onTrocar(m.id, "texto", e.target.value)}
          />
          {m.tipo !== "texto" ? (
            <TextArea
              label={ROTULO_DA_LEGENDA[m.tipo]}
              rows={2}
              value={m.legenda ?? ""}
              maxLength={TETOS.legendaMaxCaracteres}
              helperText={`Até ${TETOS.legendaMaxPalavras} palavras.`}
              error={conferencia.legenda}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onTrocar(m.id, "legenda", e.target.value)}
            />
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-[13px] font-semibold text-unooria-neutral-950">{m.remetente}</p>
          <p className="text-[14px] leading-relaxed text-unooria-neutral-800">{m.texto}</p>
          {m.tipo !== "texto" ? (
            <p className="text-[13px] leading-relaxed text-unooria-neutral-700">
              <span className="text-unooria-neutral-500">{ROTULO_DA_LEGENDA[m.tipo]}:</span> {m.legenda}
            </p>
          ) : null}
          {Object.values(conferencia).map((frase) => (
            <p key={frase} className="text-[12px] text-unooria-danger">
              {frase}
            </p>
          ))}
        </div>
      )}

      {errosDaApi.length > 0 ? (
        <ul className="list-disc pl-5 text-[12px] text-unooria-danger" role="status">
          {errosDaApi.map((frase) => (
            <li key={frase}>{frase}</li>
          ))}
        </ul>
      ) : null}

      {onTrocar ? (
        <div>
          <Button variant="ghost" size="sm" onClick={() => setEditando((v) => !v)} aria-expanded={editando}>
            {editando ? "Concluir edição" : "Editar texto"}
          </Button>
        </div>
      ) : null}
    </article>
  );
}
