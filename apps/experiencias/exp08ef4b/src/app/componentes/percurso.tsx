import {
  AlertBox,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  TextArea,
} from "@edu/ui/ds";
import { PLATAFORMA, comContagem } from "../../lib/textos";
import type { ClausulaPublica, Tag } from "../../lib/tipos";

/**
 * E5-ALU-01 — a assinatura no Meu Percurso. **Seção `unooria`**: o handoff
 * coloca esta etapa explicitamente "fora da simulação", e quem fala aqui é a
 * escola pedindo um registro no portfólio anual.
 *
 * O campo de texto é o ÚNICO livre da missão e o dado mais sensível dela: caixa
 * escrita por menor de idade. Ele não vai a log nem à telemetria analítica, e a
 * única rota que o devolve é a do professor da turma dela.
 *
 * **A terceira palavra-chave é IMPEDIDA, não aceita-e-reclamada.** São quatro
 * caixas e o teto é 2: quem marcasse três descobriria pelo botão desabilitado,
 * sem saber qual desmarcar.
 */
export function Percurso({
  clausula,
  tags,
  marcadas,
  exigidas,
  justificativa,
  piso,
  teto,
  habilitado,
  enviando,
  erro,
  onAlternarTag,
  onEscrever,
  onRegistrar,
}: {
  clausula: ClausulaPublica | undefined;
  tags: Tag[];
  marcadas: string[];
  exigidas: number;
  justificativa: string;
  piso: number;
  teto: number;
  habilitado: boolean;
  enviando: boolean;
  erro: string | null;
  onAlternarTag: (id: string) => void;
  onEscrever: (texto: string) => void;
  onRegistrar: () => void;
}) {
  const escrito = justificativa.trim().length;

  return (
    <div className="escola">
      <div className="escola__cartao">
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>A sua cláusula inegociável</CardTitle>
          </CardHeader>
          <CardContent>
            {clausula && (
              <blockquote className="citacao">
                <strong>{clausula.tituloClausula}</strong>
                <br />
                {clausula.artigoTexto}
              </blockquote>
            )}
          </CardContent>
        </Card>

        <p className="escola__narrativa">{PLATAFORMA.instrucaoDoFormulario}</p>

        {/* `fieldset` + `legend` pelo mesmo motivo do PICO: sem eles o leitor de
            tela lê quatro caixas soltas e nunca a pergunta que as reúne. */}
        <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
          <legend className="contador-de-caracteres" style={{ textAlign: "left" }}>
            {marcadas.length} de {exigidas} palavras-chave
          </legend>
          <div className="tags">
            {tags.map((tag) => {
              const marcada = marcadas.includes(tag.id);
              /* `disabled` só na NÃO marcada quando o teto fechou: desmarcar
                 tem de continuar possível, senão a criança fica presa nas duas
                 primeiras que tocou. */
              const bloqueada = !marcada && marcadas.length >= exigidas;
              return (
                <Checkbox
                  key={tag.id}
                  label={tag.rotulo}
                  checked={marcada}
                  isDisabled={bloqueada}
                  onChange={() => onAlternarTag(tag.id)}
                  data-tag={tag.id}
                />
              );
            })}
          </div>
        </fieldset>

        <div>
          <TextArea
            label="Por que essa cláusula é inegociável para você?"
            placeholder={PLATAFORMA.placeholderDaJustificativa}
            value={justificativa}
            maxLength={teto}
            rows={5}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onEscrever(e.target.value)}
            data-campo="justificativa"
          />
          {/* O contador conta o texto APARADO — é o mesmo número que o botão
              usa para habilitar, e mostrar um valor diferente do que decide
              seria a tela dizendo que está pronto e a api respondendo 400. */}
          <p className="contador-de-caracteres">
            {comContagem(PLATAFORMA.contadorDeCaracteres, { count: escrito, piso })}
          </p>
        </div>

        {/* `variant`, e não `type`: as duas seções do pacote têm réguas
            diferentes, e o `AlertBox` da `unooria` usa `variant`. O typecheck
            pegou — mas o `Button` da mesma seção ACEITA prop inventada em
            silêncio, então nem sempre pega. */}
        {erro && <AlertBox variant="warning" description={erro} />}

        <div className="escola__rodape cta-48">
          <Button
            variant="primary"
            size="lg"
            isDisabled={!habilitado}
            onClick={onRegistrar}
            data-acao="registrar-percurso"
          >
            {enviando ? "Protocolando…" : PLATAFORMA.registrarNoPercurso}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * E5-ALU-02 — a certidão do documento protocolado.
 *
 * Estática de propósito: o formulário entrou em latch. Não há botão de editar,
 * e a ausência é a regra PROD-04 — o que foi assinado foi assinado.
 */
export function Confirmacao({
  clausula,
  tags,
  justificativa,
  onAvancar,
}: {
  clausula: ClausulaPublica | undefined;
  tags: string[];
  justificativa: string;
  onAvancar: () => void;
}) {
  return (
    <div className="escola">
      <div className="escola__cartao">
        <span className="selo" data-selo="protocolo">
          {PLATAFORMA.protocolo}
        </span>
        <p className="escola__narrativa">{PLATAFORMA.sucessoDoRegistro}</p>

        <Card variant="outlined">
          <CardContent>
            <blockquote className="citacao">
              {clausula && (
                <>
                  <strong>{clausula.tituloClausula}</strong>
                  <br />
                </>
              )}
              {tags.join(" · ")}
              <br />
              <br />
              {justificativa}
            </blockquote>
          </CardContent>
        </Card>

        <div className="escola__rodape cta-48">
          <Button
            variant="primary"
            size="lg"
            onClick={onAvancar}
            data-acao="avancar-reflexao"
          >
            {PLATAFORMA.avancarParaReflexao}
          </Button>
        </div>
      </div>
    </div>
  );
}
