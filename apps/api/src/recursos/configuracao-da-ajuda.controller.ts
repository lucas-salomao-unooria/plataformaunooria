import { Body, Controller, Get, Inject, Put, Req, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AVATAR_AO_VIVO, type AvatarAoVivoPort } from "../ai/avatar-ao-vivo.port";
import { VOZ_AO_VIVO, type VozAoVivoPort } from "../ai/voz-ao-vivo.port";
import { atendentesMontados, CONFIGURACAO_PADRAO, VOZES_DO_MASCOTE } from "../ajuda/regras";
import type { AuthClaims } from "../auth/oidc.guard";
import { OidcGuard } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { logger } from "../observabilidade/logger";
import { Contrato } from "../openapi/contrato";
import { PrismaService } from "../prisma/prisma.service";
import { registrarAuditoria } from "./auditoria";
import {
  ConfiguracaoAlteradaSchema,
  ConfiguracaoDaAjudaLidaSchema,
  DefinirConfiguracaoDaAjudaSchema,
} from "./contrato-de-rotas";

type Campos = Omit<ReturnType<typeof DefinirConfiguracaoDaAjudaSchema.parse>, "motivo">;

/** A linha que a migration semeia, como campos — vale quando a linha some. */
const PADRAO: Campos = {
  atendentePadrao: CONFIGURACAO_PADRAO.atendentePadrao,
  permitirTroca: CONFIGURACAO_PADRAO.permitirTroca,
  mascoteVoz: "Leda",
  mascoteModelo: CONFIGURACAO_PADRAO.mascote.modelo,
  mascoteSensibilidade: CONFIGURACAO_PADRAO.mascote.sensibilidade,
  mascoteSuavizacao: CONFIGURACAO_PADRAO.mascote.suavizacao,
  mascoteAntecipacaoMs: CONFIGURACAO_PADRAO.mascote.antecipacaoMs,
  mascoteBocaRepouso: CONFIGURACAO_PADRAO.mascote.bocaRepouso,
};

const CAMPOS = Object.keys(PADRAO) as Array<keyof Campos>;

/**
 * QUEM ATENDE NA AJUDA (ADR-158) — o atendente padrão da rede (o mascote ou o
 * avatar em vídeo), se a pessoa pode trocar, e os ajustes do mascote.
 *
 * `@Roles("admin")`, pela razão dos minutos (`LimitesDaAjudaController`): os
 * dois atendentes custam diferente (o avatar cobra por minuto de vídeo, o
 * mascote por token de áudio do Gemini), e a escolha é da fornecedora.
 *
 * Mora em `recursos` porque é o painel da Unooria que a opera; a Ajuda só LÊ a
 * linha, a cada abertura de sessão. O `disponiveis` sai da MESMA regra que a
 * janela da Ajuda usa (`atendentesMontados`): o painel avisa quando o padrão
 * escolhido não está montado nesta stack, e a Ajuda abre o outro.
 */
