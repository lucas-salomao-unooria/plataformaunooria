import { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../src/prisma/prisma.service";
import { EscolasService } from "../src/rostering/escolas.service";
import { OneRosterService } from "../src/rostering/oneroster.service";
import { RosteringService } from "../src/rostering/rostering.service";
import { UsuariosService } from "../src/usuarios/usuarios.service";

/**
 * Monta os services da fronteira de pessoas para teste de integração.
 *
 * Existe para a assinatura deles ficar num lugar só: quando o `RosteringService`
 * ganhou a pimenta do CPF e o serviço de escolas, cinco suítes pararam de
 * compilar por causa de um `new` a mais.
 */
export const PIMENTA_DE_TESTE = "pimenta-de-teste-nao-usar-em-producao";

export function servicosDeTeste(prisma: PrismaService) {
  // A pimenta vem do ambiente, como em produção — o `ConfigService` sem
  // `internalConfig` cai no `process.env`.
  process.env.CPF_PEPPER = process.env.CPF_PEPPER ?? PIMENTA_DE_TESTE;
  const config = new ConfigService();
  const escolas = new EscolasService(prisma);
  const rostering = new RosteringService(prisma, escolas, config);
  const oneroster = new OneRosterService(prisma, rostering, config, escolas);
  const usuarios = new UsuariosService(prisma);
  return { escolas, rostering, oneroster, usuarios, config };
}
