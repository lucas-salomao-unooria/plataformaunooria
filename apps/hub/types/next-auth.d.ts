import type { Papel } from "@/lib/papeis";

/**
 * Module augmentation dos tipos do NextAuth — elimina os `@ts-expect-error`
 * e os `(session as any)` do scaffold original.
 */
export interface UsuarioDaSessao {
  id: string;
  nome: string;
  papel: Papel;
  escolaId: string;
  turmaId?: string;
  serie?: string;
}

declare module "next-auth" {
  interface Session {
    usuario: UsuarioDaSessao;
  }
  interface User {
    usuario: UsuarioDaSessao;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    usuario?: UsuarioDaSessao;
  }
}

// No v5 beta os callbacks tipam o JWT a partir de @auth/core — sem esta
// segunda augmentation o `token.usuario` volta como unknown no lib/auth.ts.
declare module "@auth/core/jwt" {
  interface JWT {
    usuario?: UsuarioDaSessao;
  }
}
