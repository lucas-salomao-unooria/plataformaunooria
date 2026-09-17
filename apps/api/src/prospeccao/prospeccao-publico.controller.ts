import { Body, Controller, HttpCode, HttpException, HttpStatus, Post, Req } from "@nestjs/common";
import { rateLimit } from "../comum/rate-limit";
import { ipDoCliente } from "../observabilidade/observabilidade-publico.controller";
import { logger } from "../observabilidade/logger";
import { Contrato } from "../openapi/contrato";
import { PrismaService } from "../prisma/prisma.service";
import { CadastroDeInteresseSchema, CadastroRecebidoSchema, TEXTO_DO_CONSENTIMENTO } from "./contrato-de-rotas";

/**
 * A ESCRITA do cadastro de interesse — a única rota de dados da api sem guard
 * nenhum (ADR-107).
 *
 * Controller separado do de leitura pela mesma razão que a observabilidade
 * separa o dela: um `@UseGuards` esquecido num método é invisível na revisão, e
 * um arquivo inteiro sem guard é uma decisão que se lê no topo. Quem lê os
 * cadastros mora em `prospeccao.controller.ts`, com `@Roles("admin")`.
 *
 * A defesa aqui não é papel — é:
 *  1. o Zod, que recusa o que não é um cadastro;
 *  2. a COTA por IP e a global da instância, contra enxurrada;
 *  3. o campo-armadilha, contra o robô que preenche tudo;
 *  4. o dedupe de uma hora, contra o duplo clique e o retry da rede.
 *
 * O IP entra como CHAVE DE COTA e não é gravado em lugar nenhum — nem na
 * tabela, nem no log. Ele identificaria a pessoa sem acrescentar nada ao que o
 * cadastro já diz.
 */

/** Por IP. Quem precisa de mais de cinco cadastros por hora não é um visitante. */
const CADASTROS_POR_IP_POR_HORA = 5;
/** Da instância inteira, contra o robô que gira de IP. */
const CADASTROS_GLOBAIS_POR_HORA = 200;
/** Janela do dedupe: o mesmo e-mail de novo dentro dela é a mesma intenção. */
const JANELA_DE_DUPLICATA_MS = 60 * 60 * 1000;

@Controller("prospeccao/publico")
export class ProspeccaoPublicoController {
  constructor(private readonly prisma: PrismaService) {}

  @Post("cadastros")
  @HttpCode(201)
  @Contrato({
    acesso: "publica",
    resumo: "Registra um cadastro de interesse feito no site público.",
    descricao:
      "A rota do formulário do ENTRE REDES (`/`, ADR-107). Sem sessão de propósito: quem preenche é um visitante, antes de existir contrato. Grava em `prospeccao_leads` — a única tabela sem `escola_id` e sem RLS, pelas razões da migration. O aceite é gravado com a FRASE que a pessoa marcou, não como um booleano solto.",
    corpo: CadastroDeInteresseSchema,
    resposta: CadastroRecebidoSchema,
    notas: [
      `Cota de ${CADASTROS_POR_IP_POR_HORA} por hora por IP e ${CADASTROS_GLOBAIS_POR_HORA} por hora na instância: acima, **429**. O IP é só chave de cota e não é registrado.`,
      "`consentimento` precisa ser exatamente `true`: sem aceite não há base legal, e o corpo é recusado com 400.",
      "`website` é campo-armadilha. Preenchido, a resposta é **201 e nada é gravado** — recusar com erro ensinaria o robô.",
      `Mesmo e-mail de novo dentro de ${JANELA_DE_DUPLICATA_MS / 60000} minutos devolve 201 sem gravar linha nova.`,
      "A resposta NUNCA diz se o e-mail já estava na base: isso transformaria a rota num verificador de quem se cadastrou.",
    ],
  })
  async cadastrar(@Body() body: unknown, @Req() req: { headers: Record<string, unknown> }) {
    const ip = ipDoCliente(req.headers);
    if (!rateLimit("prospeccao:global", CADASTROS_GLOBAIS_POR_HORA, JANELA_DE_DUPLICATA_MS).ok ||
        !rateLimit(`prospeccao:${ip}`, CADASTROS_POR_IP_POR_HORA, JANELA_DE_DUPLICATA_MS).ok) {
      throw new HttpException({ codigo: "cota-excedida", retryAfterSeconds: 3600 }, HttpStatus.TOO_MANY_REQUESTS);
    }

    const lido = CadastroDeInteresseSchema.safeParse(body);
    if (!lido.success) {
      /* Sem os VALORES no log: o corpo recusado é dado pessoal igual ao aceito.
         O que serve ao plantão é quais campos falharam. */
      logger.warn(
        { codigo: "prospeccao-corpo-invalido", campos: lido.error.issues.map((i) => i.path.join(".")) },
        "cadastro de interesse recusado pelo contrato",
      );
      throw new HttpException({ codigo: "corpo-invalido", mensagem: "Revise os campos obrigatórios." }, HttpStatus.BAD_REQUEST);
    }
    const dados = lido.data;

    // A armadilha: 201 e silêncio.
    if (dados.website && dados.website.trim().length > 0) {
      logger.info({ codigo: "prospeccao-armadilha" }, "cadastro de interesse descartado pelo campo-armadilha");
      return { recebido: true as const };
    }

    /* Minúsculas aqui, e CHECK no banco: é a chave do dedupe, e a mesma pessoa
       escreve o próprio e-mail de três jeitos ao longo de um ano. */
    const email = dados.email.toLowerCase();
    const desde = new Date(Date.now() - JANELA_DE_DUPLICATA_MS);
    const duplicata = await this.prisma.prospeccaoLead.findFirst({
      where: { email, criadoEm: { gt: desde } },
      select: { id: true },
    });
    if (duplicata) {
      logger.info({ codigo: "prospeccao-duplicata" }, "cadastro de interesse repetido dentro da janela");
      return { recebido: true as const };
    }

    await this.prisma.prospeccaoLead.create({
      data: {
        nome: dados.nome,
        email,
        telefone: dados.telefone,
        organizacao: dados.organizacao,
        cargo: dados.cargo,
        consentimentoTexto: TEXTO_DO_CONSENTIMENTO,
      },
    });
    /* Uma linha, SEM nada que identifique: quem quer saber quem se cadastrou
       abre a tela. O log aqui serve para responder "o formulário está
       funcionando?" — e essa pergunta se responde com a contagem. */
    logger.info({ codigo: "prospeccao-cadastro-recebido" }, "cadastro de interesse gravado");
    return { recebido: true as const };
  }
}
