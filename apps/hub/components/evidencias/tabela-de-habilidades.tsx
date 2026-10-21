"use client";

import { Checkbox, ScrollBar, Table, Tag, type TableColumn } from "@edu/ui/ds";
import {
  celula,
  ordenarPorEquipe,
  type EstudanteDoPainel,
  type HabilidadeDaFicha,
  type RecorteDoPainel,
} from "@/lib/evidencias";

import { CelulaDaHabilidade } from "./celula-da-habilidade";

/**
 * A grade do painel: uma linha por estudante, uma coluna por habilidade da
 * ficha.
 *
 * **Nenhuma coluna é `sortable`, de propósito.** Ordenar por nível seria o
 * ranking que o produto não tem. A ordem é a alfabética, com quem divide o
 * computador junto (`ordenarPorEquipe`) — e a equipe aparece como `Tag` ao
 * lado do nome.
 *
 * A seleção é uma coluna com o `Checkbox` do DS, e não a prop `selectable` da
 * `Table`: a dela rotula cada caixa como "Selecionar linha N", e aqui a linha é
 * uma criança — o leitor de tela precisa ouvir o NOME (ainda mais com as linhas
 * reagrupadas por equipe, em que a posição não diz nada). Lacuna do DS a pedir
 * no `storybook-unooria`: rótulo da caixa por linha.
 *
 * Client component de propósito: `columns[].render` é função e não atravessa a
 * fronteira RSC.
 */
export function TabelaDeHabilidades({
  estudantes,
  habilidades,
  recorte,
  selecionavel,
  selecionados,
  onSelecionar,
  onSelecionarTodos,
  onAbrirCelula,
}: {
  estudantes: readonly EstudanteDoPainel[];
  habilidades: readonly HabilidadeDaFicha[];
  recorte: RecorteDoPainel;
  /** Caixas de seleção e células clicáveis: só o professor, só numa rodada. */
  selecionavel: boolean;
  selecionados: ReadonlySet<string>;
  onSelecionar: (estudanteId: string, marcado: boolean) => void;
  onSelecionarTodos: (marcado: boolean) => void;
  onAbrirCelula: (estudante: EstudanteDoPainel, codigo: string) => void;
}) {
  const linhas = ordenarPorEquipe(estudantes);
  const todos = linhas.length > 0 && linhas.every((e) => selecionados.has(e.id));
  const algum = linhas.some((e) => selecionados.has(e.id));

  const selecao: TableColumn<EstudanteDoPainel> = {
    key: "selecao",
    width: 48,
    align: "center",
    title: (
      <Checkbox
        aria-label="Selecionar a turma inteira"
        checked={todos}
        indeterminate={algum && !todos}
        onChange={(marcado) => onSelecionarTodos(marcado)}
      />
    ),
    render: (_, estudante) => (
      <Checkbox
        aria-label={`Selecionar ${estudante.nome}`}
        checked={selecionados.has(estudante.id)}
        onChange={(marcado) => onSelecionar(estudante.id, marcado)}
      />
    ),
  };

  const nome: TableColumn<EstudanteDoPainel> = {
    key: "nome",
    title: "Estudante",
    minWidth: 200,
    render: (_, estudante) => (
      <span className="flex flex-col items-start gap-1">
        <span className="font-semibold text-unooria-neutral-950">{estudante.nome}</span>
        {estudante.equipe ? (
          <Tag variant="info" size="sm">
            {estudante.equipe.nome}
          </Tag>
        ) : null}
      </span>
    ),
  };

  const porHabilidade: TableColumn<EstudanteDoPainel>[] = habilidades.map((habilidade) => ({
    key: `habilidade-${habilidade.codigo}`,
    title: habilidade.codigo,
    minWidth: 140,
    render: (_, estudante) => (
      <CelulaDaHabilidade
        nome={estudante.nome}
        codigo={habilidade.codigo}
        leitura={celula(estudante, recorte, habilidade.codigo)}
        onAbrir={selecionavel ? () => onAbrirCelula(estudante, habilidade.codigo) : undefined}
      />
    ),
  }));

  return (
    <ScrollBar orientation="both" autoHide className="tabela-rolavel">
      <Table<EstudanteDoPainel>
        columns={[...(selecionavel ? [selecao] : []), nome, ...porHabilidade]}
        data={linhas}
        keyExtractor={(estudante) => estudante.id}
        emptyText="A turma ainda não tem estudantes."
        size="md"
        theme="light"
      />
    </ScrollBar>
  );
}
