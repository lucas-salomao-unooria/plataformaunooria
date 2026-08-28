import { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../src/prisma/prisma.service";
import { EscolasService } from "../src/rostering/escolas.service";
import { OneRosterService } from "../src/rostering/oneroster.service";
import { RosteringService } from "../src/rostering/rostering.service";
import { PortabilidadeService } from "../src/portabilidade/portabilidade.service";
import { UsuariosService } from "../src/usuarios/usuarios.service";

/**
 * Monta os services da fronteira de pessoas para teste de integração.
 *
 * Existe para a assinatura deles ficar num lugar só: quando o `RosteringService`
 * ganhou a pimenta do CPF e o serviço de escolas, cinco suítes pararam de
 * compilar por causa de um `new` a mais.
 */
export function servicosDeTeste(prisma: PrismaService) {
  const config = new ConfigService();
  const escolas = new EscolasService(prisma);
  const rostering = new RosteringService(prisma, escolas, config);
  const oneroster = new OneRosterService(prisma, rostering, config, escolas);
  const usuarios = new UsuariosService(prisma);
  const portabilidade = new PortabilidadeService(prisma, config);
  return { escolas, rostering, oneroster, usuarios, portabilidade, config };
}
