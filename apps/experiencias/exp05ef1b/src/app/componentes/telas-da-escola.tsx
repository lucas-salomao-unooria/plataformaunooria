import { useState } from "react";
import {
  AlertBox,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  TextArea,
} from "@edu/ui/ds";
import { TEXTOS } from "../../lib/textos";
import type { Podcast } from "../../lib/tipos";

/**
 * As telas de FORA do mensageiro — a abertura, a espera do preparo, o dilema e
 * o fim.
 *
 * **A fronteira do disfarce é QUEM FALA, não o arquivo.** Nina abre a missão
 * pela escola ("a diretora pediu"), o estudante entra no grupo, e de lá até o
 * card de síntese quem conduz é o app clonado. A pergunta do tio sai do
 * mensageiro de propósito: ela não é sobre o grupo da turma, é sobre o grupo da
 * FAMÍLIA dele — a transferência para a vida fora da tela é a coisa que a
 * missão existe para produzir, e fazê-la dentro do disfarce a devolveria para
 * dentro da ficção.
 */

// ───────────────────────────────── a espera do preparo: a missão nasce vazia

/**
 * Sem lote homologado não há missão — e esta tela é a consequência.
 *
 * Diferente da exp08ef4b, não há banco curado de reserva para cair: o lote é do
 * TEMA que a professora escolheu, e servir outro faria a criança ler mensagens
 * sobre um acontecimento que não existiu na escola dela. O polling de 5 s é o
 * que tira o estudante daqui sozinho, sem que ninguém precise pedir um F5.
 */
export function TelaDeEsperaDoPreparo() {
  return (
    <div className="escola">
      <div className="escola__pilha">
        <AlertBox>
          <strong>{TEXTOS.preparo.titulo}</strong>
        </AlertBox>
        <p className="escola__paragrafo">{TEXTOS.preparo.corpo}</p>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────── Etapa 1: a abertura (Nina)

export function TelaDeAbertura({ nome, aoEntrar }: { nome: string; aoEntrar: () => void }) {
  return (
    <div className="escola">
      <div className="escola__pilha">
        <h1 className="escola__titulo">{TEXTOS.contexto.saudacao(nome)}</h1>
        <p className="escola__paragrafo">{TEXTOS.contexto.nina}</p>

        <Card>
          <CardHeader>
            <CardTitle>{TEXTOS.contexto.cardTitulo}</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Nada de prévia das mensagens aqui. A primeira leitura do grupo
                tem de acontecer DENTRO do mensageiro, com a rolagem e o tempo
                que a missão mede — um resumo na abertura entregaria a cena
                antes de o relógio começar. */}
            <p className="escola__paragrafo">8 mensagens novas</p>
          </CardContent>
        </Card>

        <Button onClick={aoEntrar}>{TEXTOS.contexto.entrar}</Button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────── Etapa 6: o dilema do tio

export function TelaDaReflexao({
  pergunta,
  piso,
  teto,
  salvando,
  aoEntregar,
}: {
  pergunta: string;
  piso: number;
  teto: number;
  salvando: boolean;
  aoEntregar: (texto: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const limpo = texto.trim();

  return (
    <div className="escola">
      <div className="escola__pilha">
        <h2 className="escola__titulo">{TEXTOS.reflexao.titulo}</h2>

        <Card>
          <CardContent>{pergunta}</CardContent>
        </Card>

        {/* `TextArea` do DS é um campo de formulário, e é por ele que o
            manifesto pede `permissoes: ["forms"]`: sem o token no `sandbox` do
            iframe o submit morre EM SILÊNCIO — a criança escreve, toca em
            "Concluir Missão" e nada acontece, sem erro em lugar nenhum. */}
        {/* `label`: sem ele o campo é um `<textarea>` anônimo — o `placeholder`
            some ao primeiro caractere, e quem usa leitor de tela fica com a
            pergunta lida num `Card` acima e um campo que não diz ao que
            responde.

            `showCounter={false}`: o `TextArea` do DS liga o contador SOZINHO
            quando recebe `maxLength`, então a tela mostrava dois — o do pacote
            ("0/500") e o daqui. E é o daqui que fica, porque só ele diz o
            MÍNIMO, que é o que destrava o botão. */}
        <TextArea
          value={texto}
          label={TEXTOS.reflexao.rotuloDoCampo}
          maxLength={teto}
          showCounter={false}
          rows={6}
          placeholder={TEXTOS.reflexao.placeholder}
          onChange={(e: { target: { value: string } }) => setTexto(e.target.value)}
        />
        <p className="escola__contador">{TEXTOS.reflexao.contador(texto.length, teto, piso)}</p>

        {/* O piso é contado no texto APARADO, como o Zod da api faz: cinco
            espaços passariam no `length` e seriam recusados com 400 depois de a
            criança já ter apertado o botão. */}
        <Button disabled={limpo.length < piso || salvando} onClick={() => aoEntregar(limpo)}>
          {TEXTOS.reflexao.concluir}
        </Button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────── o fim da missão

export function TelaConcluida({ texto, podcast }: { texto: string | null; podcast: Podcast }) {
  return (
    <div className="escola">
      <div className="escola__pilha">
        <AlertBox>
          <strong>{TEXTOS.fim.titulo}</strong> {TEXTOS.fim.corpo}
        </AlertBox>

        {texto && (
          <Card>
            <CardHeader>
              <CardTitle>{TEXTOS.fim.suaResposta}</CardTitle>
            </CardHeader>
            <CardContent>{texto}</CardContent>
          </Card>
        )}

        {/*
          O episódio de recapitulação, em TEXTO, e **depois** da entrega — nunca
          junto do dilema, como a exp06ef2b faz com o "Meu percurso".
          Aqui ele não pode vir antes: o bloco "Provocação e transferência" do
          roteiro descreve o áudio do tio e diz o que fazer com ele. Na tela da
          pergunta, isso seria a resposta impressa acima do campo.

          A locução de 3m40 do brief não foi gravada, e a missão roda igual: a
          transcrição é acessibilidade de sala sem fone, não remendo. Quando o
          áudio chegar, entra ao lado do texto.
        */}
        <Card>
          <CardHeader>
            <CardTitle>{podcast.titulo}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="escola__podcast">
              {podcast.blocos.map((b) => (
                <div key={b.rotulo}>
                  <strong className="escola__rotulo">{b.rotulo}</strong>
                  <ul className="escola__falas">
                    {b.falas.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
