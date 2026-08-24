import { Body, Controller, HttpCode, HttpException, Post } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { rateLimit } from "../comum/rate-limit";
import { PrismaService } from "../prisma/prisma.service";
import type { Perfil } from "./claims";

const LoginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(200),
});

const CREDENCIAIS_INVALIDAS = "Usuário ou senha incorretos.";

/**
 * Consumido pelo `authorize()` do NextAuth no hub — nunca pelo browser.
 * A api é a única dona do banco; o hub não conhece hash nenhum.
 *
 * Sem rate limit por IP de propósito: a api só enxerga o IP do hub. O limite
 * por usuário segura força bruta; o teto por rede da escola fica no hub.
 */
@Controller("auth")
export class AuthController {
  constructor(private readonly prisma: PrismaService) {}

  @Post("login")
  @HttpCode(200)
  async login(@Body() body: unknown) {
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) throw new HttpException({ mensagem: CREDENCIAIS_INVALIDAS }, 400);
    const { username, password } = parsed.data;

    const cota = rateLimit(`login:${username.toLowerCase()}`, 8, 60_000);
    if (!cota.ok) {
      throw new HttpException(
        { mensagem: "Muitas tentativas. Aguarde um momento e tente de novo." },
        429,
      );
    }

    // Username é único POR ESCOLA: o mesmo usuário pode existir em mais de uma
    // (contratos grandes). A senha desambigua; empate de senha entre escolas é
    // recusado — caso raro que o gestor resolve renomeando no CSV.
    const candidatos = await this.prisma.user.findMany({
      where: { username },
      include: { turma: true },
    });

    // Sempre comparamos algo para não vazar existência de usuário pelo tempo.
    const aprovados = [];
    if (candidatos.length === 0) {
      await bcrypt.compare(password, HASH_DUMMY);
    } else {
      for (const u of candidatos) {
        if (await bcrypt.compare(password, u.passwordHash)) aprovados.push(u);
      }
    }

    const user = aprovados.length === 1 ? aprovados[0]! : null;
    if (!user) {
      if (aprovados.length > 1) {
        console.warn(`[auth/login] username "${username}" ambíguo entre escolas — negado`);
      }
      throw new HttpException({ mensagem: CREDENCIAIS_INVALIDAS }, 401);
    }

    return {
      usuarioId: user.id,
      nome: user.displayName,
      papel: user.role as Perfil,
      escolaId: user.escolaId,
      turmaId: user.turmaId,
      serie: user.turma?.serie ?? null,
    };
  }
}

// Hash real (de uma senha aleatória descartada) para o caminho "usuário não
// existe" custar o mesmo tempo do caminho "senha errada".
const HASH_DUMMY = bcrypt.hashSync("senha-dummy-anti-timing", 10);
