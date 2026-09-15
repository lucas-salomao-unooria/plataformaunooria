/**
 * Modelo em branco e exemplo preenchido de CADA arquivo do binding CSV do
 * OneRoster 1.2 — o mesmo par que a planilha da escola já oferece
 * (`planilha.ts`), agora para quem monta o lote à mão ou precisa conferir o que
 * o sistema de gestão exportou.
 *
 * Duas disciplinas, herdadas do modelo da planilha:
 *
 * 1. **As colunas saem da mesma constante que o LEITOR consome.** O modelo
 *    lista um subconjunto de `COLUNAS_POR_ARQUIVO[arquivo].conhecidas`, e
 *    `tests/oneroster-modelos.spec.ts` cobra as duas direções: toda coluna
 *    obrigatória aparece no modelo, e nenhuma coluna do modelo é desconhecida
 *    do parser. Modelo escrito à mão divergiria no primeiro campo novo, e o
 *    sintoma seria "baixei o modelo de vocês e deu erro de cabeçalho".
 * 2. **Modelo e exemplo são arquivos SEPARADOS.** Linha de exemplo dentro do
 *    modelo vira pessoa fantasma importada no primeiro uso.
 *
 * O exemplo é gerado com a escola de VERDADE no `sourcedId` do `orgs.csv` e no
 * `schoolSourcedId` das turmas e matrículas. Um `esc.exemplo` fixo seria pior de
 * duas maneiras: para o gestor, todo o lote voltaria como "escola não é a desta
 * importação"; para o `gestor_contrato`, que PODE criar escola por CSV, o
 * exemplo abriria um tenant de mentira — com RLS e dados de menores atrás dele.
 */
import type { ArquivoOneRoster } from "./catalogo";

/**
 * As colunas de cada modelo, na grafia do padrão (`camelCase`). O leitor
 * normaliza o cabeçalho, então a grafia é didática, não requisito.
 *
 * É um SUBCONJUNTO do que sabemos ler: `dateLastModified` entra porque o padrão
 * a exige, `status` porque é ela que carrega o `tobedeleted`, e ficam de fora as
 * colunas que esta api ignora (`sms`, `phone`, `agentSourcedIds`…) — modelo com
 * 24 colunas não é modelo, é a especificação.
 */
export const COLUNAS_MODELO_ONEROSTER: Readonly<Record<ArquivoOneRoster, readonly string[]>> = {
  manifest: ["propertyName", "value"],
  orgs: ["sourcedId", "status", "dateLastModified", "name", "type", "identifier", "parentSourcedId"],
  academicSessions: [
    "sourcedId", "status", "dateLastModified", "title", "type",
    "startDate", "endDate", "parentSourcedId", "schoolYear",
  ],
  classes: [
    "sourcedId", "status", "dateLastModified", "title", "grades",
    "classCode", "classType", "schoolSourcedId", "termSourcedIds", "subjects",
  ],
  users: [
    "sourcedId", "status", "dateLastModified", "enabledUser", "username",
    "givenName", "middleName", "familyName", "identifier", "email",
    "role", "grades", "primaryOrgSourcedId", "metadata.br.cpf",
  ],
  enrollments: [
    "sourcedId", "status", "dateLastModified", "classSourcedId", "schoolSourcedId",
    "userSourcedId", "role", "primary", "beginDate", "endDate",
  ],
  roles: [
    "sourcedId", "status", "dateLastModified", "userSourcedId", "roleType",
    "role", "beginDate", "endDate", "orgSourcedId",
  ],
};

/** O que o exemplo precisa saber do mundo real para ser reenviável. */
export interface ContextoDoExemplo {
  escolaId: string;
  escolaNome: string;
  /** O INEP que a escola já tem; sem ele, o exemplo mostra o formato. */
  codigoInep: string | null;
  /** Ano do calendário do exemplo — o corrente, senão o arquivo envelhece. */
  ano: number;
}

/** Só o cabeçalho. É o arquivo que a escola preenche. */
export function modeloOneRoster(arquivo: ArquivoOneRoster): string {
  return `${COLUNAS_MODELO_ONEROSTER[arquivo].join(",")}\n`;
}

/**
 * Célula do padrão. O CSV do OneRoster é CSV comum: vírgula separa, aspas
 * escapam — e `subjects`/`termSourcedIds` são LISTAS dentro de uma célula, que
 * por isso vêm entre aspas.
 */
