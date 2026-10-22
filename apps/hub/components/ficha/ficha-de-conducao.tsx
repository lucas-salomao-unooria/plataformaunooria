import "./ficha.css";

import Link from "next/link";
import type { ReactNode } from "react";

import { Badge, FeedbackAlert, Icon, Tag } from "@edu/ui/ds";
import { AbasDaPagina, type AbaDaPagina } from "@/components/abas-da-pagina";
import { LinkButton } from "@/components/link-button";
import type { AtoDaMissao, FichaDaMissao } from "@/lib/entre-redes/catalogo";

/**
 * O TEMPLATE da ficha da missão — a tela em que o professor cai ao apertar
 * "Conduzir com esta turma" (ADR-100). Toda missão, inclusive a próxima, monta
 * a ficha por aqui (ADR-182); o corpo de cada missão (`missao-<slug>.tsx`)
 * só diz o que é DELA: o aviso que decide a aula, o que a missão esconde do
 * estudante e o bloco de condução (as atividades da turma ou a tela da aula).
 *
 * **A ordem é a do trabalho, não a da leitura.** Antes, a ficha abria com o
 * resumo, a competência, o formato, os atos, o preparo e o segredo — 900 a
 * 1.500 palavras — e só no fim chegava ao que o professor veio fazer: escolher
 * a atividade e pô-la no ar. Agora:
 *
 * 1. o cabeçalho curto (o que é, quanto dura, o guia a um clique);
 * 2. o aviso que decide a aula — UM, porque três faixas coloridas não são lidas;
 * 3. a CONDUÇÃO: as atividades da turma, ou o caminho para a aula;
 * 4. "Conhecer a missão", em abas — como funciona, antes de rodar, o que ela
 *    não conta, competência e formato. Nada saiu; o que é consulta deixou de
 *    empurrar o que é ação para fora da tela.
 */

export interface AvisoDaFicha {
  tipo: "info" | "warning" | "error";
  titulo: string;
  texto: string;
}

export function FichaDeConducao({
  contexto,
  titulo,
  resumo,
  ficha,
  etiquetas = [],
  rotuloDisponivel = "Disponível",
  guia,
  acoes,
  aviso,
  conducao,
  segredo,
  abasExtras = [],
}: {
  /** "6º ano · Unidade 1" ou "Transversal". */
  contexto: string;
  titulo: string;
  resumo: string;
  ficha: FichaDaMissao;
  /** Etiquetas além da duração ("EM13CO24", "100% formativa, sem nota"). */
  etiquetas?: string[];
  rotuloDisponivel?: string;
  /** A rota do guia (de `rotaDoGuiaDaMissao`); `null` sem guia. */
  guia: string | null;
  /** Botões a mais no cabeçalho, ao lado do guia (a Vila tem "Ver resultados da turma"). */
  acoes?: ReactNode;
  aviso?: AvisoDaFicha;
  /** O que o professor veio fazer: `AtividadesDaMissao`, ou o cartão que leva à aula. */
  conducao: ReactNode;
  /** "O que a missão NÃO conta ao estudante" — prosa de cada missão. */
  segredo?: ReactNode;
  /** Abas próprias da missão, depois das do template (a Vila: para que serve, as três bolhas). */
  abasExtras?: AbaDaPagina[];
}) {
  const abas: AbaDaPagina[] = [
    {
      id: "como-funciona",
      rotulo: "Como funciona",
      icone: "route",
      conteudo: <Atos atos={ficha.atos} />,
    },
    {
      id: "antes-de-rodar",
      rotulo: "Antes de rodar",
      icone: "checklist",
      selo: ficha.preparo.length,
      conteudo: <Preparo passos={ficha.preparo} guia={guia} />,
    },
    ...(segredo
      ? [
          {
            id: "o-que-nao-conta",
            rotulo: "O que ela não conta",
            icone: "visibility_off",
            conteudo: (
              <section className="flex flex-col gap-3">
                <h3 className="text-[16px] font-bold text-unooria-neutral-950">O que a missão NÃO conta ao estudante</h3>
                <div className="ficha-segredo">{segredo}</div>
              </section>
            ),
          },
        ]
      : []),
    ...abasExtras,
    {
      id: "competencia",
      rotulo: "Competência e formato",
      icone: "school",
      conteudo: (
        <dl className="ficha-sobre">
          <div>
            <dt>O que a missão trabalha</dt>
            <dd>{ficha.competencia}</dd>
          </div>
          <div>
            <dt>Formato</dt>
            <dd>{ficha.formato}</dd>
          </div>
          <div>
            <dt>Duração</dt>
            <dd>{ficha.duracao}</dd>
          </div>
        </dl>
      ),
    },
  ];

  return (
    <div className="ficha flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success">{rotuloDisponivel}</Badge>
          <span className="text-[13px] font-semibold text-unooria-neutral-500">{contexto}</span>
        </div>
        <h1 className="text-[26px] font-bold leading-tight text-unooria-neutral-950">{titulo}</h1>
        <p className="max-w-3xl text-[15px] leading-relaxed text-unooria-neutral-700">{resumo}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Tag variant="neutral" size="sm" pill leftIcon="schedule">
            {ficha.duracao}
          </Tag>
          {etiquetas.map((etiqueta) => (
            <Tag key={etiqueta} variant="neutral" size="sm" pill>
              {etiqueta}
            </Tag>
          ))}
        </div>
        {guia || acoes ? (
          <div className="flex flex-wrap gap-3 pt-1">
            {guia ? (
              <LinkButton href={guia} variant="secondary">
                Abrir guia da aula
              </LinkButton>
            ) : null}
            {acoes}
          </div>
        ) : null}
      </header>

      {aviso ? <FeedbackAlert type={aviso.tipo} title={aviso.titulo} description={aviso.texto} /> : null}

      <div className="ficha-conducao">{conducao}</div>

      <section className="flex flex-col gap-4" aria-labelledby="ficha-conhecer">
        <div className="flex flex-col gap-1">
          <h2 id="ficha-conhecer" className="text-[18px] font-bold text-unooria-neutral-950">
            Conhecer a missão
          </h2>
          <p className="text-[13px] text-unooria-neutral-500">
            Como ela acontece, o que preparar e o que ela esconde da turma. O passo a passo da aula está no guia.
          </p>
        </div>
        <AbasDaPagina abas={abas} rotulo="Conhecer a missão" prefixo="ficha" />
      </section>
    </div>
  );
}

