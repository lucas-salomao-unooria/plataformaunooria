/**
 * As duas peças puras do cadastro unitário: quem pode criar quem, e a linha de
 * planilha que o formulário monta.
 *
 * A segunda importa mais do que parece. O cadastro unitário existe porque a
 * ADR-59 escolheu delegar ao importador em vez de escrever direto em `users` —
 * e a ponte entre os dois é um CSV serializado. Escape de aspas errado aqui
 * não quebra o build nem o typecheck: ele grava um nome truncado, ou joga o
 * sobrenome na coluna do login, em silêncio. Daí a ida-e-volta pelo `parseCsv`
 * e pelo `lerPlanilha` de verdade, com os nomes que a vida real produz.
 */
import { COLUNAS_MODELO } from "../src/rostering/catalogo";
import { lerPlanilha, planilhaDeUmaPessoa } from "../src/rostering/planilha";
import { parseCsv } from "../src/usuarios/csv";
import { podeCriarPapel } from "../src/usuarios/regras";

describe("podeCriarPapel", () => {
  it("gestor cria estudante, professor e gestor", () => {
    expect(podeCriarPapel("gestor", "estudante")).toBe(true);
    expect(podeCriarPapel("gestor", "professor")).toBe(true);
    expect(podeCriarPapel("gestor", "gestor")).toBe(true);
  });

  it("gestor NÃO cria admin-contrato — o alcance da rede é decisão do contrato", () => {
    expect(podeCriarPapel("gestor", "admin-contrato")).toBe(false);
  });

  it("admin-contrato cria os quatro, inclusive outro admin-contrato", () => {
    for (const papel of ["estudante", "professor", "gestor", "admin-contrato"] as const) {
      expect(podeCriarPapel("admin-contrato", papel)).toBe(true);
    }
  });

  it("estudante e professor não criam ninguém", () => {
    for (const autor of ["estudante", "professor"] as const) {
      for (const papel of ["estudante", "professor", "gestor", "admin-contrato"] as const) {
        expect(podeCriarPapel(autor, papel)).toBe(false);
      }
    }
  });
});

describe("planilhaDeUmaPessoa", () => {
  it("escreve o cabeçalho do modelo, na ordem da constante que o leitor consome", () => {
    const [cabecalho] = planilhaDeUmaPessoa({ nome: "Ana", papel: "gestor" }).split("\n");
    expect(cabecalho).toBe(COLUNAS_MODELO.join(","));
  });

  it("campo ausente vira célula vazia, não coluna a menos", () => {
    const linhas = parseCsv(planilhaDeUmaPessoa({ nome: "Ana Lima", papel: "gestor" }));
    expect(linhas[1]).toHaveLength(COLUNAS_MODELO.length);
    expect(linhas[1]![COLUNAS_MODELO.indexOf("nome")]).toBe("Ana Lima");
    expect(linhas[1]![COLUNAS_MODELO.indexOf("turma")]).toBe("");
  });

  it("sobrevive a vírgula, aspas e quebra de linha no nome", () => {
    const nome = 'Souza, João "JP"\nRibeiro';
    const linhas = parseCsv(planilhaDeUmaPessoa({ nome, papel: "professor" }));
    expect(linhas).toHaveLength(2);
    expect(linhas[1]![COLUNAS_MODELO.indexOf("nome")]).toBe(nome);
  });

  it("o leitor da planilha entende a linha gerada — é a ponte do cadastro unitário", () => {
    const leitura = lerPlanilha(
      planilhaDeUmaPessoa({
        cpf: "529.982.247-25",
        matricula: "2026001",
        nome: "Ana Paula Ribeiro",
        email: "ana@escola.exemplo",
        papel: "estudante",
        turma: "8A",
        serie: "8EF",
        turno: "manha",
      }),
    );
    expect(leitura.erros).toHaveLength(0);
    expect(leitura.formato).toBe("modelo");
    expect(leitura.pessoas).toHaveLength(1);
    const pessoa = leitura.pessoas[0]!;
    // Sempre 2: cabeçalho + a única linha. É o que o mapeamento de erro assume.
    expect(pessoa.linha).toBe(2);
    expect(pessoa.cpf).toBe("52998224725");
    expect(pessoa.papel).toBe("estudante");
    expect(pessoa.serie).toBe("8EF");
    expect(pessoa.turno).toBe("manha");
  });

  it("normaliza o papel pelos sinônimos da rede — coordenação é gestor", () => {
    const leitura = lerPlanilha(planilhaDeUmaPessoa({ nome: "Carlos Dias", papel: "coordenacao" }));
    expect(leitura.erros).toHaveLength(0);
    expect(leitura.pessoas[0]!.papel).toBe("gestor");
  });

  it("devolve o erro NO CAMPO quando o CPF tem dígito trocado", () => {
    const leitura = lerPlanilha(
      planilhaDeUmaPessoa({ nome: "Ana Lima", papel: "gestor", cpf: "111.111.111-11" }),
    );
    expect(leitura.erros.map((e) => e.campo)).toContain("cpf");
  });
});
