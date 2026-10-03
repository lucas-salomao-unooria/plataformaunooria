"use client";

import { dataHora } from "@edu/sdk";
import { useState } from "react";
import {
  Button,
  EmptyState,
  FeedbackAlert,
  Modal,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ScrollBar,
  SectionHeader,
  Table,
  type TableColumn,
} from "@edu/ui/ds";
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
 *
 * "Eliminar a pedido do titular" (H10.5.2, LGPD art. 18, VI) apaga a linha de
 * verdade, depois de uma confirmação que diz QUEM sai. Não há editar: cadastro
 * não se edita, só se elimina.
 */

/** O `Table` do DS exige `Record<string, unknown>` na linha. */
type Linha = Cadastro & Record<string, unknown>;

export function PainelDeProspeccao({ inicial }: { inicial: Cadastros }) {
  const [dados, setDados] = useState(inicial);
  const [relendo, setRelendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aEliminar, setAEliminar] = useState<Linha | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [eliminado, setEliminado] = useState<string | null>(null);
  const [erroAoEliminar, setErroAoEliminar] = useState<string | null>(null);

  async function eliminar(alvo: Linha) {
    setEliminando(true);
    setErroAoEliminar(null);
    try {
      const r = await fetch(`/api/plataforma/prospeccao/cadastros/${encodeURIComponent(alvo.id)}`, {
        method: "DELETE",
      });
      /* 404 é "já não está lá" (outra aba, outra pessoa): o efeito pedido
         aconteceu. A lista é relida para mostrar a base como ela é. */
      if (r.status === 404) {
        setAEliminar(null);
        setEliminado(alvo.nome);
        await reler();
        return;
      }
      if (!r.ok) throw new Error();
      setDados((atual) => ({
        cadastros: atual.cadastros.filter((c) => c.id !== alvo.id),
        total: Math.max(0, atual.total - 1),
      }));
      setAEliminar(null);
      setEliminado(alvo.nome);
    } catch {
      /* A janela FICA aberta: o cadastro continua na base, e dizer o contrário
         seria afirmar ao titular um pedido atendido que não foi. */
      setErroAoEliminar("Não deu para eliminar agora. O cadastro continua na base; tente de novo.");
    } finally {
      setEliminando(false);
    }
  }

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
    {
      key: "id",
      title: "",
      render: (_v, linha) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setErroAoEliminar(null);
            setAEliminar(linha);
          }}
        >
          Eliminar a pedido do titular
        </Button>
      ),
    },
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

      {eliminado ? (
        <FeedbackAlert
          type="success"
          title="Cadastro eliminado"
          description={`O contato de ${eliminado} saiu da base. Fica registrado só que um cadastro foi eliminado, por quem e quando.`}
        />
      ) : null}

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

      <p className="text-[13px] text-unooria-neutral-500">
        Quem pedir para sair da lista é atendido aqui, em &quot;Eliminar a pedido do titular&quot;: o contato sai da
        base de vez. O aceite de contato fica registrado com a frase que a pessoa marcou no site.
      </p>

      <Modal isOpen={aEliminar !== null} onClose={() => setAEliminar(null)} size="sm" theme="light">
        <ModalHeader>
          <ModalTitle>Eliminar este cadastro?</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-3">
            <ModalDescription>
              {aEliminar
                ? `O contato de ${aEliminar.nome} (${aEliminar.organizacao}) sai da base de vez e não volta. Use só a pedido do próprio titular.`
                : null}
            </ModalDescription>
            {erroAoEliminar ? (
              <FeedbackAlert type="error" title="Não eliminou" description={erroAoEliminar} />
            ) : null}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" size="md" onClick={() => setAEliminar(null)} disabled={eliminando}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            size="md"
            isLoading={eliminando}
            onClick={() => {
              if (aEliminar) void eliminar(aEliminar);
            }}
          >
            Eliminar
          </Button>
        </ModalFooter>
      </Modal>
    </section>
  );
}
