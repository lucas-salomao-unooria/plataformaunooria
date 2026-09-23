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

/**
 * Chave do lock consultivo que serializa o preparo da role entre PROCESSOS.
 * Número arbitrário e fixo — o que importa é ser o mesmo em todo worker.
 */
const LOCK_DO_PREPARO = 918_273;

export async function criarRoleDeRuntime(admin: PrismaClient): Promise<void> {
  /**
   * LOCK CONSULTIVO em volta do preparo INTEIRO, e não só do `CREATE ROLE`.
   *
   * O comentário que estava aqui dizia que os `GRANT` eram "idempotentes: podem
   * correr em paralelo sem problema". **Eles são idempotentes em EFEITO e não
   * seguros em CONCORRÊNCIA**: cada `GRANT` atualiza a tupla de ACL do objeto no
   * catálogo (`pg_namespace.nspacl`, `pg_class.relacl`), e dois `GRANT`
   * simultâneos sobre o mesmo objeto morrem com
   * `XX000 ERROR: tuple concurrently updated` — que não é falha de serialização
   * que o Postgres refaz sozinho, é erro duro.
   *
   * O sintoma era intermitente e apontava para o lugar errado: a suíte de RLS
   * reprovava dizendo que a role não enxergava as linhas, quando o que falhou
   * foi o `beforeAll` de DUAS suítes se preparando ao mesmo tempo. MEDIDO em
   * 2026-09-10: 2 falhas em 20 corridas completas, sempre no
   * `GRANT USAGE ON SCHEMA public`.
   *
   * `pg_advisory_lock` é a ferramenta certa porque é por SESSÃO e atravessa
   * processos — é o mesmo mecanismo que o motor da exp08ef1b usa para o lock por
   * run. `$queryRawUnsafe` e não `$executeRawUnsafe`: é um SELECT — e com
   * `::text`, porque `pg_advisory_lock` devolve `void` e o Prisma responde
   * "Failed to deserialize column of type 'void'".
   */
  await admin.$queryRawUnsafe(`SELECT pg_advisory_lock(${LOCK_DO_PREPARO})::text AS lock`);
  try {
    await admin.$executeRawUnsafe(`
      DO $$ BEGIN
        CREATE ROLE ${ROLE_RUNTIME_TESTE} LOGIN PASSWORD '${ROLE_RUNTIME_TESTE}'
          NOSUPERUSER NOBYPASSRLS;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await admin.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${ROLE_RUNTIME_TESTE}`);
    await admin.$executeRawUnsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${ROLE_RUNTIME_TESTE}`,
    );
    await admin.$executeRawUnsafe(
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${ROLE_RUNTIME_TESTE}`,
    );
  } finally {
    /* `finally`: lock consultivo por sessão sobrevive ao erro e só sai no
       `$disconnect`. Preso, o próximo worker esperaria o timeout do Jest. */
    await admin.$queryRawUnsafe(`SELECT pg_advisory_unlock(${LOCK_DO_PREPARO})::text AS unlock`);
  }
}
