import { useState } from "react";
import { BottomSheet, Button, Card, CardContent, Table, Tag } from "@edu/ui/ds";
import { Casca, Zara, rotuloDaZara } from "../componentes/Casca";
import type { Contexto } from "../contexto";
import { api } from "../lib/api";
import { citacaoDaAposta, textoDoMedidor, TEXTOS } from "../lib/textos";
import type { Ficha } from "../lib/tipos";

/**
 * E4-ALU-02 e E4-ALU-03 — de volta ao módulo escolar, o confronto NOMINAL com
 * a aposta (a citação é o texto inteiro da opção) e as fichas de auditoria.
 *
 * - O confronto ramifica em A/B/C, com a citação literal do Figma
 *   (`TEXTOS.e4.citacao`); a fala da Zara e o medidor são os mesmos
 *   nas três. O medidor é AGREGADO e só aparece com 3 apostas ou mais (o
 *   servidor manda `null` abaixo disso).
 * - "Abrir Fichas de Auditoria de Acesso" (o PQ-02) abre a `BottomSheet` com
 *   a `Table` Estudante | Formulário | Observado | Ação do Sistema, que CABE
 *   em 375px (o layout do quadro: recuo curto, cabeçalho em duas linhas) e
 *   destaca com fio as linhas com inferência (Beatriz e Thiago). As fichas
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
          <p className="escola__destaque">{TEXTOS.e4.confronto[aposta](citacaoDaAposta(aposta))}</p>
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

/** A ordem do Figma (E4-ALU-03): Lucas (o controle), Beatriz, Thiago. */
const ORDEM = ["lucas", "beatriz", "thiago"];

/**
 * A tabela das fichas no modo declarativo do `Table` do DS (`Table.Row`,
 * `Table.Cell`), para cada célula ter a ênfase do Figma: o dado observado que
 * DIFERE do controle (o Lucas) em negrito — 23h45 na Beatriz, sinal instável
 * no Thiago —, "Inferência:" e a decisão em negrito, e a linha inteira com
 * fio quando há inferência. Nada aqui é gabarito: é o que as fichas mostram.
 */
function TabelaDeFichas({ fichas }: { fichas: Ficha[] }) {
  const ordenadas = [...fichas].sort((a, b) => ORDEM.indexOf(a.perfil) - ORDEM.indexOf(b.perfil));
  const controle = ordenadas.find((f) => f.inferencia === null) ?? null;
  const c = TEXTOS.e4.colunas;
  return (
    <Table size="sm" theme="light" zebra={false} className="fichas">
      <Table.Header>
        <Table.Row>
          <Table.HeadCell>{c.estudante}</Table.HeadCell>
          <Table.HeadCell>{c.formulario}</Table.HeadCell>
          <Table.HeadCell>{c.observado}</Table.HeadCell>
          <Table.HeadCell>{c.acao}</Table.HeadCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {ordenadas.map((f) => {
          const horarioDifere = controle !== null && f.horario !== controle.horario;
          const conexaoDifere = controle !== null && f.conexao !== controle.conexao;
          return (
            <Table.Row key={f.perfil} className={f.inferencia ? "fichas__linha--inferencia" : undefined}>
              <Table.Cell>
                <strong>{f.nome}</strong>
              </Table.Cell>
              <Table.Cell>
                <span className="fichas__celula">
                  <Tag variant="neutral" size="sm">
                    {TEXTOS.e4.fornecido}
                  </Tag>
                  {f.formulario}
                </span>
              </Table.Cell>
              <Table.Cell>
                {horarioDifere ? <strong>{f.horario}</strong> : f.horario}
                {" · "}
                {conexaoDifere ? <strong>{f.conexao}</strong> : f.conexao}
              </Table.Cell>
              <Table.Cell>
                {f.inferencia ? (
                  <>
                    <strong>{TEXTOS.e4.inferencia("").trim()}</strong> {f.inferencia} <strong>→ {f.acao}</strong>
                  </>
                ) : (
                  <AcaoSemInferencia acao={f.acao} />
                )}
              </Table.Cell>
            </Table.Row>
          );
        })}
      </Table.Body>
    </Table>
  );
}

/** "Resultado: Avançado" — o rótulo em negrito e o resultado em texto, como no quadro. */
function AcaoSemInferencia({ acao }: { acao: string }) {
  const i = acao.indexOf(": ");
  if (i < 0) return <strong>{acao}</strong>;
  return (
    <>
      <strong>{acao.slice(0, i + 1)}</strong> {acao.slice(i + 2)}
    </>
  );
}
