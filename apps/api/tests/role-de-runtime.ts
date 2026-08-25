import type { PrismaClient } from "@prisma/client";

/**
 * A role sem ownership com que os testes de RLS conectam — o mesmo desenho da
 * produção, onde a api NÃO pode depender de ser dona das tabelas para as
 * políticas valerem.
 *
 * Vive aqui, e não duplicada em cada suíte, por causa de uma corrida real: o
 * Jest paraleliza as suítes, e `IF NOT EXISTS ... CREATE ROLE` é check-then-act
 * — dois workers checam ao mesmo tempo, os dois criam, e um recebe
 * `duplicate_object`. O `beforeAll` estoura e a suíte inteira falha, de forma
 * intermitente e sem relação nenhuma com o que está sendo testado.
 * `EXCEPTION WHEN duplicate_object` fecha a janela.
 */
export const ROLE_RUNTIME_TESTE = "app_runtime_test";

/** URL do Postgres com a role de runtime no lugar do usuário administrativo. */
export function urlDeRuntime(adminUrl: string): string {
  return adminUrl.replace(/\/\/[^@]+@/, `//${ROLE_RUNTIME_TESTE}:${ROLE_RUNTIME_TESTE}@`);
}

export async function criarRoleDeRuntime(admin: PrismaClient): Promise<void> {
  await admin.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE ROLE ${ROLE_RUNTIME_TESTE} LOGIN PASSWORD '${ROLE_RUNTIME_TESTE}'
        NOSUPERUSER NOBYPASSRLS;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
  // Idempotentes: podem correr em paralelo sem problema.
  await admin.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${ROLE_RUNTIME_TESTE}`);
  await admin.$executeRawUnsafe(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${ROLE_RUNTIME_TESTE}`,
  );
  await admin.$executeRawUnsafe(
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${ROLE_RUNTIME_TESTE}`,
  );
}
