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
import { podeCriarPapel, papeisQueCria} from "../src/usuarios/regras";

describe("podeCriarPapel", () => {
  it("gestor da escola cria as pessoas DA ESCOLA — e não outra coordenação", () => {
    expect(podeCriarPapel("gestor_escola", "estudante")).toBe(true);
    expect(podeCriarPapel("gestor_escola", "professor")).toBe(true);
    /* Isto MUDOU com a ADR-80, e é aperto, não regressão: quem atribui a
       coordenação de uma escola é o `gestor_regional`. Antes um gestor criava
       outro gestor, e o alcance da unidade se propagava sem ninguém acima
       decidir. */
    expect(podeCriarPapel("gestor_escola", "gestor_escola")).toBe(false);
  });

  it("gestor da escola NÃO cria papel de rede — o alcance é decisão de quem está acima", () => {
    expect(podeCriarPapel("gestor_escola", "gestor_regional")).toBe(false);
    expect(podeCriarPapel("gestor_escola", "gestor_contrato")).toBe(false);
    expect(podeCriarPapel("gestor_escola", "admin")).toBe(false);
  });

  it("gestor do contrato alcança tudo abaixo dele, e nada no nível dele", () => {
    for (const papel of ["estudante", "professor", "gestor_escola", "gestor_regional"] as const) {
      expect(podeCriarPapel("gestor_contrato", papel)).toBe(true);
    }
    /* Também MUDOU: quem atribui `gestor_contrato` é a Unooria (`admin`). Um
       papel que se autoatribui não tem quem o conceda — e o alcance dele é a
       rede inteira de um contrato. */
    expect(podeCriarPapel("gestor_contrato", "gestor_contrato")).toBe(false);
    expect(podeCriarPapel("gestor_contrato", "admin")).toBe(false);
  });

  it("estudante e professor não criam ninguém", () => {
    for (const autor of ["estudante", "professor"] as const) {
      for (const papel of ["estudante", "professor", "gestor_escola", "gestor_contrato"] as const) {
        expect(podeCriarPapel(autor, papel)).toBe(false);
      }
    }
  });
});

describe("planilhaDeUmaPessoa", () => {
  it("escreve o cabeçalho do modelo, na ordem da constante que o leitor consome", () => {
    const [cabecalho] = planilhaDeUmaPessoa({ nome: "Ana", papel: "gestor_escola" }).split("\n");
    expect(cabecalho).toBe(COLUNAS_MODELO.join(","));
  });

  it("campo ausente vira célula vazia, não coluna a menos", () => {
    const linhas = parseCsv(planilhaDeUmaPessoa({ nome: "Ana Lima", papel: "gestor_escola" }));
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
    expect(leitura.pessoas[0]!.papel).toBe("gestor_escola");
  });

  it("devolve o erro NO CAMPO quando o CPF tem dígito trocado", () => {
    const leitura = lerPlanilha(
      planilhaDeUmaPessoa({ nome: "Ana Lima", papel: "gestor_escola", cpf: "111.111.111-11" }),
    );
    expect(leitura.erros.map((e) => e.campo)).toContain("cpf");
  });
});

/**
 * A CADEIA DE ATRIBUIÇÃO (ADR-80): cada nível atribui o de baixo.
 *
 *   admin → gestor_contrato → gestor_regional → gestor_escola → professor/estudante
 *
 * O que estes casos protegem é a direção. A regra é uma tabela pequena e o
 * alcance sai do fechamento transitivo dela — o risco não é a tabela estar
 * errada, é alguém "otimizar" o fechamento para uma lista escrita à mão e a
 * lista divergir para o lado que dá acesso a mais.
 */
describe("cadeia de atribuição de papéis", () => {
  test("cada nível atribui o de baixo, e não o de cima", () => {
    expect(podeCriarPapel("admin", "gestor_contrato")).toBe(true);
    expect(podeCriarPapel("gestor_contrato", "gestor_regional")).toBe(true);
    expect(podeCriarPapel("gestor_regional", "gestor_escola")).toBe(true);
    expect(podeCriarPapel("gestor_escola", "professor")).toBe(true);
    expect(podeCriarPapel("gestor_escola", "estudante")).toBe(true);

    // Para cima, nunca.
    expect(podeCriarPapel("gestor_contrato", "gestor_contrato")).toBe(false);
    expect(podeCriarPapel("gestor_contrato", "admin")).toBe(false);
    expect(podeCriarPapel("gestor_regional", "gestor_regional")).toBe(false);
    expect(podeCriarPapel("gestor_regional", "gestor_contrato")).toBe(false);
    expect(podeCriarPapel("gestor_escola", "gestor_escola")).toBe(false);
    expect(podeCriarPapel("gestor_escola", "gestor_regional")).toBe(false);
  });

  test("o alcance é TRANSITIVO: quem atribui o regional atribui o que ele atribui", () => {
    /* Não é frouxidão: quem cria um `gestor_regional` cria, por definição,
       alguém que cria `gestor_escola`. Recusar o atalho não protegeria nada e
       transformaria toda operação de balcão numa corrente de telefonemas. */
    expect(podeCriarPapel("gestor_contrato", "gestor_escola")).toBe(true);
    expect(podeCriarPapel("gestor_contrato", "professor")).toBe(true);
    expect(podeCriarPapel("gestor_regional", "estudante")).toBe(true);
    expect(podeCriarPapel("admin", "estudante")).toBe(true);
  });

  test("estudante e professor não atribuem ninguém", () => {
    expect(papeisQueCria("estudante")).toEqual([]);
    expect(papeisQueCria("professor")).toEqual([]);
  });

  test("`gestor_escola` alcança só os papéis de dentro da escola", () => {
    expect([...papeisQueCria("gestor_escola")].sort()).toEqual(["estudante", "professor"]);
  });
});
