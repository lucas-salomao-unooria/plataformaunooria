import { useState } from "react";
import {
  AlertBox,
  Avatar,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Logo,
  ScrollBar,
  Selection,
  TextArea,
} from "@edu/ui/ds";
import { faltamParaOPiso, regraPronta } from "../lib/regras";
import { TEXTOS } from "../lib/textos";
import type { Opcao } from "../lib/tipos";

/**
 * As telas da CASCA Unooria — quem fala é a escola, e só ela (`@edu/ui/ds`, a
 * seção `unooria`, tema claro; nada de `--wa-*`, nada do clone).
 *
 * São duas travessias, e cada uma tem razão própria (o `AGENTS.md` da pasta
 * conta por inteiro):
 *
 * - **o dilema do tio sai do mensageiro** porque não é sobre o grupo da turma:
 *   é sobre o grupo da FAMÍLIA dele, e escrever a regra dentro do clone a
 *   devolveria para dentro da ficção que a missão acabou de desmontar;
 * - **"Missão Concluída"** é a escola guardando a regra da criança — depois
 *   das perguntas da Nina, que voltam ao mensageiro.
 *
 * A rolagem é o `ScrollBar` do DS: aqui a seção É a `unooria`, e a regra das
 * duas famílias (que tira o `ScrollBar` do clone) vale ao contrário.
 */

function Casca({ children }: { children: React.ReactNode }) {
  return (
    <ScrollBar className="escola" height="100%" autoHide theme="light">
      <div className="escola__pilha">
        <Logo size="sm" className="escola__marca" />
        {children}
      </div>
    </ScrollBar>
  );
}

// ─────────────────────────── E6-ALU-01: o desafio do tio e a regra Se/Então

export function TelaDaRegra({
  tio,
  condicoes,
  piso,
  teto,
  falha,
  ocupado,
  aoEnviar,
}: {
  tio: string;
  condicoes: Opcao[];
  piso: number;
  teto: number;
  /** `sem-sentido` = a recusa `entao-sem-sentido` da api; `rede` = não chegou. */
  falha: "sem-sentido" | "rede" | null;
  ocupado: boolean;
  aoEnviar: (se: string, entao: string) => void;
}) {
  const [se, setSe] = useState<string | null>(null);
  const [entao, setEntao] = useState("");
  const faltam = faltamParaOPiso(entao, piso);
  const pronta = regraPronta(se, entao, piso, teto);

  return (
    <Casca>
      <Card variant="outlined">
        {/* `icon`, e não `avatar`: o `CardHeader` da 0.2.5 declara `avatar` no
            tipo mas não o desenha (a prop cai no `<div>` como atributo). */}
        <CardHeader icon={<Avatar name={TEXTOS.lista.nina} size="sm" />} title={TEXTOS.lista.nina} />
        <CardContent>
          <p className="escola__fala">{tio}</p>
        </CardContent>
      </Card>

      <p className="escola__comando">{TEXTOS.reflexao.comando}</p>

      <Selection
        label={TEXTOS.reflexao.se}
        options={condicoes.map((c) => ({ value: c.id, label: c.rotulo }))}
        value={se ?? undefined}
        onChange={(valor) => setSe(typeof valor === "string" ? valor : (valor[0] ?? null))}
        showOptionCheckbox={false}
        disabled={ocupado}
      />

      <TextArea
        label={TEXTOS.reflexao.entao}
        placeholder={TEXTOS.reflexao.placeholder}
        value={entao}
        onChange={(e) => setEntao(e.target.value)}
        maxLength={teto}
        rows={4}
        disabled={ocupado}
        helperText={faltam > 0 ? TEXTOS.reflexao.contador(piso, faltam) : undefined}
        error={falha === "sem-sentido" ? TEXTOS.reflexao.semSentido : undefined}
      />

      {falha === "rede" && (
        <AlertBox variant="error" device="mobile" theme="light" description={TEXTOS.reflexao.naoEnviou} />
      )}

      <Button
        variant="primary"
        size="lg"
        fullWidth
        disabled={!pronta || ocupado}
        isLoading={ocupado}
        onClick={() => se && aoEnviar(se, entao)}
      >
        {TEXTOS.reflexao.salvar}
      </Button>
    </Casca>
  );
}

// ─────────────────────── a confirmação da regra, antes de voltar à Nina

export function TelaDeConfirmacao({ texto, aoContinuar }: { texto: string; aoContinuar: () => void }) {
  return (
    <Casca>
      <AlertBox
        variant="success"
        device="mobile"
        theme="light"
        description={texto}
        primaryAction={{ label: TEXTOS.reflexao.continuar, onClick: aoContinuar }}
      />
    </Casca>
  );
}

// ─────────────────────────────────────── E6-ALU-02: a missão concluída

export function TelaConcluida({ regra }: { regra: string | null }) {
  const c = TEXTOS.conclusao;
  return (
    <Casca>
      <h1 className="escola__titulo">{c.titulo}</h1>
      {regra && (
        <Card variant="outlined" className="escola__regra">
          <CardHeader>
            <CardTitle as="h2">{c.cardTitulo}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="escola__regra-texto">{regra}</p>
            <CardDescription>{c.sucesso}</CardDescription>
          </CardContent>
        </Card>
      )}
      <p className="escola__rodape">{c.rodape}</p>
    </Casca>
  );
}
