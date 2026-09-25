"use client";

import { dataCurta } from "@edu/sdk";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import {
  Button,
  EmptyState,
  FeedbackAlert,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Snackbar,
} from "@edu/ui/ds";
import {
  computadoresPadrao,
  corpoParaSalvar,
  problemasAntesDeSalvar,
  rascunhoDasSalvas,
  rascunhoDaSugestao,
  rascunhoDaUltima,
  turmaInteira,
  type EquipesDaMissao,
  type ModoDeMontagem,
  type RascunhoDeEquipes,
  type SugestaoDeEquipes,
  type UltimasEquipes,
} from "@/lib/equipes";

import { CartoesDasEquipes } from "./cartoes-das-equipes";
import { EditarEquipes } from "./editar-equipes";
import { MontarEquipes, type EscolhaDeMontagem } from "./montar-equipes";
import { MostrarEquipes } from "./mostrar-equipes";

type Erro = { titulo: string; mensagem: string; itens?: string[]; conflito?: boolean };

/** As entradas da última sugestão, para o "Sortear de novo" repetir as mesmas. */
type Entradas = { computadores: number; ausentes: string[] };

const SEM_REDE = "Não deu para falar com a plataforma. Confira a conexão e tente de novo.";

function mensagemDoCorpo(corpo: unknown, padrao: string): string {
  const mensagem = (corpo as { mensagem?: unknown } | null)?.mensagem;
  return typeof mensagem === "string" && mensagem ? mensagem : padrao;
}

/**
 * EQUIPES NA MISSÃO (E13): a seção da ficha, na turma que a sala mandou.
 *
 * Três estados, e nenhum é uma rota: VER (há equipes salvas), MONTAR (não há,
 * ou o professor pediu para refazer) e EDITAR (um rascunho — da sugestão da
 * api, das salvas ou da última missão). Tudo é client-side porque acontece na
 * frente da sala; as chamadas passam pelo BFF, e a guarda de papel é da api.
 *
 * Depois de salvar ou desfazer, a tela usa a resposta da própria chamada E
 * chama `router.refresh()`: a resposta põe a tela certa na hora, e a releitura
 * do servidor mantém verdadeiro o que mais depende disso.
 */
