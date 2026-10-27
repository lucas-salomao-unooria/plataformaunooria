import { useState } from "react";
import { BottomSheet, Button, Card, CardContent, ScrollBar, Table, Tag, type TableColumn } from "@edu/ui/ds";
import { Casca, Zara, rotuloDaZara } from "../componentes/Casca";
import type { Contexto } from "../contexto";
import { api } from "../lib/api";
import { citarAposta, textoDoMedidor, TEXTOS } from "../lib/textos";
import type { Ficha } from "../lib/tipos";

/**
 * E4-ALU-02 e E4-ALU-03 — de volta ao módulo escolar, o confronto NOMINAL com
 * a aposta (a citação é o texto inteiro da opção) e as fichas de auditoria.
 *
 * - O confronto ramifica em A/B/C; a fala da Zara e o medidor são os mesmos
 *   nas três. O medidor é AGREGADO e só aparece com 3 apostas ou mais (o
 *   servidor manda `null` abaixo disso).
 * - "Abrir Fichas de Auditoria de Acesso" (o PQ-02) abre a `BottomSheet` com
 *   a `Table` Estudante | Formulário | Observado | Ação do Sistema. As fichas
 *   NÃO são gabarito: são a revelação que a mecânica mostra.
 * - "Concluir Inspeção de Metadados" leva à Trava 1 (E4-SIS-01), do
 *   despachante. Durante a pausa do professor ("Travar Telas da Turma") a
 *   folha fecha, para a camada de espera ficar por cima de tudo.
 */
export function Auditoria({ ctx }: { ctx: Contexto }) {
  const { estado, sessao, medidor, executar } = ctx;
  const [enviando, setEnviando] = useState(false);
  const fichasAbertas = estado.passo === "fichas";
  const aposta = estado.aposta ?? "a";
  const texto = sessao.material.apostas.find((a) => a.id === aposta)?.texto ?? "";
  const linhaDoMedidor = textoDoMedidor(medidor);

  async function abrir() {
    setEnviando(true);
    await executar(() => api.abrirFichas(), "fichas");
    setEnviando(false);
  }

  async function concluir() {
    setEnviando(true);
    await executar(() => api.concluirInspecao(), "inspecao");
    setEnviando(false);
  }

  return (
    <Casca
      cabecalho={{ titulo: TEXTOS.e4.cabecalho, tag: fichasAbertas ? TEXTOS.e4.tagFichas : TEXTOS.e4.tag }}
      equipe={estado.equipe}
    >
      <Card variant="outlined">
        <CardContent>
          <p className="escola__destaque">{TEXTOS.e4.confronto[aposta](citarAposta(texto))}</p>
        </CardContent>
      </Card>
      <Zara rotulo={rotuloDaZara(estado.equipe)}>{TEXTOS.e4.fala}</Zara>
      {linhaDoMedidor && <p className="escola__medidor">{linhaDoMedidor}</p>}
      {!fichasAbertas && (
        <Button variant="primary" size="lg" fullWidth isLoading={enviando || ctx.naFila("fichas")} onClick={() => void abrir()}>
          {TEXTOS.e4.abrirFichas}
        </Button>
      )}
      <BottomSheet
        isOpen={fichasAbertas && !estado.aguardandoProfessor}
        onClose={() => undefined}
        showCloseButton={false}
        closeOnOverlayClick={false}
        closeOnEsc={false}
        theme="light"
        maxHeight="88%"
        title={TEXTOS.e4.fichasTitulo}
        description={TEXTOS.e4.compare}
        footer={
          <Button variant="secondary" size="lg" fullWidth isLoading={enviando || ctx.naFila("inspecao")} onClick={() => void concluir()}>
            {TEXTOS.e4.concluir}
          </Button>
        }
      >
        <TabelaDeFichas fichas={sessao.material.fichas} />
      </BottomSheet>
    </Casca>
  );
}

interface LinhaDaFicha extends Record<string, unknown> {
  perfil: string;
  nome: string;
  formulario: string;
  observado: string;
  acao: string;
}

const COLUNAS: TableColumn<LinhaDaFicha>[] = [
  { key: "nome", title: TEXTOS.e4.colunas.estudante },
  {
    key: "formulario",
    title: TEXTOS.e4.colunas.formulario,
    render: (_v, r) => (
      <span className="fichas__celula">
        <Tag variant="neutral" size="sm">
          {TEXTOS.e4.fornecido}
        </Tag>
        {r.formulario}
      </span>
    ),
  },
  { key: "observado", title: TEXTOS.e4.colunas.observado },
  { key: "acao", title: TEXTOS.e4.colunas.acao, render: (_v, r) => <strong>{r.acao}</strong> },
];

/** A ordem do Figma (E4-ALU-03): Lucas (o controle), Beatriz, Thiago. */
const ORDEM = ["lucas", "beatriz", "thiago"];

function TabelaDeFichas({ fichas }: { fichas: Ficha[] }) {
  const linhas: LinhaDaFicha[] = [...fichas]
    .sort((a, b) => ORDEM.indexOf(a.perfil) - ORDEM.indexOf(b.perfil))
    .map((f) => ({
      perfil: f.perfil,
      nome: f.nome,
      formulario: f.formulario,
      observado: `${f.horario} · ${f.conexao}`,
      acao: f.inferencia ? `${TEXTOS.e4.inferencia(f.inferencia)} → ${f.acao}` : f.acao,
    }));
  return (
    <ScrollBar orientation="horizontal" theme="light" className="fichas">
      <Table<LinhaDaFicha> columns={COLUNAS} data={linhas} keyExtractor={(r) => r.perfil} size="sm" theme="light" />
    </ScrollBar>
  );
}
