"use client";

import { dataCurta } from "@edu/sdk";
import { useState } from "react";
import { Button, Card, Checkbox, Icon, NumberButton, RadioGroup } from "@edu/ui/ds";
import {
  MISSAO_QUE_AGRUPA_POR_LADO,
  tamanhoDasEquipes,
  type PessoaDaEquipe,
  type UltimasEquipes,
} from "@/lib/equipes";

export type EscolhaDeMontagem = "sorteio" | "manual" | "ultima";

/**
 * O começo: quantos computadores, quem faltou, e COMO montar.
 *
 * A pergunta "sortear ou eu separo" é SEMPRE feita, sem opção marcada de
 * antemão — é decisão do professor, e um padrão escolhido por nós viraria a
 * resposta de quem não leu. A terceira opção só aparece quando a turma tem
 * equipes salvas em outra missão.
 *
 * A lista de presença abre por renderização condicional, e não dentro de um
 * `Collapse` do DS: fechado, ele deixa os ~40 checkboxes da turma focáveis
 * dentro de um `aria-hidden` (a armadilha registrada no `Collapse`).
 */
export function MontarEquipes({
  expId,
  turma,
  computadoresIniciais,
  ausentesIniciais,
  ultima,
  tituloDaUltima,
  ocupado,
  podeCancelar,
  onContinuar,
  onCancelar,
}: {
  expId: string;
  turma: readonly PessoaDaEquipe[];
  computadoresIniciais: number;
  ausentesIniciais: readonly string[];
  ultima: UltimasEquipes | null;
  tituloDaUltima: string | null;
  ocupado: boolean;
  podeCancelar: boolean;
  onContinuar: (escolha: EscolhaDeMontagem, computadores: number, ausentes: string[]) => void;
  onCancelar: () => void;
}) {
  const [computadores, setComputadores] = useState(computadoresIniciais);
  const [ausentes, setAusentes] = useState<string[]>(() =>
    ausentesIniciais.filter((id) => turma.some((p) => p.id === id)),
  );
  const [vendoPresenca, setVendoPresenca] = useState(false);
  const [escolha, setEscolha] = useState<EscolhaDeMontagem | "">("");

  const presentes = turma.length - ausentes.length;
  const maximo = Math.max(1, presentes);
  /* O teto acompanha a presença: marcar uma falta a mais não pode deixar mais
     computadores do que gente para sentar neles. */
  const valor = Math.min(Math.max(1, computadores), maximo);

  const alternarFalta = (id: string, faltou: boolean) =>
    setAusentes((atual) => (faltou ? [...new Set([...atual, id])] : atual.filter((x) => x !== id)));

  const opcoes = [
    {
      value: "sorteio",
      label: "Sortear as equipes",
      helperText:
        "A plataforma divide quem está presente em equipes de tamanho parecido. Dá para mudar quem fica onde antes de salvar.",
    },
    {
      value: "manual",
      label: "Eu separo",
      helperText: `A plataforma cria ${valor} ${valor === 1 ? "equipe vazia" : "equipes vazias"} e você põe cada estudante numa delas.`,
    },
    ...(ultima?.origem ? [{ value: "ultima", label: "Manter as equipes da última missão", helperText: textoDaUltima(ultima, tituloDaUltima, expId) }] : []),
  ];

  return (
    <Card variant="outlined">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <span className="text-[15px] font-semibold text-unooria-neutral-950">
            Quantos computadores vocês vão usar?
          </span>
          <div>
            <NumberButton
              value={valor}
              min={1}
              max={maximo}
              onChange={setComputadores}
              ariaLabel="Quantos computadores vocês vão usar?"
              ariaLabelDecrement="Um computador a menos"
              ariaLabelIncrement="Um computador a mais"
            />
          </div>
          <p className="text-[13px] text-unooria-neutral-500">{tamanhoDasEquipes(presentes, valor)}</p>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setVendoPresenca((aberto) => !aberto)}
              aria-expanded={vendoPresenca}
              rightIcon={<Icon name={vendoPresenca ? "expand_less" : "expand_more"} size="xs" color="currentColor" aria-hidden />}
            >
              Quem faltou hoje?
            </Button>
          </div>
          {vendoPresenca ? (
            <div className="flex flex-col gap-2">
              <p className="text-[13px] text-unooria-neutral-500">
                Marque quem faltou: fica fora do sorteio e aparece em &quot;Sem equipe&quot;.
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {turma.map((pessoa) => (
                  <Checkbox
                    key={pessoa.id}
                    id={`faltou-${pessoa.id}`}
                    label={pessoa.nome}
                    checked={ausentes.includes(pessoa.id)}
                    onChange={(marcado) => alternarFalta(pessoa.id, marcado)}
                  />
                ))}
              </div>
            </div>
          ) : ausentes.length > 0 ? (
            <p className="text-[13px] text-unooria-neutral-700">
              {ausentes.length === 1 ? "1 falta marcada." : `${ausentes.length} faltas marcadas.`}
            </p>
          ) : null}
        </div>

        <RadioGroup
          label="Como montar as equipes?"
          name={`modo-das-equipes-${expId}`}
          direction="vertical"
          value={escolha}
          onChange={(v) => setEscolha(String(v) as EscolhaDeMontagem)}
          options={opcoes}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="md"
            isDisabled={!escolha || presentes === 0 || ocupado}
            isLoading={ocupado}
            onClick={() => escolha && onContinuar(escolha, valor, ausentes)}
          >
            Continuar
          </Button>
          {podeCancelar ? (
            <Button variant="ghost" size="md" isDisabled={ocupado} onClick={onCancelar}>
              Cancelar
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function textoDaUltima(ultima: UltimasEquipes, titulo: string | null, expId: string): string {
  const quando = ultima.origem ? ` em ${dataCurta(ultima.origem.atualizadoEm)}` : "";
  const onde = titulo ? `no ${titulo}` : "na missão anterior";
  const saidas =
    ultima.saidas === 0
      ? ""
      : ultima.saidas === 1
        ? " 1 estudante daquela montagem não está mais na turma."
        : ` ${ultima.saidas} estudantes daquela montagem não estão mais na turma.`;
  const lado =
    expId === MISSAO_QUE_AGRUPA_POR_LADO
      ? " O lado do feed não vem junto: para agrupar por lado, sorteie."
      : "";
  return `As mesmas equipes salvas ${onde}${quando}.${saidas}${lado}`;
}
