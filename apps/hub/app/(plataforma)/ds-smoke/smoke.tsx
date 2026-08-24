"use client";

import { useState } from "react";
import {
  AlertBox,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Icon,
  Logo,
  ProgressBar,
  Tag,
  TextField,
} from "@edu/ui/ds";

export function SmokeDoDs() {
  const [valor, setValor] = useState("");
  return (
    <main style={{ display: "grid", gap: 24, padding: 32, maxWidth: 480, margin: "0 auto" }}>
      <Logo size="sm" color="navy" />
      <AlertBox variant="info" title="Smoke do DS">
        Se o ícone ao lado do título é um glifo (não a palavra “school”), as
        fontes do DS carregaram.
      </AlertBox>
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>
            <Icon name="school" /> Componentes institucionais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ display: "grid", gap: 12 }}>
            <TextField
              label="Campo de texto"
              placeholder="Digite algo"
              value={valor}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValor(e.target.value)}
            />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Badge>Badge</Badge>
              <Tag>Tag</Tag>
            </div>
            <ProgressBar value={62} />
            <Button variant="primary">Botão primário</Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
