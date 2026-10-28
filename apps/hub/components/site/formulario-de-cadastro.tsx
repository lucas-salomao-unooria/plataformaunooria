"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  type RefObject,
} from "react";

/**
 * O cadastro de interesse do site público (ADR-107), numa JANELA.
 *
 * Até 2026-09-17 o formulário ficava aberto no fim da página; depois passou a
 * morar num `<dialog>`. Na versão final do material (2026-10-28) sobrou UM
 * convite, o do fechamento (`#contato`) — o do cabeçalho e a seção `#cadastro`
 * saíram do desenho.
 *
 * TRÊS PEÇAS, porque o convite e a janela moram em pontos diferentes da
 * árvore: o convite dentro de `.closing-side`, a janela depois do `</main>`,
 * como no material. Pôr a janela ao lado do convite faria a regra
 * `.closing-side .button` do pacote esticar os botões do formulário. O que as
 * duas dividem — "já enviou?" e onde está a confirmação — vem do
 * `ProvedorDoCadastro`.
 *
 * A MARCAÇÃO DO FORMULÁRIO continua a do material aprovado, campo por campo e
 * classe por classe: o `site.css` estiliza pelo `.registration-form`, pelos
 * `.form-field` e pelo `.is-success`. O que a janela acrescentou está num bloco
 * marcado no fim da folha, e reaproveita o que os outros dois diálogos do site
 * já usam (`dialog`, `.dialog-top`, `.close-button`, `.button.outline`).
 *
 * QUEM ABRE A JANELA É O `efeitos/navegacao.ts`, não este componente: os outros
 * dois diálogos da página já são operados por ele, e é de lá que vêm o Esc, o
 * clique fora, o `[data-close]` e o `locked` do `<body>`. Este componente só a
 * FECHA, no sucesso do envio — a janela é dele, o teclado é do site.
 *
 * O DESTINO é a api. No bundle original o formulário postava em `/api/cadastro`,
 * servido por um Worker que escrevia direto num SQLite (D1) de fora da
 * plataforma. Aqui ele posta em `/api/cadastro-de-interesse`, rota do próprio
 * hub, que repassa à api — que valida, cobra a cota e escreve no Postgres.
 *
 * SEM SESSÃO, de propósito: quem preenche isto é um visitante. É a segunda rota
 * do hub que vale sem cookie (a primeira é o sinal de navegador da ADR-84), e a
 * defesa dela não é papel — é o Zod, a cota por IP e o campo-armadilha.
 */

/** O campo `website` é invisível e some do foco: robô preenche, gente não. */
const ARMADILHA = "website";

const AVISO_DE_SUCESSO =
  "Cadastro enviado. A equipe da Unooria entrará em contato.";
const AVISO_GENERICO = "Não foi possível enviar agora. Tente novamente.";

/**
 * O id da janela e o atributo que a abre. Exportados porque quem os usa está em
 * TRÊS arquivos: a marcação estática (`site-entre-redes.tsx`), o módulo que liga
 * os botões (`efeitos/navegacao.ts`) e este componente. Literal repetido nos
 * três é o caminho curto para um botão que não abre nada e não avisa.
 */
export const ID_DA_JANELA = "cadastro-dialog";
export const ATRIBUTO_DE_ABERTURA = "data-abrir-cadastro";

/** O rótulo do convite que abre a janela. Um lugar só, pelo mesmo motivo. */
export const ROTULO_DO_CONVITE = "Quero conhecer a solução";

type Cadastro = {
  confirmado: boolean;
  setConfirmado: (valor: boolean) => void;
  confirmacao: RefObject<HTMLParagraphElement | null>;
};

const ContextoDoCadastro = createContext<Cadastro | null>(null);

function useCadastro(): Cadastro {
  const cadastro = useContext(ContextoDoCadastro);
  if (!cadastro)
    throw new Error(
      "ConviteDoCadastro e JanelaDoCadastro moram dentro do ProvedorDoCadastro.",
    );
  return cadastro;
}

/* DOIS estados, e não um com três valores: `envio` é do formulário (na
   janela); `confirmado` é da página (aqui). Com um só, reabrir a janela depois
   de um envio trazia o botão travado em "enviado", sem nada explicando. */
export function ProvedorDoCadastro({
  children,
}: {
  children: React.ReactNode;
}) {
  const [confirmado, setConfirmado] = useState(false);
  const confirmacao = useRef<HTMLParagraphElement>(null);
  return (
    <ContextoDoCadastro.Provider
      value={{ confirmado, setConfirmado, confirmacao }}
    >
      {children}
    </ContextoDoCadastro.Provider>
  );
}

/** O convite do fechamento — e, depois do envio, a confirmação no lugar dele. */
export function ConviteDoCadastro() {
  const { confirmado, confirmacao } = useCadastro();
  const abertura = { [ATRIBUTO_DE_ABERTURA]: "" };
  if (confirmado) {
    return (
      <p
        className="form-status"
        id="cadastro-confirmado"
        role="status"
        aria-live="polite"
        ref={confirmacao}
      >
        {AVISO_DE_SUCESSO}
      </p>
    );
  }
  return (
    <button
      className="button light"
      type="button"
      aria-haspopup="dialog"
      aria-controls={ID_DA_JANELA}
      {...abertura}
    >
      {ROTULO_DO_CONVITE}{" "}
      <span className="arrow" aria-hidden="true">
        →
      </span>
    </button>
  );
}

