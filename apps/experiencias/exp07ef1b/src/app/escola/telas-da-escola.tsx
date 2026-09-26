import { useState } from "react";
import { AlertBox, Button, Card, CardContent, SectionHeader, TextArea } from "@edu/ui/ds";
import { codePoints, faltamNaReflexao, normalizarReflexao, reflexaoValida } from "../../lib/regras";
import { E6, ESCOLA } from "../../lib/textos";
import type { Limites } from "../../lib/tipos";

/**
 * As telas em que a ESCOLA fala — a seção `unooria`, pela ponte `@edu/ui/ds`.
 *
 * **A fronteira do disfarce é QUEM FALA, não o momento.** Do "Abrir Feed" até o
 * fechamento da Amara, quem conduz é o app clonado (inclusive a revelação, que
 * é a ficha técnica sobre o Story). A reflexão sai do clone de propósito: a
 * pergunta de transferência é sobre um jornal cobrindo OUTRA escola, e fazê-la
 * dentro do Instagram a devolveria para dentro da ficção — a transferência para
 * fora da tela é o que a Etapa 6 existe para produzir. As enquetes voltam ao
 * clone (é a Amara quem pergunta), e o fim volta à escola.
 *
 * Nenhum `Icon` da plataforma aqui, e é de propósito: os ícones dela são o
 * Material Symbols por ligadura, 5,36 MB que só descem se a família for
 * aplicada (`packages/ui/AGENTS.md`). Os ícones do `AlertBox` são SVG.
 */

// ─────────────────────────────────────────────── E6-ALU-01: a reflexão

export function Reflexao({
  limites,
  enviando,
  aoEnviar,
}: {
  limites: Limites;
  enviando: boolean;
  aoEnviar: (texto: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const contados = codePoints(normalizarReflexao(texto));
  const faltam = faltamNaReflexao(texto, limites.reflexaoMin);
  const pode = reflexaoValida(texto, limites.reflexaoMin, limites.reflexaoMax) && !enviando;

  return (
    <div className="escola">
      <div className="escola__pilha">
        <SectionHeader variant="mobile" title={E6.cabecalho} />

        <Card>
          <CardContent>
            <p className="escola__pergunta">{E6.pergunta}</p>
          </CardContent>
        </Card>

        {/* `label` E `aria-label`: o `placeholder` some no primeiro caractere,
            e o `label` do `TextArea` (0.2.5) é um `<label>` SEM `htmlFor` — ele
            aparece na tela mas não dá nome ao campo. Sem o `aria-label`, quem
            usa leitor de tela ouviria só "caixa de texto" (pedido aberto no
            `storybook-unooria`, ver o `AGENTS.md` desta pasta).

            `showCounter={false}`: o `TextArea` do DS liga o contador SOZINHO
            quando recebe `maxLength`, e ele conta `.length` (UTF-16). O daqui
            conta code points, como a api, e é o único que diz o MÍNIMO — que é
            o que destrava o botão.

            O `TextArea` é campo de formulário: é por ele (e pelo compositor dos
            Stories) que o manifesto pede `permissoes: ["forms"]`. */}
        <TextArea
          value={texto}
          label={E6.rotuloDoCampo}
          aria-label={E6.rotuloDoCampo}
          maxLength={limites.reflexaoMax}
          showCounter={false}
          rows={7}
          placeholder={E6.placeholder}
          aria-describedby="reflexao-contador reflexao-privacidade"
          onChange={(e: { target: { value: string } }) => setTexto(e.target.value)}
        />
        <p id="reflexao-contador" className="escola__contador">
          {E6.contador(contados)}
        </p>
        {faltam > 0 && contados > 0 && (
          <p className="escola__aviso" role="status">
            {E6.avisoMinimo(faltam)}
          </p>
        )}
        <p id="reflexao-privacidade" className="escola__nota">
          {E6.privacidade}
        </p>

        <Button fullWidth disabled={!pode} isLoading={enviando} onClick={() => aoEnviar(normalizarReflexao(texto))}>
          {E6.enviar}
        </Button>
      </div>
    </div>
  );
}

/** A confirmação do envio — o texto do PO — antes de a Amara voltar com as enquetes. */
export function ReflexaoEnviada({ aoContinuar }: { aoContinuar: () => void }) {
  return (
    <div className="escola escola--centrada">
      <AlertBox
        variant="success"
        theme="light"
        device="mobile"
        title={E6.enviada}
        primaryAction={{ label: E6.continuar, onClick: aoContinuar }}
      />
    </div>
  );
}

// ───────────────────────────────────────────── "Missão concluída!"

export function Concluida() {
  return (
    <div className="escola escola--centrada">
      <AlertBox variant="success" theme="light" device="mobile" title={ESCOLA.concluidaTitulo} description={ESCOLA.concluidaCorpo} />
    </div>
  );
}

// ─────────────────────────────── 403: a missão não está aberta aqui

/**
 * A guarda de liberação (ADR-69) ou o interruptor da rede (ADR-87). O SDK não
 * entrega o corpo do erro, e os dois 403 chegam iguais — a frase serve aos
 * dois: a criança não fez nada de errado, e a saída é a professora.
 */
export function Indisponivel() {
  return (
    <div className="escola escola--centrada">
      <AlertBox variant="info" theme="light" device="mobile" title={ESCOLA.indisponivelTitulo} description={ESCOLA.indisponivelCorpo} />
    </div>
  );
}
