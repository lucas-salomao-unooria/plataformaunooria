"use client";

import { data, dataHora, diaDaPlataforma } from "@edu/sdk";
import { useCallback, useMemo, useState } from "react";
import {
  Button,
  FeedbackAlert,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ScrollBar,
  SectionHeader,
  Selection,
  Snackbar,
  Table,
  Tag,
  TextArea,
  TextField,
  type TableColumn,
} from "@edu/ui/ds";
import type { ComponenteDePreco, PrecoDeIa, PrecosDeIa } from "./tipos";

/**
 * A TABELA DE PREÇOS de IA (ADR-161) — de onde o painel tira o custo.
 *
 * Só se ACRESCENTA: cada gravação é uma vigência nova, e a anterior fica. É por
 * isso que não há "editar" nem "apagar" — a tabela é o próprio histórico, e um
 * preço apagado tiraria o custo dos dias em que ele valeu. Corrigir um valor
 * digitado errado é gravar de novo na MESMA data, que substitui só aquela.
 */

const COMPONENTES: Record<ComponenteDePreco, { rotulo: string; unidade: string }> = {
  entrada: { rotulo: "Entrada", unidade: "por 1 milhão de tokens" },
  saida: { rotulo: "Saída", unidade: "por 1 milhão de tokens" },
  minuto: { rotulo: "Minuto de vídeo", unidade: "por minuto" },
};

const dolares = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", maximumFractionDigits: 6 });
/** Meio-dia UTC: o dia não muda em fuso nenhum do país (ver `painel-de-custos.tsx`). */
const doDia = (dia: string) => `${dia}T12:00:00Z`;

/** Aceita vírgula ou ponto, como a pessoa digita. Vazio ou inválido vira `NaN` e trava o botão. */
function lerValor(texto: string): number {
  const limpo = texto.trim().replace(/\s/g, "").replace(",", ".");
  return /^\d+(\.\d+)?$/.test(limpo) ? Number(limpo) : Number.NaN;
}

/** O mesmo formato do Zod e do CHECK da api. */
const MODELO_RE = /^[a-z0-9][a-z0-9._-]{1,79}$/;
/** O mesmo teto de sanidade do Zod da api. */
const TETO_DE_SANIDADE = 10_000;

