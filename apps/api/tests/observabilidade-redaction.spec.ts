import { CHAVES_REDIGIDAS, MARCA, redigirObjeto, redigirTexto } from "../src/observabilidade/redaction";

/**
 * Prova de pronto da fase 1 do cap. 17: a regra 6 (nada de PII em log) é
 * MECÂNICA. Quem escreve `logger.info({ usuario })` não precisa lembrar de
 * nada — o CPF e o username saem redigidos por construção.
 */
describe("redigirObjeto", () => {
  it("redige por nome de chave em qualquer profundidade", () => {
    const entrada = {
      usuario: { dados: { cpf: "123.456.789-09", username: "maria.silva", nome: "Maria" } },
      escolaId: "esc-1",
    };
    const saida = redigirObjeto(entrada);
    expect(saida.usuario.dados.cpf).toBe(MARCA);
    expect(saida.usuario.dados.username).toBe(MARCA);
    expect(saida.usuario.dados.nome).toBe(MARCA);
    expect(saida.escolaId).toBe("esc-1");
  });

  it("não muta o objeto original", () => {
    const entrada = { token: "abc" };
    redigirObjeto(entrada);
    expect(entrada.token).toBe("abc");
  });

  it("atravessa arrays e ignora maiúsculas na chave", () => {
    const saida = redigirObjeto({ lista: [{ Authorization: "Bearer x" }, { EMAIL: "a@b.com" }] });
    expect(saida.lista[0]?.Authorization).toBe(MARCA);
    expect(saida.lista[1]?.EMAIL).toBe(MARCA);
  });

  it("não atravessa instâncias de classe (Date, Error) — só objeto simples", () => {
    const quando = new Date("2026-09-02T00:00:00Z");
    const err = new Error("boom");
    const saida = redigirObjeto({ quando, err });
    expect(saida.quando).toBe(quando);
    expect(saida.err).toBe(err);
  });

  it("para na profundidade máxima em vez de estourar a pilha", () => {
    type Aninhado = { filho?: Aninhado; v: number };
    let obj: Aninhado = { v: 0 };
    for (let i = 0; i < 20; i++) obj = { filho: obj, v: i };
    expect(() => redigirObjeto(obj)).not.toThrow();
    expect(JSON.stringify(redigirObjeto(obj))).toContain("[profundo]");
  });

  it("cobre as chaves que a doutrina lista", () => {
    for (const chave of ["authorization", "cookie", "token", "senha", "cpf", "username", "email", "nome", "texto", "mensagem", "transcricao", "observacao"]) {
      expect(CHAVES_REDIGIDAS.has(chave)).toBe(true);
    }
  });
});

describe("redigirTexto", () => {
  it("apaga e-mail, CPF (com e sem pontuação), Bearer e query string", () => {
    const texto =
      "user maria@escola.gov.br cpf 123.456.789-09 ou 12345678909 Bearer eyJhbGciOi.abc-def em /rota?cpf=1&token=2 fim";
    const saida = redigirTexto(texto);
    expect(saida).not.toContain("maria@");
    expect(saida).not.toContain("123.456.789-09");
    expect(saida).not.toContain("12345678909");
    expect(saida).not.toContain("eyJhbGciOi");
    expect(saida).not.toContain("cpf=1");
    expect(saida).toContain("fim");
  });

  it("deixa texto sem PII intacto", () => {
    const texto = "Token rejeitado: code=ERR_JWT_EXPIRED claim=exp";
    expect(redigirTexto(texto)).toBe(texto);
  });

  it("não confunde um timestamp em ms com CPF (11 dígitos colados a outros)", () => {
    // `\b` exige fronteira: 13 dígitos seguidos não casam o padrão de 11.
    expect(redigirTexto(`ts=${1756771200000}`)).toBe(`ts=${1756771200000}`);
  });
});