export function SecaoEquipes({
  turmaId,
  expId,
  inicial,
  podeEditar,
  ultima,
  tituloDaUltima,
}: {
  turmaId: string;
  expId: string;
  inicial: EquipesDaMissao;
  /** Só o professor escreve. A coordenação lê (e a api recusaria o resto). */
  podeEditar: boolean;
  ultima: UltimasEquipes | null;
  tituloDaUltima: string | null;
}) {
  const router = useRouter();

  /* O `router.refresh()` entrega um `inicial` novo; a tela passa a mostrá-lo.
     É o ajuste de estado DURANTE o render que o React recomenda para prop que
     muda — um `useEffect` desenharia a versão velha antes. */
  const [dados, setDados] = useState(inicial);
  const [inicialVisto, setInicialVisto] = useState(inicial);
  if (inicial !== inicialVisto) {
    setInicialVisto(inicial);
    setDados(inicial);
  }

  const [montando, setMontando] = useState(false);
  const [rascunho, setRascunho] = useState<RascunhoDeEquipes | null>(null);
  const [entradas, setEntradas] = useState<Entradas | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<Erro | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [mostrando, setMostrando] = useState(false);
  const [confirmandoDesfazer, setConfirmandoDesfazer] = useState(false);
  /* O `Modal` do DS não liga o `ModalTitle` ao diálogo sozinho: sem isto a
     confirmação fica sem nome acessível (ver `mostrar-equipes.tsx`). */
  const idDoTituloDesfazer = useId();

  const turma = useMemo(() => turmaInteira(dados), [dados]);
  const problemas = useMemo(() => (rascunho ? problemasAntesDeSalvar(rascunho.equipes) : []), [rascunho]);
  const base = `/api/plataforma/equipes/turma/${encodeURIComponent(turmaId)}/missao/${encodeURIComponent(expId)}`;
  const { montagem } = dados;

  if (!podeEditar) {
    return montagem ? (
      <CartoesDasEquipes equipes={dados.equipes} semEquipe={dados.semEquipe} ausentes={montagem.ausentes} />
    ) : (
      <EmptyState variant="no-data" size="sm" bordered fullWidth title="Nenhuma equipe montada para esta turma." />
    );
  }

  async function pedirSugestao(modo: ModoDeMontagem, computadores: number, ausentes: string[]) {
    setOcupado(true);
    setErro(null);
    try {
      const resposta = await fetch(`${base}/sugestao`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ modo, computadores, ausentes }),
      });
      const corpo: unknown = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        setErro({
          titulo: "Não deu para montar as equipes",
          mensagem: mensagemDoCorpo(corpo, "A plataforma recusou o pedido. Tente de novo."),
        });
        return;
      }
      setRascunho(rascunhoDaSugestao(corpo as SugestaoDeEquipes, ausentes, turma));
      setEntradas({ computadores, ausentes });
      setMontando(false);
    } catch {
      setErro({ titulo: "Não deu para montar as equipes", mensagem: SEM_REDE });
    } finally {
      setOcupado(false);
    }
  }

  function continuar(escolha: EscolhaDeMontagem, computadores: number, ausentes: string[]) {
    if (escolha === "ultima") {
      if (!ultima) return;
      setErro(null);
      setRascunho(rascunhoDaUltima(ultima, ausentes, turma));
      setEntradas(null);
      setMontando(false);
      return;
    }
    void pedirSugestao(escolha, computadores, ausentes);
  }

  function editarSalvas() {
    setErro(null);
    setRascunho(rascunhoDasSalvas(dados));
    setEntradas(montagem ? { computadores: montagem.computadores, ausentes: montagem.ausentes } : null);
  }

  function cancelar() {
    setErro(null);
    setRascunho(null);
    setMontando(false);
  }

  async function salvar() {
    if (!rascunho || problemas.length > 0) return;
    setOcupado(true);
    setErro(null);
    try {
      const resposta = await fetch(base, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpoParaSalvar(rascunho, montagem?.versao ?? 0)),
      });
      const corpo: unknown = await resposta.json().catch(() => null);
      if (resposta.status === 409) {
        /* Outra aba (ou o colega da turma) salvou antes. Sobrescrever calado
           apagaria o que o outro fez; o professor recarrega e decide. */
        setErro({
          titulo: "Estas equipes mudaram em outro lugar",
          mensagem: mensagemDoCorpo(corpo, "Alguém salvou equipes para esta turma enquanto você editava."),
          conflito: true,
        });
        return;
      }
      if (!resposta.ok) {
        const itens = (corpo as { erros?: unknown } | null)?.erros;
        setErro({
          titulo: "A plataforma não aceitou as equipes",
          mensagem: mensagemDoCorpo(corpo, "Confira as equipes e tente de novo."),
          itens: Array.isArray(itens) ? itens.filter((i): i is string => typeof i === "string") : undefined,
        });
        return;
      }
      setDados(corpo as EquipesDaMissao);
      setRascunho(null);
      setMontando(false);
      setAviso("Equipes salvas.");
      router.refresh();
    } catch {
      setErro({ titulo: "Não deu para salvar", mensagem: SEM_REDE });
    } finally {
      setOcupado(false);
    }
  }

  async function desfazer() {
    setOcupado(true);
    setErro(null);
    try {
      const resposta = await fetch(base, { method: "DELETE" });
      if (!resposta.ok) {
        const corpo: unknown = await resposta.json().catch(() => null);
        setErro({ titulo: "Não deu para desfazer", mensagem: mensagemDoCorpo(corpo, "Tente de novo.") });
        return;
      }
      setDados({ ...dados, montagem: null, equipes: [], semEquipe: turma });
      setConfirmandoDesfazer(false);
      setRascunho(null);
      setMontando(false);
      setAviso("Equipes desfeitas.");
      router.refresh();
    } catch {
      setErro({ titulo: "Não deu para desfazer", mensagem: SEM_REDE });
    } finally {
      setOcupado(false);
    }
  }

  function recarregar() {
    setErro(null);
    setRascunho(null);
    setMontando(false);
    router.refresh();
  }

  const nEquipes = dados.equipes.length;

  return (
    <div className="flex flex-col gap-4">
      {aviso ? <Snackbar severity="success" title={aviso} onClose={() => setAviso(null)} /> : null}

      {erro ? (
        <FeedbackAlert
          type={erro.conflito ? "warning" : "error"}
          title={erro.titulo}
          description={erro.mensagem}
          action={
            erro.conflito ? (
              <Button variant="secondary" size="sm" onClick={recarregar}>
                Recarregar
              </Button>
            ) : undefined
          }
        >
          {erro.itens && erro.itens.length > 0 ? (
            <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px]">
              {erro.itens.map((item, indice) => (
                <li key={`${indice}-${item}`}>{item}</li>
              ))}
            </ul>
          ) : null}
        </FeedbackAlert>
      ) : null}

      {rascunho ? (
        <EditarEquipes
          rascunho={rascunho}
          onMudar={setRascunho}
          problemas={problemas}
          ocupado={ocupado}
          onSalvar={() => void salvar()}
          onCancelar={cancelar}
          onSortearDeNovo={
            rascunho.modo === "sorteio" && entradas
              ? () => void pedirSugestao("sorteio", entradas.computadores, entradas.ausentes)
              : undefined
          }
        />
      ) : montando || !montagem ? (
        <MontarEquipes
          /* Remonta a cada entrada no formulário: o "Refazer" começa do que
             está salvo, não do que ficou na tela da última vez. */
          key={`${montagem?.versao ?? 0}-${montando ? "refazer" : "nova"}`}
          expId={expId}
          turma={turma}
          computadoresIniciais={computadoresPadrao(turma.length || dados.estudantes, montagem?.computadores)}
          ausentesIniciais={montagem?.ausentes ?? []}
          ultima={ultima}
          tituloDaUltima={tituloDaUltima}
          ocupado={ocupado}
          podeCancelar={Boolean(montagem)}
          onContinuar={continuar}
          onCancelar={cancelar}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[14px] text-unooria-neutral-700">
              {nEquipes === 1 ? "1 equipe" : `${nEquipes} equipes`} ·{" "}
              {montagem.modo === "sorteio" ? "sorteadas" : "separadas uma a uma"} · salvas em{" "}
              {dataCurta(montagem.atualizadoEm)}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="sm" onClick={() => setMostrando(true)}>
                Mostrar equipes
              </Button>
              <Button variant="secondary" size="sm" onClick={editarSalvas}>
                Editar equipes
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setMontando(true)}>
                Refazer
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmandoDesfazer(true)}>
                Desfazer equipes
              </Button>
            </div>
          </div>
          <CartoesDasEquipes equipes={dados.equipes} semEquipe={dados.semEquipe} ausentes={montagem.ausentes} />
        </div>
      )}

      <MostrarEquipes
        aberto={mostrando}
        onFechar={() => setMostrando(false)}
        equipes={dados.equipes}
        semEquipe={dados.semEquipe}
      />

      <Modal
        isOpen={confirmandoDesfazer}
        onClose={() => (ocupado ? undefined : setConfirmandoDesfazer(false))}
        size="sm"
        theme="light"
        aria-labelledby={idDoTituloDesfazer}
      >
        <ModalHeader showCloseButton={false}>
          <ModalTitle id={idDoTituloDesfazer}>Desfazer as equipes?</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <p className="text-[14px] text-unooria-neutral-700">
            As equipes desta missão nesta turma deixam de existir. Dá para montar de novo quando quiser.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" size="md" isDisabled={ocupado} onClick={() => setConfirmandoDesfazer(false)}>
            Cancelar
          </Button>
          <Button variant="danger" size="md" isDisabled={ocupado} isLoading={ocupado} onClick={() => void desfazer()}>
            Sim, desfazer
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
