import { createHmac } from "node:crypto";

/**
 * CPF como identidade IMUTÁVEL do estudante na rede.
 *
 * É o identificador que o padrão nacional do MEC adota (Portaria 269/2026,
 * EducaDados) e o único dado que sobrevive à troca de nome, de login, de
 * matrícula e de escola. É também o dado pessoal mais sensível que esta
 * plataforma toca.
 *
 * DECISÃO: o banco guarda o HASH, nunca o número. `HMAC-SHA256(cpf, pepper)`
 * dá tudo o que precisamos dele — unicidade na rede, reconhecer a mesma criança
 * numa transferência entre escolas, e busca (basta hashear o que o gestor
 * digitou) — sem transformar o banco num acervo de CPF de menores de idade. O
 * que fica em claro são os TRÊS últimos dígitos, para o gestor confirmar na tela
 * que é a pessoa certa.
 *
 * A pimenta vem de `CPF_PEPPER` e é do contrato. Sem ela não há hash: a
 * importação recusa a coluna com mensagem explícita em vez de guardar o número.
 */

/** Só os dígitos — o gestor cola com ponto e traço. */
export function digitosDoCpf(bruto: string): string {
  return bruto.replace(/\D/g, "");
}

/**
 * Valida os dois dígitos verificadores (módulo 11).
 *
 * Não é preciosismo: CPF digitado errado numa planilha de 10 mil linhas cria uma
 * identidade fantasma que NUNCA vai casar com a da rede — e o erro só aparece
 * meses depois, quando a criança se transfere e vira uma segunda pessoa.
 */
export function cpfEhValido(bruto: string): boolean {
  const cpf = digitosDoCpf(bruto);
  if (cpf.length !== 11) return false;
  // Sequências iguais (111.111.111-11) passam no módulo 11 e não são CPF.
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digito = (ate: number): number => {
    let soma = 0;
    for (let i = 0; i < ate; i += 1) soma += Number(cpf[i]) * (ate + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}

/** Últimos três dígitos — o que a tela mostra para confirmação humana. */
export function finalDoCpf(bruto: string): string {
  return digitosDoCpf(bruto).slice(-3);
}

export class PimentaAusente extends Error {
  constructor() {
    super(
      "CPF_PEPPER não configurada: a coluna cpf não é aceita. Sem a pimenta o " +
        "número teria de ser guardado em claro, e isso não acontece.",
    );
  }
}

/**
 * Hash determinístico do CPF. Determinístico de propósito — é o que permite
 * procurar e reconhecer a mesma pessoa; um sal por linha (bcrypt) tornaria o
 * campo inútil como identidade.
 */
export function hashDoCpf(bruto: string, pimenta: string | undefined): string {
  if (!pimenta) throw new PimentaAusente();
  return createHmac("sha256", pimenta).update(digitosDoCpf(bruto)).digest("hex");
}
