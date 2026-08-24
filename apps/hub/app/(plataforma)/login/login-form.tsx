"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";

import { AlertBox, Button, Card, Logo, PasswordInput, TextField } from "@edu/ui/ds";

// Sem qualquer menção a exercício: é só a entrada da plataforma.
export function LoginForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviando) return;

    setErro(null);
    setEnviando(true);
    try {
      const resultado = await signIn("credentials", {
        username: username.trim(),
        password,
        redirect: false,
      });

      if (!resultado || resultado.error) {
        setErro("Usuário ou senha incorretos.");
        setEnviando(false);
        return;
      }

      // O destino por papel sai da raiz (`/` redireciona pela sessão) — o
      // client não precisa conhecer o papel.
      router.replace(nextPath ?? "/");
      router.refresh();
    } catch {
      setErro("Sem conexão agora. Tente de novo.");
      setEnviando(false);
    }
  }

  return (
    <Card variant="elevated" className="w-full max-w-[420px]">
      <div className="flex flex-col gap-6 p-1">
        <header className="flex flex-col gap-3">
          <Logo size="md" color="navy" aria-label="Plataforma Unooria" />
          <div className="flex flex-col gap-1">
            <h1 className="text-[22px] font-bold text-unooria-neutral-950">
              Entrar na plataforma
            </h1>
            <p className="text-[14px] text-unooria-neutral-500">Entre com seu usuário e senha.</p>
          </div>
        </header>

        {erro ? <AlertBox theme="light" variant="error" device="auto" description={erro} /> : null}

        <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          <TextField
            id="username"
            name="username"
            label="Usuário"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            error={Boolean(erro)}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <PasswordInput
            id="password"
            name="password"
            label="Senha"
            autoComplete="current-password"
            required
            error={Boolean(erro)}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button
            type="submit"
            variant="primary"
            size="md"
            fullWidth
            isLoading={enviando}
            loadingText="Entrando…"
            isDisabled={!username.trim() || !password}
          >
            Entrar
          </Button>
        </form>
      </div>
    </Card>
  );
}
