"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  AlertBox,
  Button,
  Card,
  TextArea,
  TextField,
  Toggle,
} from "@edu/ui/ds";
import {
  DIVISOR_TESE,
  ESTILOS_VISUAIS,
  MODOS_NEUTROS,
} from "@/lib/insta/defaults";

const ROTULO_MODO: Record<(typeof MODOS_NEUTROS)[number], string> = {
  ambos: "Dentro e fora do tema",
  no_tema: "Só dentro do tema",
  fora_do_tema: "Só fora do tema",
};

const APOIO_MODO: Record<(typeof MODOS_NEUTROS)[number], string> = {
  ambos: "Fato sem lado sobre o tema + assuntos leves (memes, esportes, animais).",
  no_tema: "Só fato sem lado: cronologia, fontes, 'como se sabe isso'.",
  fora_do_tema: "Só assuntos leves, fora da disputa.",
};

/** Turma do professor, como `GET /turmas/minhas` devolve. */
interface TurmaDoProfessor {
  id: string;
  nome: string;
  serie: string;
}

/**
 * Passo 1 do doc 05: tema e recorte. A **pergunta-chave não é digitada aqui** —
 * a IA propõe candidatas no passo 2 e o professor escolhe, edita ou escreve a
 * sua.
 */
export function FormularioAtividade() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [turmas, setTurmas] = useState<TurmaDoProfessor[]>([]);

  /* As turmas do professor vêm de `GET /turmas/minhas`, que já devolve
     exatamente aquelas em que ele TEM MATRÍCULA — não as da escola. Falhar aqui
     não impede criar a atividade: sem turma ela vale para a escola inteira, que
     é como toda atividade funcionava antes. */
  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const resposta = await fetch("/api/plataforma/turmas/minhas", { cache: "no-store" });
        if (!resposta.ok) return;
        /* `GET /turmas/minhas` devolve o ARRAY cru (`TurmasSchema`), não um
           envelope — conferido no contrato Zod da api. */
        const lista = (await resposta.json()) as TurmaDoProfessor[];
        if (vivo && Array.isArray(lista)) setTurmas(lista);
      } catch {
        /* silêncio proposital: ver comentário acima */
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const [form, setForm] = useState({
    turmaId: "",
    titulo: "",
    disciplina: "",
    recorte: "",
    contextoAula: "",
    qtdPostsTese: 400,
    estiloVisual: ESTILOS_VISUAIS[0] as string,
    neutrosAtivo: true,
    neutrosModo: "ambos" as (typeof MODOS_NEUTROS)[number],
    neutrosProporcao: 40,
  });

  const atualizar = <C extends keyof typeof form>(
    campo: C,
    valor: (typeof form)[C],
  ) => setForm((atual) => ({ ...atual, [campo]: valor }));

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) return;

    setErro(null);
    setEnviando(true);
    try {
      const resposta = await fetch("/api/plataforma/atividades", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          /* Vazio = sem turma: a atividade vale para a escola inteira, o
             comportamento de toda atividade anterior à coluna `turma_id`. */
          ...(form.turmaId ? { turmaId: form.turmaId } : {}),
          titulo: form.titulo,
          disciplina: form.disciplina,
          recorte: form.recorte,
          contextoAula: form.contextoAula.trim() || null,
          qtdPostsTese: Number(form.qtdPostsTese),
          estiloVisual: form.estiloVisual,
          neutros: {
            ativo: form.neutrosAtivo,
            modo: form.neutrosModo,
            proporcao: Number(form.neutrosProporcao) / 100,
          },
        }),
      });

      if (!resposta.ok) {
        const corpo = (await resposta.json().catch(() => null)) as {
          mensagem?: string;
        } | null;
        setErro(corpo?.mensagem ?? "Não foi possível criar a atividade.");
        setEnviando(false);
        return;
      }

      const { id } = (await resposta.json()) as { id: string };
      router.replace(`/professor/atividades/${id}?analisar=1`);
    } catch {
      setErro("Sem conexão agora. Tente de novo.");
      setEnviando(false);
    }
  }

  const tese = Number(form.qtdPostsTese);
  const teseDivisivel = tese > 0 && tese % DIVISOR_TESE === 0;
  const neutros = form.neutrosAtivo
    ? Math.round((tese * Number(form.neutrosProporcao)) / 100 / 4) * 4
    : 0;

  const podeEnviar =
    form.titulo.trim().length >= 3 &&
    form.disciplina.trim().length >= 2 &&
    form.recorte.trim().length >= 2 &&
    teseDivisivel;

  return (
    <form className="flex flex-col gap-5" onSubmit={enviar} noValidate>
      {erro ? (
        <AlertBox
          theme="light"
          variant="error"
          device="auto"
          description={erro}
        />
      ) : null}

      <Card variant="outlined">
        <div className="flex flex-col gap-4">
          <TextField
            id="titulo"
            label="Título"
            placeholder="Revolução Francesa — 8ºA"
            value={form.titulo}
            onChange={(e) => atualizar("titulo", e.target.value)}
            required
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="disciplina"
              label="Disciplina"
              placeholder="História"
              value={form.disciplina}
              onChange={(e) => atualizar("disciplina", e.target.value)}
              required
            />
            <TextField
              id="recorte"
              label="Tema / recorte"
              placeholder="Revolução Francesa"
              value={form.recorte}
              onChange={(e) => atualizar("recorte", e.target.value)}
              required
            />
          </div>

          {/*
            A TURMA. Opcional de propósito: sem ela a atividade vale para a
            escola inteira, que é como toda atividade funcionava antes da coluna
            `turma_id`. Com ela, o painel de perfis, a importação da Vila e a
            entrada do aluno passam a falar da MESMA sala — antes o painel
            listava a escola e o "N ainda não jogaram" contava crianças de
            outras turmas.
          */}
          {turmas.length > 0 ? (
            <div>
              <label className="unooria-rotulo-de-campo" htmlFor="turma">
                Turma
              </label>
              <select
                id="turma"
                className="unooria-select"
                value={form.turmaId}
                onChange={(e) => atualizar("turmaId", e.target.value)}
              >
                <option value="">Todas as turmas da escola</option>
                {turmas.map((turma) => (
                  <option key={turma.id} value={turma.id}>
                    {turma.nome} · {turma.serie}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[12px] text-unooria-neutral-500">
                Escolher a turma faz o painel de perfis, a importação da Vila do
                Lume e a entrada dos alunos falarem só dessa sala.
              </p>
            </div>
          ) : null}
        </div>
      </Card>

      <Card variant="elevated">
        <div className="flex flex-col gap-1">
          <p className="text-[14px] font-semibold text-unooria-neutral-950">
            A pergunta do debate vem no próximo passo
          </p>
          <p className="text-[13px] text-unooria-neutral-500">
            A partir do tema, a IA vai propor perguntas com dois lados
            defensáveis, com uma nota de equilíbrio e a justificativa de cada
            uma. Você escolhe, edita ou escreve a sua — a palavra final é sempre
            sua.
          </p>
        </div>
      </Card>

      <Card variant="outlined">
        <div className="flex flex-col gap-4">
          <TextArea
            id="contexto"
            label="O que já foi trabalhado em aula (opcional)"
            rows={3}
            placeholder="Vimos o Antigo Regime, os três estados e a queda da Bastilha."
            value={form.contextoAula}
            onChange={(e) => atualizar("contextoAula", e.target.value)}
            helperText="Calibra vocabulário e referências dos posts."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            {/*
              Saiu "Faixa etária": a atividade é sempre de 8º ano, então o
              público-alvo virou constante do sistema (PUBLICO_ALVO em
              lib/insta/defaults.ts) em vez de decisão do professor — doc 05 §1.
            */}
            <TextField
              id="qtd"
              label="Posts de tese"
              type="number"
              min={DIVISOR_TESE}
              max={900}
              step={DIVISOR_TESE}
              value={String(form.qtdPostsTese)}
              onChange={(e) => atualizar("qtdPostsTese", Number(e.target.value))}
              error={
                teseDivisivel
                  ? false
                  : `Precisa ser múltiplo de ${DIVISOR_TESE} (2 lados × 4 perfis).`
              }
              helperText={
                teseDivisivel
                  ? `${tese} = ${tese / 2} por lado = ${tese / DIVISOR_TESE} por lado e perfil.`
                  : undefined
              }
            />
            <div>
              <label className="unooria-rotulo-de-campo" htmlFor="estilo">
                Estilo visual das imagens
              </label>
              <select
                id="estilo"
                className="unooria-select"
                value={form.estiloVisual}
                onChange={(e) => atualizar("estiloVisual", e.target.value)}
              >
                {ESTILOS_VISUAIS.map((estilo) => (
                  <option key={estilo} value={estilo}>
                    {estilo}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </Card>

      <Card variant="outlined">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[14px] font-semibold text-unooria-neutral-950">
                Conteúdo neutro
              </p>
              <p className="text-[13px] text-unooria-neutral-500">
                Posts que não defendem nenhum dos dois lados.
              </p>
            </div>
            <Toggle
              size="xs"
              checked={form.neutrosAtivo}
              label={<span className="whitespace-nowrap">Gerar neutros</span>}
              onChange={(marcado) => atualizar("neutrosAtivo", marcado)}
            />
          </div>

          {form.neutrosAtivo ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="unooria-rotulo-de-campo" htmlFor="modo-neutros">
                  Tipo
                </label>
                <select
                  id="modo-neutros"
                  className="unooria-select"
                  value={form.neutrosModo}
                  onChange={(e) =>
                    atualizar(
                      "neutrosModo",
                      e.target.value as (typeof MODOS_NEUTROS)[number],
                    )
                  }
                >
                  {MODOS_NEUTROS.map((modo) => (
                    <option key={modo} value={modo}>
                      {ROTULO_MODO[modo]}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[12px] text-unooria-neutral-500">
                  {APOIO_MODO[form.neutrosModo]}
                </p>
              </div>
              <TextField
                id="prop-neutros"
                label="Proporção sobre a tese (%)"
                type="number"
                min={10}
                max={100}
                step={5}
                value={String(form.neutrosProporcao)}
                onChange={(e) =>
                  atualizar("neutrosProporcao", Number(e.target.value))
                }
                helperText={`${neutros} posts neutros (${neutros / 4} por perfil).`}
              />
            </div>
          ) : (
            <AlertBox
              theme="light"
              variant="warning"
              device="auto"
              description="Sem neutros o feed fica visivelmente monotemático desde o primeiro post, a aba de busca cai num fallback e a curadoria por bloco perde o material que a disfarça. Funciona, mas o disfarce enfraquece."
            />
          )}

          {teseDivisivel ? (
            <p className="text-[13px] text-unooria-neutral-700">
              Total a gerar: <strong>{tese + neutros}</strong> posts
              {" "}({tese} de tese + {neutros} neutros).
            </p>
          ) : null}
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          variant="primary"
          isLoading={enviando}
          loadingText="Criando…"
          isDisabled={!podeEnviar}
        >
          Analisar pergunta
        </Button>
        <span className="text-[12px] text-unooria-neutral-500">
          A IA vai propor os dois lados; você valida antes de gerar qualquer
          post.
        </span>
      </div>
    </form>
  );
}
