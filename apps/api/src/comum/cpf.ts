/**
 * CPF como identidade IMUTÁVEL do estudante na rede.
 *
 * É o identificador que o padrão nacional do MEC adota (Portaria 269/2026,
 * EducaDados) e o único dado que sobrevive à troca de nome, de login, de
 * matrícula e de escola — é ele que faz uma criança transferida ser reconhecida
 * como a mesma pessoa em vez de nascer de novo com o histórico partido.
 *
 * O NÚMERO É GUARDADO (decisão de produto, ADR-33). O gestor precisa vê-lo: ele
 * confere identidade contra o sistema da rede, preenche documento e atende a
 * família no balcão. CPF é dado pessoal comum — não do art. 11 da LGPD —, com
 * base legal clara num contrato de educação pública, e é o que todo sistema de
 * gestão escolar brasileiro guarda.
 *
 * O que NÃO acontece com ele, e é o que sustenta a decisão:
 *  · nunca sai em log (nem em mensagem de erro);
 *  · nunca entra em telemetria, JSONB, claim de token ou bundle de experiência;
 *  · nunca existe fora de `users.cpf` — há teste estrutural cobrando isso;
 *  · só chega a gestor e admin-contrato, nas telas de cadastro.
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

/** `000.000.000-00` — como o CPF se lê em qualquer documento brasileiro. */
export function formatarCpf(bruto: string): string {
  const cpf = digitosDoCpf(bruto);
  if (cpf.length !== 11) return bruto;
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}
