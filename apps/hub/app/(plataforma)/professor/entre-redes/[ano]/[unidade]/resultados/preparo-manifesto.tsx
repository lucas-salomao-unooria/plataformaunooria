"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Button,
  Card,
  Collapse,
  FeedbackAlert,
  TextArea,
  TextField,
} from "@edu/ui/ds";
import type { ConteudoDaTurma } from "@/lib/manifesto-tipos";

/**
 * E0-PROF-01 — a PREPARAÇÃO da turma, dentro do painel de resultados.
 *
 * Mora AQUI, e não numa rota `/professor/exp08ef4b/preparar` como o
 * handoff sugeria, por três razões práticas: a professora já vem a esta tela
 * para conduzir a aula (é onde estão o congelamento e a folha da turma), o
 * preparo é POR TURMA e o seletor de turma já está no topo, e uma rota nova
 * exigiria linha no `middleware.ts` e no registro da trilha — dois arquivos que
 * outra frente está tocando ao mesmo tempo.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A EXIGÊNCIA 8.2, que é o motivo deste componente existir: **nenhum texto
 * gerado por inteligência artificial chega ao estudante sem o clique dela em
 * "Aprovar Conteúdo da Turma".**
 *
 * Por isso `gerar` NÃO persiste nada: ele devolve rascunho para os campos, e o
 * que grava é `homologar`. E por isso todo campo é EDITÁVEL — curadoria é poder
 * reescrever, não só concordar. Aprovar sem editar também é curadoria: passou
 * pelos olhos dela.
 *
 * O que aparece aqui e nunca na tela do estudante: a `replicaIa` de cada
 * questionamento (ver a defesa antes da pergunta desmontaria a cena) e a
 * `justificativaSugerida` de cada cláusula (mostrá-la transformaria a autoria
 * da Etapa 5 em cópia).
 */
