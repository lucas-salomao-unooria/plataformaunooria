"use client";

import { Button, Card, FeedbackAlert, Selection, Tag, TextField } from "@edu/ui/ds";
import {
  NOME_MAXIMO,
  SEM_EQUIPE,
  moverEstudante,
  novaEquipe,
  removerEquipe,
  renomearEquipe,
  resumoDoAgrupamento,
  type EquipeEmEdicao,
  type PessoaDaEquipe,
  type RascunhoDeEquipes,
} from "@/lib/equipes";

/**
 * A edição: uma equipe por cartão, e cada estudante com um `Selection` que o
 * leva para outra equipe (ou para "Sem equipe"). Serve às três origens — a
 * sugestão da api, as equipes já salvas e as da última missão — porque todas
 * viram o mesmo `RascunhoDeEquipes` antes de chegar aqui.
 *
 * O lado do feed (Instanooria) é da SUGESTÃO: o hub não sabe o lado de
 * ninguém. Por isso a tag some da equipe em que o professor mexeu — mantê-la
 * seria afirmar um agrupamento que deixou de ser verdade.
 */
export function EditarEquipes({
  rascunho,
  onMudar,
  problemas,
  ocupado,
  onSalvar,
  onCancelar,
  onSortearDeNovo,
}: {
  rascunho: RascunhoDeEquipes;
  onMudar: (proximo: RascunhoDeEquipes) => void;
  problemas: readonly string[];
  ocupado: boolean;
  onSalvar: () => void;
  onCancelar: () => void;
  /** Só no modo sorteio: pede outra sugestão com as mesmas entradas. */
  onSortearDeNovo?: () => void;
}) {
  const destinos = [
    ...rascunho.equipes.map((equipe) => ({ value: equipe.chave, label: equipe.nome.trim() || "(sem nome)" })),
    { value: SEM_EQUIPE, label: "Sem equipe" },
  ];
  const mover = (estudanteId: string, destino: string) => onMudar(moverEstudante(rascunho, estudanteId, destino));
  const { agrupamento } = rascunho;

  return (
    <div className="flex flex-col gap-4">
      {agrupamento ? (
        <FeedbackAlert
          type="info"
          title="Agrupado pelo lado do feed"
          description={resumoDoAgrupamento(agrupamento)}
          subtle={agrupamento.fonte ? `Fonte: ${agrupamento.fonte}` : undefined}
        />
      ) : null}
      {agrupamento?.aviso ? (
        <FeedbackAlert type="warning" title="Sobre este sorteio" description={agrupamento.aviso} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rascunho.equipes.map((equipe, indice) => (
          <CartaoDaEquipe
            key={equipe.chave}
            equipe={equipe}
            posicao={indice + 1}
            destinos={destinos}
            ocupado={ocupado}
            onRenomear={(nome) => onMudar(renomearEquipe(rascunho, equipe.chave, nome))}
            onRemover={() => onMudar(removerEquipe(rascunho, equipe.chave))}
            onMover={mover}
          />
        ))}
        <CartaoSemEquipe
          pessoas={rascunho.semEquipe}
          ausentes={rascunho.ausentes}
          destinos={destinos}
          ocupado={ocupado}
          onMover={mover}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" isDisabled={ocupado} onClick={() => onMudar(novaEquipe(rascunho))}>
          Nova equipe
        </Button>
        {onSortearDeNovo ? (
          <Button variant="ghost" size="sm" isDisabled={ocupado} onClick={onSortearDeNovo}>
            Sortear de novo
          </Button>
        ) : null}
      </div>

      {problemas.length > 0 ? (
        <FeedbackAlert type="warning" title="Antes de salvar">
          <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px]">
            {problemas.map((problema) => (
              <li key={problema}>{problema}</li>
            ))}
          </ul>
        </FeedbackAlert>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          size="md"
          isDisabled={problemas.length > 0 || ocupado}
          isLoading={ocupado}
          onClick={onSalvar}
        >
          Salvar equipes
        </Button>
        <Button variant="ghost" size="md" isDisabled={ocupado} onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

type Destino = { value: string; label: string };

function CartaoDaEquipe({
  equipe,
  posicao,
  destinos,
  ocupado,
  onRenomear,
  onRemover,
  onMover,
}: {
  equipe: EquipeEmEdicao;
  posicao: number;
  destinos: Destino[];
  ocupado: boolean;
  onRenomear: (nome: string) => void;
  onRemover: () => void;
  onMover: (estudanteId: string, destino: string) => void;
}) {
  const mostrarLado = !equipe.mexida;
  return (
    <Card variant="outlined" data-equipe={equipe.chave}>
      <div className="flex flex-col gap-3">
        {/* O nome é o título do cartão, e é editável. O rótulo acessível vai
            pela POSIÇÃO: pelo nome, ele mudaria a cada letra digitada. */}
        <TextField
          aria-label={`Nome da equipe ${posicao}`}
          value={equipe.nome}
          maxLength={NOME_MAXIMO}
          size="sm"
          disabled={ocupado}
          onChange={(e) => onRenomear(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-unooria-neutral-500">
          {mostrarLado && equipe.grupo ? (
            <Tag variant="info" size="sm">
              Lado {equipe.grupo}
            </Tag>
          ) : null}
          {mostrarLado && equipe.mista ? (
            <Tag variant="warning" size="sm">
              Mista
            </Tag>
          ) : null}
          <span>
            {equipe.membros.length === 1 ? "1 estudante" : `${equipe.membros.length} estudantes`}
          </span>
        </div>
        {equipe.membros.length === 0 ? (
          <p className="text-[13px] text-unooria-neutral-500">Ninguém nesta equipe ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {equipe.membros.map((pessoa) => (
              <li key={pessoa.id}>
                <Selection
                  size="sm"
                  label={pessoa.nome}
                  value={equipe.chave}
                  options={destinos}
                  disabled={ocupado}
                  showOptionCheckbox={false}
                  maxBoxHeight={240}
                  onChange={(v) => onMover(pessoa.id, String(v))}
                />
              </li>
            ))}
          </ul>
        )}
        <div>
          <Button
            variant="ghost"
            size="sm"
            isDisabled={ocupado}
            onClick={onRemover}
            aria-label={`Remover a equipe ${posicao}`}
          >
            Remover equipe
          </Button>
        </div>
      </div>
    </Card>
  );
}

function CartaoSemEquipe({
  pessoas,
  ausentes,
  destinos,
  ocupado,
  onMover,
}: {
  pessoas: readonly PessoaDaEquipe[];
  ausentes: readonly string[];
  destinos: Destino[];
  ocupado: boolean;
  onMover: (estudanteId: string, destino: string) => void;
}) {
  const faltou = new Set(ausentes);
  return (
    <Card variant="outlined" title={`Sem equipe (${pessoas.length})`}>
      {pessoas.length === 0 ? (
        <p className="text-[13px] text-unooria-neutral-500">Todo mundo está numa equipe.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {pessoas.map((pessoa) => (
            <li key={pessoa.id} className="flex flex-col gap-1">
              <Selection
                size="sm"
                label={pessoa.nome}
                value={SEM_EQUIPE}
                options={destinos}
                disabled={ocupado}
                showOptionCheckbox={false}
                maxBoxHeight={240}
                onChange={(v) => onMover(pessoa.id, String(v))}
              />
              {/* Quem faltou continua escolhível: o atrasado que chega entra
                  numa equipe e deixa de contar como ausente. */}
              {faltou.has(pessoa.id) ? (
                <span>
                  <Tag size="sm">faltou</Tag>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
