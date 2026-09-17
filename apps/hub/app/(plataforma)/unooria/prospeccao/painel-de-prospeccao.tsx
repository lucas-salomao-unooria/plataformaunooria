"use client";

import { dataHora } from "@edu/sdk";
import { useState } from "react";
import { Button, EmptyState, FeedbackAlert, ScrollBar, SectionHeader, Table, type TableColumn } from "@edu/ui/ds";
import type { Cadastro, Cadastros } from "./tipos";

/**
 * A tabela de quem se cadastrou no site (ADR-107), e o download do CSV.
 *
 * `dataHora` do `@edu/sdk` formata a coluna: data não se monta com `slice` nem
 * com fuso cravado (ADR-98/99), e este é o mesmo formatador que o resto do hub
 * usa — a data aqui precisa ser a mesma data em todo lugar.
 *
 * O CSV é gerado pela API, não aqui. Montar o arquivo no navegador a partir da
 * lista em tela parece mais simples e é a armadilha: o que a tela tem é a lista
 * TRUNCADA, então o arquivo sairia calado com menos linhas do que a base tem —
 * e quem baixasse acharia que aquilo era tudo.
 */

/** O `Table` do DS exige `Record<string, unknown>` na linha. */
type Linha = Cadastro & Record<string, unknown>;

export function PainelDeProspeccao({ inicial }: { inicial: Cadastros }) {
  const [dados, setDados] = useState(inicial);
  const [relendo, setRelendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function reler() {
    setRelendo(true);
    setErro(null);
    try {
      const r = await fetch("/api/plataforma/prospeccao/cadastros", { cache: "no-store" });
      if (!r.ok) throw new Error();
      setDados((await r.json()) as Cadastros);
    } catch {
      /* A lista antiga FICA na tela. Esvaziá-la diria "não há cadastros" para
         um erro de rede, que é a mentira que esta tela mais pode causar. */
      setErro("Não deu para atualizar agora. A lista abaixo é a da última leitura.");
    } finally {
      setRelendo(false);
    }
  }

  const colunas: TableColumn<Linha>[] = [
    {
      key: "criadoEm",
      title: "Quando",
      render: (_v, linha) => <span className="whitespace-nowrap">{dataHora(linha.criadoEm)}</span>,
    },
    { key: "nome", title: "Nome" },
    {
      key: "email",
      title: "E-mail",
      /* `mailto:` porque é o que se faz com esta tela: a próxima ação de quem a
         abre é responder a alguém. */
      render: (_v, linha) => (
        <a className="underline" href={`mailto:${linha.email}`}>
          {linha.email}
        </a>
      ),
    },
    { key: "telefone", title: "Telefone" },
    { key: "organizacao", title: "Rede, secretaria ou escola" },
    { key: "cargo", title: "Cargo" },
  ];

  const truncado = dados.total > dados.cadastros.length;

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        title="Prospecção"
        description="Quem pediu contato pelo formulário do site do ENTRE REDES. A lista é da Unooria: nenhuma rede vê esta tela."
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => void reler()} disabled={relendo}>
          {relendo ? "Atualizando…" : "Atualizar"}
        </Button>
        <Button
          /* Navegação de verdade, e não `fetch` + `Blob`: o arquivo vem da api
             com `content-disposition`, e o navegador baixa sem sair da página.
             Montar o Blob aqui obrigaria a segurar em memória uma lista que já
             tem dono do outro lado. */
          onClick={() => {
            window.location.href = "/api/plataforma/prospeccao/cadastros/exportacao";
          }}
          disabled={dados.cadastros.length === 0}
        >
          Baixar CSV
        </Button>
        <span className="text-[14px] text-unooria-neutral-600">
          {dados.total === 0
            ? "Nenhum cadastro ainda"
            : `${dados.total.toLocaleString("pt-BR")} ${dados.total === 1 ? "cadastro" : "cadastros"}`}
        </span>
      </div>

      {erro ? <FeedbackAlert type="warning" title="Não atualizou" description={erro} /> : null}

      {truncado ? (
        <FeedbackAlert
          type="info"
          title="A tela mostra as mais recentes"
          description={`São ${dados.total.toLocaleString("pt-BR")} cadastros na base e ${dados.cadastros.length.toLocaleString("pt-BR")} nesta lista. O CSV também sai com este recorte — para levar tudo, peça a exportação completa ao time de plataforma.`}
        />
      ) : null}

      {dados.cadastros.length === 0 ? (
        <EmptyState
          title="Ninguém se cadastrou ainda"
          description="Quando alguém preencher o formulário no fim do site, o contato aparece aqui — com data, organização e cargo — e pode ser baixado em CSV."
        />
      ) : (
        <ScrollBar orientation="both" autoHide className="tabela-rolavel">
          <Table columns={colunas} data={dados.cadastros as Linha[]} />
        </ScrollBar>
      )}

      {/* Dito na tela porque a alternativa é alguém procurar o botão que não
          existe. O direito de eliminação (LGPD art. 18, VI) é real e o caminho
          hoje é humano — prometer um botão seria pior que não ter. */}
      <p className="text-[13px] text-unooria-neutral-500">
        Pedido de exclusão de um contato é atendido pelo time de plataforma, direto no banco: esta tela não apaga
        cadastro. O aceite de contato fica registrado com a frase que a pessoa marcou no site.
      </p>
    </section>
  );
}