export function JanelaDoCadastro() {
  const { setConfirmado, confirmacao } = useCadastro();
  const janela = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const [envio, setEnvio] = useState<"pronto" | "enviando">("pronto");
  const [aviso, setAviso] = useState("");

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!form.current?.reportValidity()) return;

    setEnvio("enviando");
    setAviso("");

    const campos = new FormData(form.current);
    const texto = (nome: string) => String(campos.get(nome) ?? "");
    try {
      const resposta = await fetch("/api/cadastro-de-interesse", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          nome: texto("nome"),
          email: texto("email"),
          telefone: texto("telefone"),
          organizacao: texto("organizacao"),
          cargo: texto("cargo"),
          consentimento: campos.get("consentimento") === "on",
          [ARMADILHA]: texto(ARMADILHA),
        }),
      });
      const corpo = await resposta
        .json()
        .catch(() => ({}) as { mensagem?: string });
      if (!resposta.ok)
        throw new Error(corpo.mensagem || "Não foi possível enviar agora.");

      form.current.reset();
      setEnvio("pronto");
      setConfirmado(true);
      setAviso("");
      /* Fecha a janela e deixa a confirmação na PÁGINA. Mantê-la aberta com um
         "enviado" dentro obrigaria a pessoa a fechar algo que já não tem o que
         fazer; fechá-la sem deixar rastro nenhum apagaria a única prova de que
         o envio funcionou. */
      janela.current?.close();
      /* E leva a pessoa até a confirmação, se ela ficou fora da tela (a página
         pode ter rolado por trás da janela): o fechamento sozinho pareceria
         "sumiu e não aconteceu nada". */
      requestAnimationFrame(() => {
        const alvo = confirmacao.current;
        if (!alvo) return;
        const caixa = alvo.getBoundingClientRect();
        if (caixa.top < 0 || caixa.bottom > innerHeight) {
          const suave = !matchMedia("(prefers-reduced-motion: reduce)").matches;
          alvo.scrollIntoView({
            block: "center",
            behavior: suave ? "smooth" : "auto",
          });
        }
      });
    } catch (erro) {
      /* A JANELA FICA ABERTA no erro, e o botão volta a funcionar: é aqui que a
         pessoa corrige o campo ou tenta de novo. Fechar levaria embora o que ela
         acabou de digitar. */
      setEnvio("pronto");
      setAviso(erro instanceof Error ? erro.message : AVISO_GENERICO);
    }
  }

  return (
    <dialog
      ref={janela}
      id={ID_DA_JANELA}
      className="form-dialog"
      aria-labelledby="cadastro-dialog-titulo"
    >
      <div className="dialog-top">
        <span className="eyebrow" id="cadastro-dialog-titulo">
          Cadastro de interesse
        </span>
        <button
          className="close-button"
          type="button"
          data-close
          aria-label="Fechar o cadastro"
        >
          ×
        </button>
      </div>
      <p className="form-intro">
        Preencha os dados para receber uma apresentação do ENTRE REDES e
        entender como a solução pode contribuir com a sua rede.
      </p>
      <form
        ref={form}
        className="registration-form"
        id="registration-form"
        method="post"
        action="/api/cadastro-de-interesse"
        onSubmit={enviar}
      >
        <div className="form-trap" aria-hidden="true">
          <label htmlFor="lead-website">Website</label>
          <input
            id="lead-website"
            name={ARMADILHA}
            tabIndex={-1}
            autoComplete="off"
          />
        </div>
        <div className="form-field form-wide">
          <label htmlFor="lead-name">Nome</label>
          <input id="lead-name" name="nome" autoComplete="name" required />
        </div>
        <div className="form-field">
          <label htmlFor="lead-email">E-mail profissional</label>
          <input
            id="lead-email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </div>
        <div className="form-field">
          <label htmlFor="lead-phone">Telefone / WhatsApp</label>
          <input
            id="lead-phone"
            name="telefone"
            type="tel"
            autoComplete="tel"
            required
          />
        </div>
        <div className="form-field">
          <label htmlFor="lead-organization">Rede, secretaria ou escola</label>
          <input
            id="lead-organization"
            name="organizacao"
            autoComplete="organization"
            required
          />
        </div>
        <div className="form-field">
          <label htmlFor="lead-role">Seu cargo</label>
          <select id="lead-role" name="cargo" required defaultValue="">
            <option value="">Selecione</option>
            <option>Gestão de rede ou secretaria</option>
            <option>Direção ou coordenação escolar</option>
            <option>Professor</option>
            <option>Mantenedor</option>
            <option>Outro</option>
          </select>
        </div>
        <label className="form-consent form-wide">
          <input type="checkbox" name="consentimento" required /> Autorizo o
          contato da Unooria sobre o ENTRE REDES.
        </label>
        {/* ACRÉSCIMO ao porte (H11.2.1): fora do `<label>`, para o clique no
              link não marcar a caixa; e em outra aba, para não perder o que a
              pessoa já digitou. A frase do aceite NÃO muda — ela é gravada com o
              cadastro (`TEXTO_DO_CONSENTIMENTO`, na api). */}
        <p className="form-privacidade form-wide">
          Como a Unooria trata estes dados:{" "}
          <a href="/privacidade" target="_blank" rel="noopener">
            Política de Privacidade
          </a>
          .
        </p>
        <div className="form-acoes form-wide">
          {/* `outline` é a variante que o próprio material já traz: a ação de
                sair não pode ter o mesmo peso visual da de enviar. */}
          <button
            className="button outline"
            type="button"
            data-close
            disabled={envio === "enviando"}
          >
            Cancelar
          </button>
          <button
            className="button light"
            type="submit"
            disabled={envio === "enviando"}
          >
            {envio === "pronto" ? (
              <>
                Enviar cadastro{" "}
                <span className="arrow" aria-hidden="true">
                  →
                </span>
              </>
            ) : (
              "Enviando…"
            )}
          </button>
        </div>
        <p
          className="form-status form-wide"
          id="registration-status"
          role="status"
          aria-live="polite"
        >
          {aviso}
        </p>
      </form>
    </dialog>
  );
}
