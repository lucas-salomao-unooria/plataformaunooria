import { Button } from "@edu/ui/ds";
import { TEXTOS } from "../lib/textos";

/**
 * A pauta do grêmio (Etapa 1) — quem fala é a ESCOLA (seção `unooria`): o
 * disfarce começa no toque em "Iniciar Campanha", que abre o UnooriaAI. Sem
 * pacote no ar, a mesma tela espera o professor, na voz da ficção.
 */
export function Abertura({ preparada, onIniciar }: { preparada: boolean; onIniciar: () => void }) {
  return (
    <main className="app app--centrado escola">
      <div className="cartao">
        <h1 className="cartao__titulo">{TEXTOS.abertura.titulo}</h1>
        <p className="cartao__texto">{TEXTOS.abertura.gremio}</p>
        <p className="cartao__texto">{TEXTOS.abertura.instrucao}</p>
        <div className="cartao__acoes">
          {preparada ? (
            <Button onClick={onIniciar}>{TEXTOS.abertura.iniciar}</Button>
          ) : (
            <p className="aviso" role="status">
              {TEXTOS.abertura.preparo}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
