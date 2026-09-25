import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { GESTORES } from "../auth/claims";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { FORMATO_DO_EXP_ID } from "../comum/codigo-da-experiencia";
import { escolaAlvo } from "../comum/escola-alvo";
import { professorDoToken } from "../comum/turmas-do-professor";
import { Contrato } from "../openapi/contrato";
import {
  EquipesDaMissaoSchema,
  ExpId,
  ParamsDaMissaoSchema,
  PedidoDeSugestaoSchema,
  QueryDaEscolaSchema,
  RemovidaSchema,
  SalvarMontagemSchema,
  SugestaoSchema,
  UltimaMontagemSchema,
  Uuid,
} from "./contrato-de-rotas";
import { EquipesService } from "./equipes.service";

type Autenticado = { auth: AuthClaims };

/** Os dois parâmetros de toda rota daqui, validados — 400 com a causa dita. */
function daMissao(turmaId: string, expId: string): { turmaId: string; expId: string } {
  if (!Uuid.safeParse(turmaId).success) throw new BadRequestException({ mensagem: "turmaId inválido" });
  const id = ExpId.safeParse(expId);
  if (!id.success) throw new BadRequestException({ mensagem: FORMATO_DO_EXP_ID });
  return { turmaId, expId: id.data };
}

/**
 * AS EQUIPES, do lado de quem dá aula (E13, ADR-111).
 *
 * Gestor e admin LEEM as equipes; quem MONTA é só quem tem matrícula de
 * professor na turma — a mesma distinção da liberação (ADR-69): administrar a
 * escola não é dar a aula. Por isso `@Roles` por MÉTODO, e não na classe: a
 * leitura é a única rota com os gestores.
 *
 * Os caminhos começam em `turma/`, e a rota do estudante é a literal `minha`:
 * prefixos distintos de propósito, para a ordem de registro dos controllers
 * não decidir quem responde (a armadilha que `/turmas/minhas` documenta).
 */
@Controller("equipes")
@UseGuards(OidcGuard, RolesGuard)
export class EquipesProfessorController {
  constructor(private readonly equipes: EquipesService) {}

  @Get("turma/:turmaId/missao/:expId")
  @Roles("professor", ...GESTORES)
  @Contrato({
    resumo: "As equipes de uma missão nesta turma: a montagem, as equipes e quem está sem equipe.",
    descricao:
      "Equipe é quem DIVIDE UM COMPUTADOR na missão. `semEquipe` são os estudantes da turma fora de qualquer equipe — os ausentes da montagem inclusive.\n\nMissão que não aceita equipe responde **200** com `permitida: false` e listas vazias, e não 400: é por esta resposta que o hub decide se desenha o bloco de equipes.",
    params: ParamsDaMissaoSchema,
    query: QueryDaEscolaSchema,
    resposta: EquipesDaMissaoSchema,
    notas: [
      "Turma em que o professor não tem matrícula responde **404**, não 403: um \"sem permissão\" já contaria que a turma existe.",
      "Gestor e admin leem a escola inteira, de propósito — e não montam.",
      "Membro que saiu da turma não aparece: a fonte dos estudantes é `users.turma_id`, a mesma dos painéis de missão.",
    ],
  })
  ler(
    @Param("turmaId") turmaId: string,
    @Param("expId") expId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    const alvo = daMissao(turmaId, expId);
    return this.equipes.daMissao(
      escolaAlvo(req.auth, escolaIdPedida),
      alvo.turmaId,
      alvo.expId,
      professorDoToken(req.auth),
    );
  }

  /**
   * `POST` que NÃO cria nada, daí o `@HttpCode(200)`: é uma proposta calculada
   * sobre a turma de agora. Quem grava é o `PUT`.
   */
  @Post("turma/:turmaId/missao/:expId/sugestao")
  @HttpCode(200)
  @Roles("professor")
  @Contrato({
    resumo: "Uma proposta de equipes (sorteio ou N equipes vazias) — nunca grava.",
    descricao:
      "`sorteio` distribui os presentes (a turma menos `ausentes`) por `computadores` equipes de tamanhos que diferem em no máximo 1. `manual` devolve N equipes VAZIAS e todos os presentes em `semEquipe`, para o professor arrastar.\n\nSe a missão tem lados (o Instanooria), o sorteio evita juntar os dois lados na mesma tela e conta em `agrupamento.equipesMistas` quando a aritmética não fecha. Sem fonte de lado, `agrupamento` volta `null`.",
    params: ParamsDaMissaoSchema,
    query: QueryDaEscolaSchema,
    corpo: PedidoDeSugestaoSchema,
    resposta: SugestaoSchema,
    notas: [
      "Missão que não aceita equipe responde **400** `missao-sem-equipes`.",
      "Com mais computadores que presentes, cada criança fica numa equipe só dela — é a sala com um computador por estudante.",
      "Ausente que não é da turma é ignorado aqui; o `PUT` o recusa.",
    ],
  })
  sugerir(
    @Param("turmaId") turmaId: string,
    @Param("expId") expId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Body() corpo: unknown,
    @Req() req: Autenticado,
  ) {
    const alvo = daMissao(turmaId, expId);
    const pedido = PedidoDeSugestaoSchema.parse(corpo);
    return this.equipes.sugerir(
      escolaAlvo(req.auth, escolaIdPedida),
      alvo.turmaId,
      alvo.expId,
      pedido,
      req.auth.usuarioId,
    );
  }

