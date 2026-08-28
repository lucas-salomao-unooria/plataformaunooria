import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { escolaAlvo } from "../comum/escola-alvo";
import { EscolasService } from "../rostering/escolas.service";
import { ArquivoSchema } from "./regras";
import { PortabilidadeService } from "./portabilidade.service";

type Autenticado = { auth: AuthClaims };

const UUID = z.string().uuid();

/**
 * O PERFIL PORTÁTIL: emitir o que a criança leva ao sair da rede, e receber o
 * que ela trouxe de outra.
 *
 * **Emitir é o direito do titular** (LGPD art.~18 V), exercido pela escola onde
 * ele está hoje. **Receber é ato da escola de destino** — ninguém empurra perfil
 * para dentro de uma rede; alguém de lá importa o arquivo, olhando para ele.
 *
 * A api NÃO assina: ela monta o documento e o hub assina, porque é o hub que tem
 * a chave e publica o JWKS. A api VERIFICA na entrada, porque verificar é o
 * passo que não pode confiar em quem chama.
 */
@Controller()
@UseGuards(OidcGuard, RolesGuard)
export class PortabilidadeController {
  constructor(
    private readonly portabilidade: PortabilidadeService,
    private readonly escolas: EscolasService,
  ) {}

  /**
   * O documento SEM assinatura, para o hub assinar e entregar.
   *
   * A mesma tranca de `GET /alunos/:id/historico`: quem pede precisa ter lotação
   * na escola onde a criança está HOJE. Emitir o histórico inteiro de uma criança
   * é leitura atravessada, e ela tem uma porta só, com dono.
   */
  @Get("alunos/:id/perfil-portatil")
  @Roles("gestor", "admin-contrato")
  async emitir(@Param("id") id: string, @Req() req: Autenticado) {
    if (!UUID.safeParse(id).success) throw new BadRequestException("id inválido");

    /* A MESMA tranca de `GET /alunos/:id/historico`, e de propósito: as duas
       leituras atravessam escolas, e quem responde pela criança é a unidade onde
       ela está hoje. */
    const historico = await this.escolas.historicoDoAluno(id);
    if (!historico) throw new NotFoundException("aluno não encontrado");
    if (req.auth.perfil !== "admin-contrato") {
      const escolaAtual = historico.escolas.find((e) => e.atual)?.id;
      const podeVer =
        escolaAtual !== undefined &&
        (await this.escolas.temLotacao(req.auth.usuarioId, escolaAtual));
      if (!podeVer) throw new ForbiddenException("este aluno não está numa escola sua");
    }

    const perfil = await this.portabilidade.montar(id);
    if (!perfil) {
      throw new BadRequestException(
        "sem CPF não há perfil portátil: numa rede de destino nenhum id daqui existe, e o CPF é o que reconhece a criança",
      );
    }
    return perfil;
  }

  /** O que esta escola já recebeu sobre esta criança. */
  @Get("alunos/:id/perfis-recebidos")
  @Roles("gestor", "admin-contrato")
  recebidos(
    @Param("id") id: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    if (!UUID.safeParse(id).success) throw new BadRequestException("id inválido");
    return this.portabilidade.recebidos(escolaAlvo(req.auth, escolaIdPedida), id);
  }

  /** O documento inteiro, como veio — para o gestor conferir e para reemitir. */
  @Get("perfis-recebidos/:id")
  @Roles("gestor", "admin-contrato")
  async documento(
    @Param("id") id: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    if (!UUID.safeParse(id).success) throw new BadRequestException("id inválido");
    const linha = await this.portabilidade.documento(escolaAlvo(req.auth, escolaIdPedida), id);
    if (!linha) throw new NotFoundException("perfil não encontrado");
    return {
      id: linha.id,
      emissor: {
        contrato: linha.emissorContrato,
        hub: linha.emissorHub,
        nome: linha.emissorNome,
      },
      emitidoEm: linha.emitidoEm.toISOString(),
      verificacao: linha.verificacao,
      documento: linha.documento,
    };
  }

  /**
   * Recebe um documento. Assinatura inválida é RECUSA (400): isso é adulteração.
   * Não conseguir falar com o emissor não é — entra marcado `nao-verificada`, e
   * a tela diz isso em vez de fingir que conferiu.
   */
  @Post("perfis-recebidos")
  @Roles("gestor", "admin-contrato")
  async importar(
    @Body() corpo: unknown,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    const lido = ArquivoSchema.safeParse(corpo);
    if (!lido.success) {
      throw new BadRequestException(
        "isto não é um perfil portátil: o arquivo precisa ter `perfil` e `assinatura`",
      );
    }
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);
    const resultado = await this.portabilidade.importar(escolaId, lido.data, req.auth.usuarioId);
    if (!resultado.ok) throw new BadRequestException(resultado);
    return resultado.perfil;
  }

  /**
   * Apagar um perfil recebido. Existe porque o documento é de fora: importado na
   * criança errada, ou emitido por engano, ele tem de sair — e apagá-lo não
   * apaga nada que esta rede tenha medido.
   */
  @Delete("perfis-recebidos/:id")
  @Roles("gestor", "admin-contrato")
  async remover(
    @Param("id") id: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    if (!UUID.safeParse(id).success) throw new BadRequestException("id inválido");
    const ok = await this.portabilidade.remover(escolaAlvo(req.auth, escolaIdPedida), id);
    if (!ok) throw new NotFoundException("perfil não encontrado");
    return { ok: true };
  }
}
