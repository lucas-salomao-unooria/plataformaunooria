import {
  Controller,
  Get,
  HttpException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { escolaAlvo } from "../comum/escola-alvo";
import { rateLimit } from "../comum/rate-limit";
import { Contrato } from "../openapi/contrato";
import { ARQUIVOS_ONEROSTER, type ArquivoOneRoster } from "./catalogo";
import {
  ArquivoOneRosterParam,
  ContasDeAssentoSchema,
  CsvSchema,
  EscolaAlvoQuery,
  ImportarQuery,
  OneRosterQuery,
  RelatorioDeImportacaoSchema,
} from "./contrato-de-rotas";
import { OneRosterService } from "./oneroster.service";
import { exemploOneRoster, modeloOneRoster } from "./modelos-oneroster";
import { exemploPreenchido, modeloEmBranco } from "./planilha";
import { MAX_LINHAS, TETO_DO_ARQUIVO, TETO_EM_MB, RosteringService } from "./rostering.service";

interface RespostaHttp {
  setHeader(nome: string, valor: string): void;
}

/**
 * Fronteira de entrada de pessoas e turmas. Só gestor (própria escola) e
 * admin-contrato (qualquer escola, via `?escolaId=`).
 */
@Controller("rostering")
@UseGuards(OidcGuard, RolesGuard)
@Roles("gestor", "admin-contrato")
export class RosteringController {
  constructor(
    private readonly rostering: RosteringService,
    private readonly oneroster: OneRosterService,
  ) {}

  /**
   * O modelo em branco. Gerado da MESMA constante que o leitor consome — um
   * modelo escrito à mão divergiria do parser no primeiro campo novo, e o
   * sintoma seria "importei o modelo de vocês e deu erro de cabeçalho".
   */
  @Get("modelos/usuarios.csv")
  @Contrato({
    resumo: "O modelo em branco da planilha de pessoas.",
    descricao:
      "Gerado da MESMA constante que o leitor consome — um modelo escrito à mão divergiria do parser no primeiro campo novo, e o sintoma seria \"importei o modelo de vocês e deu erro de cabeçalho\".",
    resposta: CsvSchema,
    tipoDaResposta: "text/csv",
    notas: ["Sai com BOM e `charset=utf-8`: um sem o outro ainda quebra acento em alguma planilha."],
  })
  modelo(@Res({ passthrough: true }) res: RespostaHttp): string {
    return this.comoCsv(res, "modelo-usuarios.csv", modeloEmBranco());
  }

  @Get("modelos/exemplo.csv")
  @Contrato({
    resumo: "O mesmo modelo, preenchido com um exemplo.",
    resposta: CsvSchema,
    tipoDaResposta: "text/csv",
  })
  exemplo(@Res({ passthrough: true }) res: RespostaHttp): string {
    return this.comoCsv(res, "exemplo-usuarios.csv", exemploPreenchido());
  }

  /**
   * O modelo em branco de UM arquivo do binding CSV — o par do
   * `modelos/usuarios.csv`, para quem monta o lote à mão. As colunas saem da
   * mesma constante que o leitor confere.
   */
  @Get("modelos/oneroster/:arquivo")
  @Contrato({
    resumo: "O modelo em branco de um arquivo do OneRoster 1.2.",
    descricao:
      "Só o cabeçalho, na grafia do padrão. É um SUBCONJUNTO das colunas que a api sabe ler — as que ela ignora ficam de fora, porque modelo com 24 colunas não é modelo, é a especificação.",
    params: ArquivoOneRosterParam,
    resposta: CsvSchema,
    tipoDaResposta: "text/csv",
    notas: ["Modelo e exemplo são arquivos SEPARADOS: linha de exemplo dentro do modelo vira pessoa fantasma importada no primeiro uso."],
  })
  modeloOneRoster(@Param("arquivo") arquivo: string, @Res({ passthrough: true }) res: RespostaHttp): string {
    const alvo = this.arquivoValido(arquivo);
    return this.comoCsv(res, `${alvo}.csv`, modeloOneRoster(alvo));
  }

  /**
   * O mesmo arquivo, preenchido com um lote pequeno e coerente: uma escola, um
   * ano letivo, duas turmas, quatro pessoas e o enturmamento delas. Enviado na
   * ordem da tela, ele passa inteiro — é assim que o gestor confere o caminho
   * antes de mandar a rede.
   */
  @Get("modelos/oneroster/:arquivo/exemplo")
  @Contrato({
    resumo: "O mesmo arquivo do OneRoster, preenchido com um exemplo.",
    descricao:
      "Gerado com a escola de VERDADE no `sourcedId` do `orgs.csv` e no `schoolSourcedId` das turmas: um id fictício faria o lote voltar como \"escola não é a desta importação\" para o gestor e, para o `admin-contrato` (que PODE criar escola por CSV), abriria um tenant de mentira.",
    params: ArquivoOneRosterParam,
    query: EscolaAlvoQuery,
    resposta: CsvSchema,
    tipoDaResposta: "text/csv",
  })
  async exemploOneRoster(
    @Param("arquivo") arquivo: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: { auth: AuthClaims },
    @Res({ passthrough: true }) res: RespostaHttp,
  ): Promise<string> {
    const alvo = this.arquivoValido(arquivo);
    const ctx = await this.rostering.contextoDeExemplo(escolaAlvo(req.auth, escolaIdPedida));
    return this.comoCsv(res, `exemplo-${alvo}.csv`, exemploOneRoster(alvo, ctx));
  }

  /** O nome do arquivo é vocabulário fechado — 404 seria mentir sobre a rota. */
  private arquivoValido(arquivo: string): ArquivoOneRoster {
    const limpo = arquivo.replace(/\.csv$/i, "");
    if (!(ARQUIVOS_ONEROSTER as readonly string[]).includes(limpo)) {
      throw new HttpException(
        { mensagem: `arquivo desconhecido — use um de: ${ARQUIVOS_ONEROSTER.join(", ")}` },
        400,
      );
    }
    return limpo as ArquivoOneRoster;
  }

  private comoCsv(res: RespostaHttp, arquivo: string, conteudo: string): string {
    // BOM + charset: um sem o outro ainda quebra acento em alguma planilha.
    res.setHeader("content-type", "text/csv; charset=utf-8");
    res.setHeader("content-disposition", `attachment; filename="${arquivo}"`);
    return `﻿${conteudo}`;
  }

  /** Corpo: o CSV cru (`Content-Type: text/csv`). */
  @Post("importar")
  @Contrato({
    resumo: "Importa a planilha de pessoas.",
    descricao:
      "Corpo é o **CSV cru** (`Content-Type: text/csv`), até 30MB. Uma linha por pessoa, cabeçalho lido por NOME (ordem livre): `matricula,nome,usuario,email,papel,turma,serie,turno`. Só `nome` e `papel` são obrigatórios — aluno também exige `turma` e `serie`.\n\nIdempotente: a chave é a MATRÍCULA da pessoa na rede e, na falta dela, o login.",
    query: ImportarQuery,
    corpo: CsvSchema,
    tipoDoCorpo: "text/csv",
    resposta: RelatorioDeImportacaoSchema,
    notas: [
      "**O CPF é a primeira chave**: achado em outra escola da rede, a linha vira transferência (aluno) ou lotação a mais (professor).",
      "Reimportar NÃO reseta a senha de quem já entrou — seria trancar a escola inteira para fora.",
      "Coluna desconhecida é ERRO, não coluna ignorada.",
      "5 importações por minuto por usuário (429); acima de 30MB ou 50k linhas, 400 — o teto cabe debaixo dos 32 MiB do Cloud Run, para o 413 do ambiente nunca ser o que o gestor vê.",
    ],
  })
  async importar(
    @Query() query: Record<string, string>,
    @Req() req: { auth: AuthClaims; body: unknown },
  ) {
    const q = ImportarQuery.parse(query);
    const escolaId = escolaAlvo(req.auth, q.escolaId);

    const cota = rateLimit(`importar:${req.auth.usuarioId}`, 5, 60_000);
    if (!cota.ok) throw new HttpException("Muitas importações — aguarde um minuto", 429);

    if (typeof req.body !== "string" || req.body.length === 0) {
      throw new HttpException({ mensagem: "Envie o CSV cru no corpo com Content-Type: text/csv" }, 400);
    }
    if (req.body.length > TETO_DO_ARQUIVO) {
      throw new HttpException(
        { mensagem: `CSV acima de ${TETO_EM_MB}MB — divida o arquivo (máx. ${MAX_LINHAS} linhas)` },
        400,
      );
    }

    return this.rostering.importarPlanilha(escolaId, req.body, {
      senhaPadrao: q.senhaPadrao,
      gerarSenhas: q.gerarSenhas === "1",
    });
  }

  /**
   * Binding CSV do OneRoster 1.2 — UM arquivo por chamada, nesta ordem:
   * `manifest`, `orgs`, `academicSessions`, `classes`, `users`, `enrollments`,
   * `roles`. Fora de ordem não corrompe nada: a linha que referencia
   * `sourcedId` inexistente volta no relatório dizendo qual arquivo falta.
   */
  @Post("oneroster/:arquivo")
  @Contrato({
    resumo: "Binding CSV do OneRoster 1.2 — UM arquivo por chamada.",
    descricao:
      "Ordem: `manifest`, `orgs`, `academicSessions`, `classes`, `users`, `enrollments`, `roles`. **Fora de ordem não corrompe nada**: a linha que aponta para um `sourcedId` inexistente volta no relatório dizendo QUAL arquivo falta.\n\nO padrão vive só nesta fronteira: nada do domínio conhece `sourcedId`.",
    params: ArquivoOneRosterParam,
    query: OneRosterQuery,
    corpo: CsvSchema,
    tipoDoCorpo: "text/csv",
    resposta: RelatorioDeImportacaoSchema,
    notas: [
      "`orgs.csv` só APRENDE o código INEP desta escola: escola é *tenant*, não nasce de upload. Criar escola por CSV é só `admin-contrato`.",
      "Sem a coluna `role` (que saiu de `users.csv` na 1.2) a pessoa entra como **aluno**, o menor privilégio; o `roles.csv` corrige.",
      "A coluna `password` do padrão é IGNORADA, e a contagem vai ao relatório.",
      "Em `bulk`, ausência de linha **não desativa ninguém** — é contada em `candidatosAInativacao`: lote que chegou pela metade não pode apagar uma rede por omissão.",
      "`status = tobedeleted` desativa (pessoa) ou encerra (matrícula), nunca apaga.",
    ],
  })
  async oneRoster(
    @Param("arquivo") arquivo: string,
    @Query() query: Record<string, string>,
    @Req() req: { auth: AuthClaims; body: unknown },
  ) {
    const q = OneRosterQuery.parse(query);
    const escolaId = escolaAlvo(req.auth, q.escolaId);

    const alvo = this.arquivoValido(arquivo);

    const cota = rateLimit(`oneroster:${req.auth.usuarioId}`, 20, 60_000);
    if (!cota.ok) throw new HttpException("Muitas importações — aguarde um minuto", 429);

    if (typeof req.body !== "string" || req.body.length === 0) {
      throw new HttpException({ mensagem: "Envie o CSV cru no corpo com Content-Type: text/csv" }, 400);
    }
    if (req.body.length > TETO_DO_ARQUIVO) {
      throw new HttpException({ mensagem: `CSV acima de ${TETO_EM_MB}MB — divida o arquivo` }, 400);
    }

    return this.oneroster.importar(escolaId, alvo, req.body, {
      modo: q.modo,
      senhaPadrao: q.senhaPadrao,
      gerarSenhas: q.gerarSenhas === "1",
      // Escola é tenant: só o admin do contrato abre inquilino novo por CSV.
      podeCriarEscola: req.auth.perfil === "admin-contrato",
    });
  }

  /** Diagnóstico das contas sem matrícula da rede (as que podem ser de assento). */
  @Get("contas-de-assento")
  @Contrato({
    resumo: "As contas sem matrícula da rede — as que podem ser de assento.",
    descricao:
      "As experiências vieram de projetos onde a conta era do APARELHO: outra turma reusava o mesmo login. Esta lista mostra quanto cada conta acumulou de dado, para o gestor decidir o que desativar.",
    query: z.object({ escolaId: z.string().optional() }),
    resposta: ContasDeAssentoSchema,
    notas: [
      "**Não existe fundir contas**: juntar duas move o que uma criança fez para outra pessoa, e depois ninguém audita de quem era.",
      "Teto de 200 linhas, dito na resposta em `truncado` em vez de cortado em silêncio.",
    ],
  })
  async contasDeAssento(@Query("escolaId") escolaIdPedida: string | undefined, @Req() req: { auth: AuthClaims }) {
    return this.rostering.contasDeAssento(escolaAlvo(req.auth, escolaIdPedida));
  }
}