  @Get("turma/:turmaId/missao/:expId/ultima")
  @Roles("professor")
  @Contrato({
    resumo: "As equipes da última missão desta turma, reprojetadas sobre a turma de hoje.",
    descricao:
      "A montagem mais recente da MESMA turma em OUTRA missão com equipe. Quem saiu da turma cai (e é contado em `saidas`), equipe que ficou vazia some, e quem chegou depois fica em `semEquipe`. Os ausentes de lá não vêm: falta é da aula.\n\nSem montagem anterior, `origem` volta `null` e todos os estudantes em `semEquipe`. Nada é gravado.",
    params: ParamsDaMissaoSchema,
    query: QueryDaEscolaSchema,
    resposta: UltimaMontagemSchema,
    notas: ["Missão que não aceita equipe responde **400** `missao-sem-equipes`."],
  })
  ultima(
    @Param("turmaId") turmaId: string,
    @Param("expId") expId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    const alvo = daMissao(turmaId, expId);
    return this.equipes.ultima(
      escolaAlvo(req.auth, escolaIdPedida),
      alvo.turmaId,
      alvo.expId,
      req.auth.usuarioId,
    );
  }

  /**
   * SALVAR. `PUT` porque o efeito é o estado final inteiro — a troca é
   * completa, e repetir o mesmo corpo com a versão nova dá no mesmo.
   */
  @Put("turma/:turmaId/missao/:expId")
  @Roles("professor")
  @Contrato({
    resumo: "Grava a montagem inteira das equipes desta missão, com concorrência otimista.",
    descricao:
      "**Só quem tem matrícula de professor na turma.** Troca a montagem INTEIRA: as equipes anteriores saem e as do corpo entram, na ordem em que vieram.\n\n`versao` é a versão em que a tela se baseou (`0` quando não havia montagem). Versão velha responde **409** com `versaoAtual` — o computador da sala e o celular do professor salvando ao mesmo tempo não se sobrescrevem em silêncio.",
    params: ParamsDaMissaoSchema,
    query: QueryDaEscolaSchema,
    corpo: SalvarMontagemSchema,
    resposta: EquipesDaMissaoSchema,
    notas: [
      "Montagem impossível responde **400** `montagem-invalida` com `erros`: a lista INTEIRA, em frases para o professor — membro ou ausente de fora da turma, estudante em duas equipes, ausente dentro de equipe, nome vazio, repetido (sem distinguir maiúsculas) ou com mais de 30 caracteres, equipe sem ninguém, nenhuma equipe.",
      "Missão que não aceita equipe responde **400** `missao-sem-equipes`; fora do catálogo, **404**; ferramenta de professor, **403**; recurso desligado na rede, **403** `recurso-indisponivel`.",
    ],
  })
  salvar(
    @Param("turmaId") turmaId: string,
    @Param("expId") expId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Body() corpo: unknown,
    @Req() req: Autenticado,
  ) {
    const alvo = daMissao(turmaId, expId);
    const dados = SalvarMontagemSchema.parse(corpo);
    return this.equipes.salvar(
      escolaAlvo(req.auth, escolaIdPedida),
      alvo.turmaId,
      alvo.expId,
      dados,
      req.auth.usuarioId,
    );
  }

  @Delete("turma/:turmaId/missao/:expId")
  @Roles("professor")
  @Contrato({
    resumo: "Desfaz as equipes desta missão na turma.",
    descricao:
      "A montagem sai, e as equipes e os membros caem junto. **Idempotente**: apagar o que não existe devolve o mesmo `ok`.",
    params: ParamsDaMissaoSchema,
    query: QueryDaEscolaSchema,
    resposta: RemovidaSchema,
    notas: [
      "Sem checagem de catálogo nem de disponibilidade: desfazer é sempre seguro, e missão desligada na rede não pode deixar equipes presas.",
    ],
  })
  desfazer(
    @Param("turmaId") turmaId: string,
    @Param("expId") expId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    const alvo = daMissao(turmaId, expId);
    return this.equipes.desfazer(
      escolaAlvo(req.auth, escolaIdPedida),
      alvo.turmaId,
      alvo.expId,
      req.auth.usuarioId,
    );
  }
}
