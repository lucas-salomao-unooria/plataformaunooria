"use client";

import { useRef, useState } from "react";

/**
 * O cadastro de interesse do site público (ADR-107).
 *
 * A MARCAÇÃO é a do material aprovado, campo por campo e classe por classe: o
 * `site.css` estiliza pelo `.registration-form`, pelos `.form-field` e pelo
 * `.is-success`, e qualquer liberdade aqui aparece como defeito de layout.
 *
 * O que mudou foi o DESTINO. No bundle original o formulário postava em
 * `/api/cadastro`, servido por um Worker que escrevia direto num SQLite (D1) de
 * fora da plataforma. Aqui ele posta em `/api/cadastro-de-interesse`, rota do
 * próprio hub, que repassa à api — que é quem valida, cobra a cota e escreve no
 * Postgres. O caminho é o mesmo de todo o resto: o navegador nunca fala com a
 * api direto, e nenhum banco novo entra na arquitetura.
 *
 * SEM SESSÃO, de propósito: quem preenche isto é um visitante. É a segunda rota
 * do hub que vale sem cookie (a primeira é o sinal de navegador da ADR-84), e a
 * defesa dela não é papel — é o Zod, a cota por IP e o campo-armadilha.
 */

/** O campo `website` é invisível e some do foco: robô preenche, gente não. */
const ARMADILHA = "website";

const AVISO_DE_SUCESSO = "Cadastro enviado. A equipe da Unooria entrará em contato.";
const AVISO_GENERICO = "Não foi possível enviar agora. Tente novamente.";

export function FormularioDeCadastro() {
  const form = useRef<HTMLFormElement>(null);
  const [estado, setEstado] = useState<"pronto" | "enviando" | "enviado">("pronto");
  const [aviso, setAviso] = useState("");

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!form.current?.reportValidity()) return;

    setEstado("enviando");
    setAviso("");

    const campos = new FormData(form.current);
    const texto = (nome: string) => String(campos.get(nome) ?? "");
    try {
      const resposta = await fetch("/api/cadastro-de-interesse", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
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
      const corpo = await resposta.json().catch(() => ({}) as { mensagem?: string });
      if (!resposta.ok) throw new Error(corpo.mensagem || "Não foi possível enviar agora.");

      form.current.reset();
      setEstado("enviado");
      setAviso(AVISO_DE_SUCESSO);
    } catch (erro) {
      /* Volta ao estado inicial — botão habilitado e com o rótulo de origem —
         porque o erro aqui é quase sempre rede: quem tentar de novo consegue. */
      setEstado("pronto");
      setAviso(erro instanceof Error ? erro.message : AVISO_GENERICO);
    }
  }

  return (
    <form
      ref={form}
      className={`registration-form reveal${estado === "enviado" ? " is-success" : ""}`}
      id="registration-form"
      method="post"
      action="/api/cadastro-de-interesse"
      onSubmit={enviar}
    >
      <div className="form-trap" aria-hidden="true">
        <label htmlFor="lead-website">Website</label>
        <input id="lead-website" name={ARMADILHA} tabIndex={-1} autoComplete="off" />
      </div>
      <div className="form-field form-wide">
        <label htmlFor="lead-name">Nome</label>
        <input id="lead-name" name="nome" autoComplete="name" required />
      </div>
      <div className="form-field">
        <label htmlFor="lead-email">E-mail profissional</label>
        <input id="lead-email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="form-field">
        <label htmlFor="lead-phone">Telefone / WhatsApp</label>
        <input id="lead-phone" name="telefone" type="tel" autoComplete="tel" required />
      </div>
      <div className="form-field">
        <label htmlFor="lead-organization">Rede, secretaria ou escola</label>
        <input id="lead-organization" name="organizacao" autoComplete="organization" required />
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
        <input type="checkbox" name="consentimento" required /> Autorizo o contato da Unooria sobre o ENTRE REDES.
      </label>
      <button className="button light form-wide" type="submit" disabled={estado !== "pronto"}>
        {estado === "pronto" ? (
          <>
            Enviar cadastro{" "}
            <span className="arrow" aria-hidden="true">
              →
            </span>
          </>
        ) : estado === "enviando" ? (
          "Enviando…"
        ) : (
          "Cadastro enviado"
        )}
      </button>
      <p className="form-status form-wide" id="registration-status" role="status" aria-live="polite">
        {aviso}
      </p>
    </form>
  );
}