/**
 * A turma que a ficha está conduzindo (ADR-100), numa linha. Era um
 * `FeedbackAlert` azul do tamanho do aviso da missão, logo acima dele: duas
 * faixas iguais seguidas, e a que decide a aula perdia o destaque para a que só
 * diz onde você está. Quem a monta continua sendo o DESPACHANTE (e a rota da
 * Vila), nunca o corpo da missão.
 */
export function FaixaDaTurma({ nome, descricao }: { nome: string; descricao: string }) {
  return (
    <div className="ficha-turma" data-faixa-da-turma>
      <Icon name="groups" size="m" color="var(--unooria-color-brandnavy-800, #49699f)" aria-hidden />
      <p className="text-[14px] leading-snug text-unooria-neutral-700">
        <strong className="text-unooria-neutral-950">Conduzindo com a turma {nome}</strong>
        <span className="ficha-turma__descricao"> {descricao}</span>
      </p>
    </div>
  );
}

/** Os atos como sequência — é a ordem em que a turma vive a missão. */
function Atos({ atos }: { atos: AtoDaMissao[] }) {
  return (
    <ol className="ficha-atos">
      {atos.map((ato, i) => (
        <li key={ato.rotulo} className="ficha-atos__item">
          <span className="ficha-atos__numero" aria-hidden>
            {i + 1}
          </span>
          <div className="flex flex-col gap-1">
            <strong className="text-[15px] font-semibold leading-snug text-unooria-neutral-950">
              {semNumero(ato.rotulo)}
            </strong>
            <p className="text-[14px] leading-relaxed text-unooria-neutral-700">{ato.texto}</p>
            {/* O caminho para FAZER o que o ato descreve (o Ato 1 do Unoovista manda jogar a Vila). */}
            {ato.link ? (
              <Link href={ato.link.href} className="text-[14px] font-semibold text-unooria-navy-900 underline">
                {ato.link.rotulo}
              </Link>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * O rótulo do catálogo já traz o número ("1 — A credencial de jurado",
 * "Ato 2 · O feed"). Com o círculo como marcador da sequência, o prefixo
 * numérico sairia em dobro; o resto do rótulo fica como está.
 */
export function semNumero(rotulo: string): string {
  return rotulo.replace(/^\s*(?:Ato\s+)?\d+\s*[—–\-·.:]\s*/i, "");
}

function Preparo({ passos, guia }: { passos: string[]; guia: string | null }) {
  return (
    <div className="flex flex-col gap-4">
      <ol className="ficha-preparo">
        {passos.map((passo, i) => (
          <li key={passo}>
            <span className="ficha-atos__numero" aria-hidden>
              {i + 1}
            </span>
            <span>{passo}</span>
          </li>
        ))}
      </ol>
      {guia ? (
        <p className="flex items-center gap-1.5 text-[13px] text-unooria-neutral-500">
          <Icon name="menu_book" size="s" color="var(--unooria-color-neutral-500, #6b7785)" aria-hidden />
          <span>
            O preparo completo, técnico e pedagógico, está no{" "}
            <Link href={`${guia}#preparar`} className="font-semibold text-unooria-navy-900 underline">
              tempo Preparar do guia
            </Link>
            .
          </span>
        </p>
      ) : null}
    </div>
  );
}