@Controller("recursos/configuracao-da-ajuda")
@UseGuards(OidcGuard, RolesGuard)
@Roles("admin")
export class ConfiguracaoDaAjudaController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(AVATAR_AO_VIVO) private readonly avatar: AvatarAoVivoPort,
    @Inject(VOZ_AO_VIVO) private readonly voz: VozAoVivoPort,
  ) {}

  private async ler() {
    const linha = await this.prisma.ajudaConfiguracao.findUnique({ where: { id: 1 } });
    const autor = linha?.definidoPor
      ? await this.prisma.user.findUnique({ where: { id: linha.definidoPor }, select: { displayName: true } })
      : null;
    const campos: Campos = linha
      ? {
          atendentePadrao: linha.atendentePadrao === "avatar" ? "avatar" : "mascote",
          permitirTroca: linha.permitirTroca,
          mascoteVoz: VOZES_DO_MASCOTE.some(([nome]) => nome === linha.mascoteVoz)
            ? (linha.mascoteVoz as Campos["mascoteVoz"])
            : PADRAO.mascoteVoz,
          mascoteModelo: linha.mascoteModelo,
          mascoteSensibilidade: linha.mascoteSensibilidade,
          mascoteSuavizacao: linha.mascoteSuavizacao,
          mascoteAntecipacaoMs: linha.mascoteAntecipacaoMs,
          mascoteBocaRepouso: linha.mascoteBocaRepouso,
        }
      : PADRAO;
    return {
      ...campos,
      motivo: linha?.motivo ?? null,
      definidoPorNome: linha?.definidoPor ? (autor?.displayName ?? "(conta sem nome)") : null,
      definidoEm: (linha?.definidoEm ?? new Date(0)).toISOString(),
      disponiveis: atendentesMontados({
        avatarLigado: this.avatar.ligado,
        vozLigada: this.voz.ligada,
        chaveDaSessao: this.config.get("AJUDA_SESSAO_CHAVE"),
        segredoDoLlm: this.config.get("AJUDA_LLM_SEGREDO"),
      }),
      vozes: VOZES_DO_MASCOTE.map(([nome, jeito]) => ({ nome, jeito })),
    };
  }

  @Get()
  @Contrato({
    resumo: "A configuração da Ajuda: quem atende por padrão e os ajustes do mascote.",
    descricao:
      "A linha única de `ajuda_configuracao`, mais o que está montado nesta stack (`disponiveis`) e a lista fechada de vozes do mascote. É o que a Ajuda consulta ao abrir cada sessão.",
    resposta: ConfiguracaoDaAjudaLidaSchema,
    notas: ["Só `admin` (ADR-88/158)."],
  })
  async configuracao() {
    return this.ler();
  }

  @Put()
  @Contrato({
    resumo: "Define a configuração da Ajuda.",
    descricao:
      "Sobrescreve a linha de `ajuda_configuracao` com TODOS os campos (o painel manda o formulário inteiro). **Motivo obrigatório sempre.** A mudança entra no histórico do painel (`recursos_auditoria`, ação `configuracao-alterada`, `recurso_id` `ajuda:configuracao`).",
    corpo: DefinirConfiguracaoDaAjudaSchema,
    resposta: ConfiguracaoAlteradaSchema,
    notas: [
      "A voz é da lista fechada do Gemini Live; o modelo, só no formato de nome (Zod e CHECK).",
      "Vale na PRÓXIMA sessão aberta; a conversa no ar mantém a voz e o modelo com que começou.",
    ],
  })
  async definir(@Body() body: unknown, @Req() req: { auth: AuthClaims }) {
    const { motivo, ...campos } = DefinirConfiguracaoDaAjudaSchema.parse(body);
    const atual = await this.ler();
    const mudou = CAMPOS.filter((c) => atual[c] !== campos[c]);
    if (mudou.length === 0) return { ...atual, alterada: false };

    const dados = { ...campos, motivo, definidoPor: req.auth.usuarioId, definidoEm: new Date() };
    await this.prisma.ajudaConfiguracao.upsert({ where: { id: 1 }, create: { id: 1, ...dados }, update: dados });

    // Só os NOMES dos campos e os valores (nenhum é dado de pessoa).
    logger.info(
      { codigo: "ajuda-configuracao-alterada", campos: mudou, de: pick(atual, mudou), para: pick(campos, mudou), motivo },
      "configuração da Ajuda alterada",
    );
    await registrarAuditoria(
      this.prisma,
      {
        recursoId: "ajuda:configuracao",
        escolaId: null,
        acao: "configuracao-alterada",
        motivo,
        autorId: req.auth.usuarioId,
      },
      (erro) =>
        logger.error(
          { codigo: "recurso-auditoria-nao-gravada", recursoId: "ajuda:configuracao", acao: "configuracao-alterada", err: erro },
          "a configuração mudou, mas o histórico não foi gravado",
        ),
    );
    return { ...(await this.ler()), alterada: true };
  }
}

function pick<T extends object>(obj: T, chaves: Array<keyof T>): Partial<T> {
  return Object.fromEntries(chaves.map((c) => [c, obj[c]])) as Partial<T>;
}
