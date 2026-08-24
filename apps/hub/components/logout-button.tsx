"use client";

import { signOut } from "next-auth/react";
import { Button } from "@edu/ui/ds";

export function LogoutButton() {
  return (
    <Button variant="ghost" size="sm" onClick={() => void signOut({ callbackUrl: "/login" })}>
      Sair
    </Button>
  );
}