export function TabelaDePrecos({ inicial, aoGravar }: { inicial: PrecosDeIa; aoGravar: () => void }) {
  const [tabela, setTabela] = useState(inicial);
  const [aberta, setAberta] = useState(false);
  const [modelo, setModelo] = useState("");
  const [componente, setComponente] = useState<ComponenteDePreco>("entrada");
  const [valor, setValor] = useState("");
  const [desde, setDesde] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  /* O preço que vale HOJE em cada (modelo, componente). A lista vem com a
     vigência mais nova primeiro, mas uma vigência FUTURA (a virada de preço já
     anunciada pelo fornecedor) ainda não vale. */
  const hoje = diaDaPlataforma();
  const vigentes = useMemo(() => {
    const ids = new Set<string>();
    const vistos = new Set<string>();
    for (const p of tabela.precos) {
      const chave = `${p.modelo}|${p.componente}`;
      if (p.vigenteDesde <= hoje && !vistos.has(chave)) {
        vistos.add(chave);
        ids.add(p.id);
      }
    }
    return ids;
  }, [tabela, hoje]);

  const abrir = useCallback((base?: PrecoDeIa) => {
    setModelo(base?.modelo ?? "");
    setComponente(base?.componente ?? "entrada");
    setValor(base ? String(base.usd).replace(".", ",") : "");
    setDesde(diaDaPlataforma());
    setMotivo("");
    setErro(null);
    setAberta(true);
  }, []);

  const numero = lerValor(valor);
  const modeloLimpo = modelo.trim().toLowerCase();
  const modeloValido = MODELO_RE.test(modeloLimpo);
  const valorValido = Number.isFinite(numero) && numero >= 0 && numero <= TETO_DE_SANIDADE;
  const desdeValido = /^\d{4}-\d{2}-\d{2}$/.test(desde);
  const podeGravar = modeloValido && valorValido && desdeValido && motivo.trim().length >= 3 && !salvando;

  const gravar = useCallback(async () => {
    if (!podeGravar) return;
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch("/api/plataforma/recursos/custos-de-ia/precos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ modelo: modeloLimpo, componente, usd: numero, vigenteDesde: desde, motivo: motivo.trim() }),
      });
      if (!r.ok) {
        const corpo = (await r.json().catch(() => null)) as { mensagem?: string; message?: string } | null;
        setErro(corpo?.mensagem ?? corpo?.message ?? "Não foi possível gravar. Nada mudou.");
        return;
      }
      setTabela((await r.json()) as PrecosDeIa);
      setAberta(false);
      setAviso(`${modeloLimpo} · ${COMPONENTES[componente].rotulo}: ${dolares.format(numero)} a partir de ${data(doDia(desde))}. O painel foi recalculado.`);
      aoGravar();
    } catch {
      setErro("A api não respondeu. O preço pode não ter sido gravado — recarregue a página antes de tentar de novo.");
    } finally {
      setSalvando(false);
    }
  }, [podeGravar, modeloLimpo, componente, numero, desde, motivo, aoGravar]);

  const colunas = useMemo<TableColumn<PrecoDeIa>[]>(
    () => [
      { key: "modelo", title: "Modelo", render: (_, p) => <code className="whitespace-nowrap text-[13px]">{p.modelo}</code> },
      { key: "componente", title: "Cobra", render: (_, p) => COMPONENTES[p.componente].rotulo },
      {
        key: "usd",
        title: "Preço (US$)",
        align: "right",
        render: (_, p) => (
          <span>
            <strong>{dolares.format(p.usd)}</strong>
            <span className="ml-1 text-[12px] text-unooria-neutral-500">{COMPONENTES[p.componente].unidade}</span>
          </span>
        ),
      },
      {
        key: "vigenteDesde",
        title: "Vale desde",
        render: (_, p) => (
          <span className="flex flex-wrap items-center gap-2">
            {data(doDia(p.vigenteDesde))}
            {vigentes.has(p.id) ? (
              <Tag variant="success" size="sm">
                vale hoje
              </Tag>
            ) : p.vigenteDesde > hoje ? (
              <Tag variant="info" size="sm">
                a partir da data
              </Tag>
            ) : null}
          </span>
        ),
      },
      {
        key: "motivo",
        title: "Quem e por quê",
        render: (_, p) => (
          <span className="flex flex-col gap-0.5 text-[13px]">
            <span>{p.definidoPorNome ? `${p.definidoPorNome}, ${dataHora(p.definidoEm)}` : "Preço de lista inicial da plataforma"}</span>
            {p.motivo ? <span className="text-unooria-neutral-600">{p.motivo}</span> : null}
          </span>
        ),
      },
      {
        key: "acao",
        title: "",
        align: "right",
        render: (_, p) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => abrir(p)}
            aria-label={`Novo preço para ${p.modelo}, ${COMPONENTES[p.componente].rotulo}`}
          >
            Novo preço
          </Button>
        ),
      },
    ],
    [vigentes, hoje, abrir],
  );

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader
        title="Tabela de preços"
        description="O preço de cada modelo, em dólar, com a data a partir da qual vale. A tabela começou com o preço de lista do Google e da LiveAvatar; se o contrato tiver desconto, grave o preço do contrato com a data em que ele passou a valer — o painel recalcula daquele dia em diante."
        actions={
          <Button variant="primary" size="md" onClick={() => abrir()}>
            Cadastrar preço
          </Button>
        }
      />

      <ScrollBar orientation="both" autoHide className="tabela-rolavel">
        <Table<PrecoDeIa>
          columns={colunas}
          data={tabela.precos}
          keyExtractor={(p) => p.id}
          emptyText="Nenhum preço cadastrado."
          size="md"
          theme="light"
        />
      </ScrollBar>

      <Modal isOpen={aberta} onClose={() => (salvando ? undefined : setAberta(false))} size="sm" theme="light">
        <ModalHeader>
          <ModalTitle>Preço de IA</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <FeedbackAlert
              type="info"
              title="Nada é apagado"
              description="O preço novo vale a partir da data escolhida; o anterior continua valendo antes dela. A mesma data para o mesmo modelo substitui só aquela vigência — é assim que se corrige um valor digitado errado."
            />
            <TextField
              id="preco-modelo"
              label="Modelo"
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              placeholder="gemini-3.7-flash"
              error={modelo !== "" && !modeloValido ? "Só letras minúsculas, dígitos, ponto, hífen e sublinhado." : undefined}
              helperText={tabela.modelosEmUso.length > 0 ? `Já usados nesta rede: ${tabela.modelosEmUso.join(", ")}.` : undefined}
            />
            <Selection
              id="preco-componente"
              label="O que é cobrado"
              value={componente}
              options={(Object.keys(COMPONENTES) as ComponenteDePreco[]).map((c) => ({
                value: c,
                label: `${COMPONENTES[c].rotulo} (${COMPONENTES[c].unidade})`,
              }))}
              onChange={(v) => setComponente(String(v) as ComponenteDePreco)}
            />
            <TextField
              id="preco-valor"
              label={`Preço em US$ ${COMPONENTES[componente].unidade}`}
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,75"
              error={valor !== "" && !valorValido ? `Um número de 0 a ${TETO_DE_SANIDADE.toLocaleString("pt-BR")}.` : undefined}
            />
            <TextField id="preco-desde" label="Vale a partir de" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            <TextArea
              id="preco-motivo"
              label="Motivo"
              rows={3}
              placeholder="Desconto do contrato de outubro. / Correção: o preço de lista era 3,75, não 37,5."
              helperText="Obrigatório. Meses depois é ele que diz se o valor veio do contrato, de uma tabela nova do fornecedor ou de uma correção."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
            {erro ? <FeedbackAlert type="error" title="Não deu" description={erro} /> : null}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" size="md" disabled={salvando} onClick={() => setAberta(false)}>
            Cancelar
          </Button>
          <Button variant="primary" size="md" disabled={!podeGravar} onClick={() => void gravar()}>
            {salvando ? "Gravando…" : "Gravar"}
          </Button>
        </ModalFooter>
      </Modal>

      {aviso ? <Snackbar severity="success" title={aviso} onClose={() => setAviso(null)} /> : null}
    </section>
  );
}