export function PreparoManifesto({
  turmaId,
  inicial,
}: {
  turmaId: string;
  inicial: ConteudoDaTurma;
}) {
  const router = useRouter();
  const [, transicionar] = useTransition();

  const [nomeEscola, setNomeEscola] = useState(inicial.contexto.escola);
  const [casoContextual, setCasoContextual] = useState("");
  const [focoPrioritario, setFocoPrioritario] = useState("");
  const [pacote, setPacote] = useState(inicial);
  const [gerando, setGerando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const base = `/api/plataforma/manifesto-ia/turmas/${encodeURIComponent(turmaId)}`;

  async function gerar() {
    setGerando(true);
    setErro(null);
    setAviso(null);
    try {
      const r = await fetch(`${base}/gerar-conteudo`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nomeEscola, casoContextual, focoPrioritario }),
      });
      if (!r.ok) {
        const corpo = (await r.json().catch(() => ({}))) as { mensagem?: string };
        setErro(corpo.mensagem ?? "O gerador não respondeu. O pacote curado continua disponível.");
        return;
      }
      const novo = (await r.json()) as ConteudoDaTurma;
      setPacote(novo);
      /* A tela DIZ quando a IA não respondeu, em vez de fingir que respondeu.
         O pacote curado é homologado pela Unooria — não é remendo —, e a
         professora precisa saber o que está aprovando. */
      setAviso(
        novo.usouIa
          ? "Proposta gerada. Revise cada texto antes de aprovar — nada vai aos estudantes sem o seu clique."
          : "Utilizando pacote curado padrão da Unooria. Ele é homologado e roda a aula inteira.",
      );
    } catch {
      setErro("A conexão falhou. Tente de novo.");
    } finally {
      setGerando(false);
    }
  }

  async function homologar() {
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch(`${base}/homologar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contexto: { ...pacote.contexto, escola: nomeEscola },
          prompts: pacote.prompts,
          clausulas: pacote.clausulas,
          casoContextual: casoContextual || "não informado",
          focoPrioritario: focoPrioritario || "não informado",
          usouBancoDefault: !pacote.usouIa,
        }),
      });
      if (!r.ok) {
        const corpo = (await r.json().catch(() => ({}))) as { mensagem?: string };
        setErro(corpo.mensagem ?? "Não deu para aprovar agora.");
        return;
      }
      setAviso("Conteúdo homologado para a turma com sucesso.");
      transicionar(() => router.refresh());
    } catch {
      setErro("A conexão falhou. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  function trocarPrompt(indice: number, campo: "textoPrompt" | "replicaIa", valor: string) {
    setPacote((p) => ({
      ...p,
      prompts: p.prompts.map((item, i) => (i === indice ? { ...item, [campo]: valor } : item)),
    }));
  }

  function trocarClausula(indice: number, campo: "artigoTexto" | "tituloClausula", valor: string) {
    setPacote((p) => ({
      ...p,
      clausulas: p.clausulas.map((item, i) => (i === indice ? { ...item, [campo]: valor } : item)),
    }));
  }

  return (
    <Card
      variant="elevated"
      title={
        pacote.aprovadoPorProfessor
          ? "Preparação da missão · conteúdo homologado"
          : "Preparação da missão"
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[13px] leading-relaxed text-unooria-neutral-700">
          Personalize o cenário de auditoria da sua turma. O gerador adapta os argumentos e as
          cláusulas aos parâmetros abaixo, e você revisa tudo antes de aprovar.{" "}
          <strong>
            Nenhum conteúdo gerado por inteligência artificial é exibido aos estudantes sem a sua
            aprovação neste painel.
          </strong>
        </p>

        <p className="text-[12px] text-unooria-neutral-600" data-homologado={pacote.aprovadoPorProfessor}>
          {pacote.aprovadoPorProfessor
            ? "Esta turma já tem conteúdo homologado. Sem aprovar nada, a missão usa o pacote curado da Unooria."
            : "Utilizando pacote curado padrão da Unooria."}
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          <TextField
            label="Nome da escola"
            value={nomeEscola}
            maxLength={50}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNomeEscola(e.target.value)}
          />
          <TextField
            label="Caso de uso escolar"
            placeholder="ex.: catraca com reconhecimento facial"
            value={casoContextual}
            maxLength={120}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setCasoContextual(e.target.value)
            }
          />
          <TextField
            label="Foco prioritário de governança"
            placeholder="ex.: privacidade dos dados de presença"
            value={focoPrioritario}
            maxLength={120}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFocoPrioritario(e.target.value)
            }
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void gerar()}
            isDisabled={gerando || casoContextual.trim().length < 3}
            data-acao="gerar-conteudo"
          >
            {gerando ? "Gerando…" : "Gerar proposta com IA"}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void homologar()}
            isDisabled={salvando}
            data-acao="aprovar-turma"
          >
            {salvando ? "Aprovando…" : "Aprovar Conteúdo da Turma"}
          </Button>
        </div>

        {aviso && <FeedbackAlert type="success" description={aviso} />}
        {erro && <FeedbackAlert type="error" description={erro} />}

        {/*
          O preview em `Collapse`, fechado por padrão: são sete textos longos, e
          abertos eles empurram a folha da turma para fora da tela no meio da
          aula. O `Collapse` do DS tem a armadilha registrada na app-92 (o
          conteúdo fechado continua focável), e aqui ela é aceitável porque o
          conteúdo é um formulário do professor — não trinta alvos numa tela de
          criança. Se o pacote publicar a correção, isto some sozinho.
        */}
        <Collapse title="Revisar os três questionamentos e as quatro cláusulas">
          <div className="flex flex-col gap-5 pt-2">
            {pacote.prompts.map((p, i) => (
              <div key={p.id} className="flex flex-col gap-2">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-unooria-neutral-500">
                  Questionamento {i + 1} · {p.rotuloBotao}
                </p>
                <TextArea
                  label="O que o estudante envia"
                  value={p.textoPrompt}
                  rows={2}
                  maxLength={300}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    trocarPrompt(i, "textoPrompt", e.target.value)
                  }
                />
                <TextArea
                  label="A resposta da máquina (o estudante só a vê depois de perguntar)"
                  value={p.replicaIa}
                  rows={3}
                  maxLength={600}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    trocarPrompt(i, "replicaIa", e.target.value)
                  }
                />
              </div>
            ))}

            {pacote.clausulas.map((c, i) => (
              <div key={c.id} className="flex flex-col gap-2">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-unooria-neutral-500">
                  Cláusula {i + 1}
                </p>
                <TextField
                  label="Título"
                  value={c.tituloClausula}
                  maxLength={80}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    trocarClausula(i, "tituloClausula", e.target.value)
                  }
                />
                <TextArea
                  label="O artigo, como entra no manifesto"
                  value={c.artigoTexto}
                  rows={3}
                  maxLength={600}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    trocarClausula(i, "artigoTexto", e.target.value)
                  }
                />
                {/* Material de mediação: o estudante nunca o vê, e é o que
                    você usa no debate se a turma travar nesta cláusula. */}
                <p className="text-[12px] leading-snug text-unooria-neutral-600">
                  <strong>Para o debate:</strong> {c.justificativaSugerida}
                </p>
              </div>
            ))}
          </div>
        </Collapse>
      </div>
    </Card>
  );
}