function celula(valor: string): string {
  return /[",\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

const linha = (...campos: string[]) => campos.map(celula).join(",");

/**
 * Um lote pequeno e COERENTE: uma escola, um ano letivo, duas turmas (a de
 * referência e uma de componente), quatro pessoas e o enturmamento delas.
 * Enviado na ordem da tela, ele passa inteiro — é assim que o gestor confere
 * que o caminho funciona antes de mandar a rede.
 *
 * Os `sourcedId` fictícios levam o prefixo `exemplo.` para não colidirem com os
 * do sistema de gestão e para serem reconhecíveis no banco depois.
 */
export function exemploOneRoster(arquivo: ArquivoOneRoster, ctx: ContextoDoExemplo): string {
  const { escolaId, escolaNome, ano } = ctx;
  const inep = ctx.codigoInep ?? "35000001";
  const modificado = `${ano}-02-01T08:00:00.000Z`;
  const inicio = `${ano}-02-01`;
  const anoLetivo = `exemplo.ano-${ano}`;
  const turma = "exemplo.turma-8a";
  const cabecalho = COLUNAS_MODELO_ONEROSTER[arquivo].join(",");

  const linhas: string[] = (() => {
    switch (arquivo) {
      /* Só declara o lote: nada é escrito no banco. Os valores de `file.*` são
         o modo de CADA arquivo — é o que o relatório devolve para o gestor
         conferir se o que ele vai enviar bate com o que o sistema exportou. */
      case "manifest":
        return [
          linha("manifest.version", "1.0"),
          linha("oneroster.version", "1.2"),
          linha("file.orgs", "bulk"),
          linha("file.academicSessions", "bulk"),
          linha("file.classes", "bulk"),
          linha("file.users", "bulk"),
          linha("file.enrollments", "bulk"),
          linha("file.roles", "bulk"),
        ];

      /* UMA linha, a desta escola: o arquivo só APRENDE o código INEP. Escola
         nova é ato de `gestor_contrato`, não de upload. */
      case "orgs":
        return [linha(escolaId, "active", modificado, escolaNome, "school", inep, "")];

      /* Um `schoolYear`. Os recortes (bimestre, semestre) são linhas a mais,
         com `type=gradingPeriod` — ficam fora do exemplo porque cada uma vira um
         período do CONTRATO, e um exemplo não deve mexer no calendário. */
      case "academicSessions":
        return [
          linha(
            anoLetivo, "active", modificado, `Ano Letivo ${ano}`, "schoolYear",
            inicio, `${ano}-12-18`, "", String(ano),
          ),
        ];

      /* `homeroom` é a turma de referência (a "8A"); `scheduled` é a de
         componente. `grades` vem no vocabulário do padrão: "08" é o 8º ano. */
      case "classes":
        return [
          linha(turma, "active", modificado, "8A", "08", "8A", "homeroom", escolaId, anoLetivo, ""),
          linha(
            `${turma}-mat`, "active", modificado, "8A - Matemática", "08", "MAT8A",
            "scheduled", escolaId, anoLetivo, "Matemática",
          ),
        ];

      /* A coluna `password` do padrão NÃO está aqui de propósito: ela é
         ignorada na leitura (ADR-29) e não faz sentido num modelo.
         `metadata.br.cpf` é a extensão brasileira — o CPF é a identidade que
         sobrevive à troca de nome, de login e de ESCOLA. */
      case "users":
        return [
          linha(
            "exemplo.u-2026001", "active", modificado, "true", "ana.ribeiro",
            "Ana", "Paula", "Ribeiro", "2026001", "ana.ribeiro@escola.exemplo",
            /* CPFs de exemplo ESCOLHIDOS para não colidir: `529.982.247-25` é o
               CPF de teste mais usado do país, e `users.cpf` é único por
               CONTRATO — não por escola. O exemplo é GRAVADO no banco de quem o
               aplica, então um CPF famoso aqui bate em qualquer fixture ou
               pessoa que já o carregue. Custou uma suíte intermitente:
               `rede-cpf-transferencia.spec.ts` usa aquele E o `045.833.259-32`
               do João, e as duas suítes rodam em paralelo. */
            "student", "08", escolaId, "868.419.502-75",
          ),
          linha(
            "exemplo.u-2026002", "active", modificado, "true", "joao.souza",
            "João", "Pedro", "Souza", "2026002", "",
            "student", "08", escolaId, "390.533.447-05",
          ),
          linha(
            "exemplo.u-1099", "active", modificado, "true", "marta.alves",
            "Marta", "Nunes", "Alves", "1099", "marta.alves@escola.exemplo",
            "teacher", "", escolaId, "",
          ),
          linha(
            "exemplo.u-1100", "active", modificado, "true", "carlos.dias",
            "Carlos", "Eduardo", "Dias", "1100", "",
            "principal", "", escolaId, "",
          ),
        ];

      /* `primary=true` é a matrícula de REFERÊNCIA do estudante — a que responde
         "de que turma ele é". Sem `endDate`: sair da turma é datar o fim, nunca
         apagar a linha. */
      case "enrollments":
        return [
          linha("exemplo.e-1", "active", modificado, turma, escolaId, "exemplo.u-2026001", "student", "true", inicio, ""),
          linha("exemplo.e-2", "active", modificado, turma, escolaId, "exemplo.u-2026002", "student", "true", inicio, ""),
          linha("exemplo.e-3", "active", modificado, turma, escolaId, "exemplo.u-1099", "teacher", "true", inicio, ""),
        ];

      /* Papel no nível da ESCOLA — o que corrige quem entrou como estudante por
         falta da coluna `role` em `users.csv`. Gestor mora aqui, não em
         `enrollments.csv`: ele vê a escola inteira sem estar em turma nenhuma. */
      case "roles":
        return [
          linha("exemplo.r-1", "active", modificado, "exemplo.u-1100", "primary", "principal", inicio, "", escolaId),
          linha("exemplo.r-2", "active", modificado, "exemplo.u-1099", "primary", "teacher", inicio, "", escolaId),
        ];
    }
  })();

  return `${[cabecalho, ...linhas].join("\n")}\n`;
}
