import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { BFF, HUB, suite } from "../lib/roteiro.mjs";
import { conta, escolas } from "../lib/credenciais.mjs";

/**
 * A criança que muda de escola — dentro da rede e para fora dela.
 *
 * DENTRO DA REDE, o CPF é o que reconhece a mesma pessoa. A escola de destino
 * importa a planilha dela e a plataforma entende TRANSFERÊNCIA, não cadastro
 * novo: o histórico atravessa, e as duas matrículas ficam na trajetória.
 *
 * PARA FORA DA REDE, o caminho é o perfil portátil: um documento JSON assinado
 * (JWS) que a família leva. Ele é emitido pela escola de origem e recebido pela
 * de destino, que confere a assinatura contra os emissores configurados.
 *
 * A parte mais importante desta suíte é a última: um byte trocado no documento
 * tem de ser RECUSADO. É o único lugar do recurso onde um erro silencioso seria
 * grave — um perfil adulterado aceito é um histórico escolar falsificado.
 */
const { primeira: ESCOLA_1, segunda: ESCOLA_2 } = escolas();
const SENHA_DO_LOTE = "RedeE2E2026";

/** CPF válido (dígitos verificadores conferem), usado só por esta suíte. */
const CPF = "390.533.447-05";
const TURMA_ORIGEM = "3X";
const TURMA_DESTINO = "4X";

const NA_ORIGEM = [
  "cpf,matricula,nome,usuario,papel,turma,serie,turno",
  `${CPF},E2E-RED-A1,Iara Menezes Costa,iara.e2e,estudante,${TURMA_ORIGEM},3EF,manha`,
  "",
].join("\n");

/** A MESMA criança, agora na outra escola: o CPF é o que a reconhece. */
const NO_DESTINO = [
  "cpf,matricula,nome,papel,turma,serie,turno",
  `${CPF},E2E-RED-A1,Iara Menezes Costa,estudante,${TURMA_DESTINO},4EF,tarde`,
  "",
].join("\n");

await suite(
  {
    slug: "gestor_contrato/04-transferencia-e-perfil-portatil",
    papel: "gestor_contrato",
    titulo: "A criança que muda de escola",
    subtitulo: "transferência pelo CPF dentro da rede, e o documento assinado que sai dela",
    contexto:
      "Crianças mudam de escola no meio do ano — é o caso comum, não a exceção. Dentro da rede, o " +
      "CPF as reconhece e o histórico atravessa. Para fora, o que elas levam é um documento " +
      "assinado que a rede de destino consegue conferir.",
    prova: [
      "Importar a mesma criança em outra escola é TRANSFERÊNCIA, não cadastro novo",
      "O histórico dela mostra as duas escolas, com o CPF completo para conferência",
      "O perfil portátil é emitido como JSON assinado (JWS)",
      "Ele é recebido de volta e a assinatura é conferida",
      "Um documento adulterado é RECUSADO",
    ],
    comando: "node scripts/e2e/gestor_contrato/04-transferencia-e-perfil-portatil.mjs",
  },
  async (r) => {
    const p = await r.pagina("gestor_contrato");
    await r.entrar(p, conta("gestor_contrato").login);

    /** Importa pela api, via BFF — o valor visual está na TELA depois. */
    const importar = async (escolaId, arquivo) => {
      const params = new URLSearchParams({ senhaPadrao: SENHA_DO_LOTE, escolaId });
      const resposta = await p.request.post(`${BFF}/rostering/importar?${params}`, {
        headers: { "content-type": "text/csv" },
        data: arquivo,
      });
      return resposta.json();
    };

    // ── a mesma criança, duas escolas ───────────────────────────────────
    const naOrigem = await importar("escola-demo", NA_ORIGEM);
    console.log(
      `      origem: ${naOrigem.criados} criados, ${naOrigem.transferidos ?? 0} transferidos, ` +
        `${naOrigem.erros?.length ?? 0} erro(s)`,
    );

    const noDestino = await importar("escola-demo-2", NO_DESTINO);
    r.exigir(
      noDestino.criados === 0 && noDestino.transferidos === 1,
      `o CPF reconheceu a mesma criança: ${noDestino.transferidos ?? 0} transferida(s), ` +
        `${noDestino.criados ?? 0} criada(s) do zero`,
    );

    await p.goto(`${HUB}/admin/turmas?escolaId=escola-demo-2`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(2500);
    const linhaDaTurma = p.locator("table tbody tr", { hasText: TURMA_DESTINO });
    r.exigir((await linhaDaTurma.count()) > 0, `a turma ${TURMA_DESTINO} existe na escola de destino`);
    await Promise.all([
      p.waitForURL(/\/admin\/turmas\/[0-9a-f-]{36}/, { timeout: 20_000 }),
      linhaDaTurma.getByRole("button", { name: "Abrir" }).click(),
    ]);
    await p.waitForTimeout(2000);
    await r.registrar(p, "criança-na-escola-nova", {
      titulo: "A mesma criança, na escola nova",
      mostra: `A turma ${TURMA_DESTINO} da ${ESCOLA_2}, com a estudante transferida.`,
      prova:
        "A escola de destino não cadastrou ninguém: ela importou a planilha dela, e o CPF fez a " +
        "plataforma entender que era transferência. Cadastro novo criaria uma segunda criança " +
        "com o histórico zerado.",
    });

    const linhaDaEstudante = p.locator("table tbody tr", { hasText: "Iara Menezes" });
    await linhaDaEstudante.getByRole("button", { name: "Histórico" }).click();
    await p.getByText(/Histórico de/).waitFor({ timeout: 20_000 });
    await p.waitForTimeout(1000);
    const dialogo = p.getByTestId("unooria-modal");
    const texto = await dialogo.innerText();
    r.exigir(
      texto.includes(ESCOLA_1) && texto.includes(ESCOLA_2),
      "o histórico mostra as DUAS escolas da trajetória",
    );
    r.exigir(texto.includes(CPF), "e o CPF completo, formatado — é como o gestor confere que é a criança certa");
    await r.registrar(p, "historico-entre-escolas", {
      titulo: "O histórico atravessa as escolas",
      mostra: "A trajetória da criança, com as duas matrículas e o CPF.",
      prova:
        "É o que a transferência preserva. Sem isso, mudar de escola no meio do ano apagaria tudo " +
        "o que a criança fez até ali — e ela recomeçaria a trilha do zero.",
    });
    await p.getByRole("button", { name: "Fechar", exact: true }).click();
    await p.waitForTimeout(800);

    // ── o perfil portátil: emitir ───────────────────────────────────────
    await linhaDaEstudante.getByRole("button", { name: "Perfil portátil" }).click();
    await p.getByText("Isto é para sair da REDE").waitFor({ timeout: 20_000 });
    await p.waitForTimeout(1200);
    await r.registrar(p, "perfil-portatil", {
      titulo: "O que a criança leva ao sair da rede",
      mostra: "O diálogo de emitir, receber e a lista do que já foi recebido sobre esta criança.",
      prova:
        "Transferência é para dentro da rede. Para fora dela não há banco compartilhado — o que " +
        "existe é um documento que a família leva e a outra rede consegue conferir.",
    });

    const modal = p.getByTestId("unooria-modal");
    const [download] = await Promise.all([
      p.waitForEvent("download", { timeout: 40_000 }),
      modal.getByRole("button", { name: "Emitir e baixar" }).click(),
    ]);
    const caminho = join(r.saida, download.suggestedFilename());
    await download.saveAs(caminho);
    const documento = JSON.parse(readFileSync(caminho, "utf8"));
    const assinado =
      typeof documento.assinatura === "string" && documento.assinatura.split(".").length === 3;
    r.exigir(assinado, `o documento sai assinado em JWS (3 segmentos)`);
    r.exigir(
      Boolean(documento.perfil?.emissor?.contrato),
      `e declara o emissor (${documento.perfil?.emissor?.contrato})`,
    );
    await r.registrar(p, "documento-emitido", {
      titulo: "O documento emitido",
      mostra: `${download.suggestedFilename()} — JSON assinado, baixado pelo gestor.`,
      prova:
        "A assinatura é o que permite a outra rede confiar num arquivo que veio pela mão da " +
        "família. Sem ela, o documento seria um PDF que qualquer um edita.",
      detalhe: `${download.suggestedFilename()} · ${assinado ? "JWS presente" : "SEM JWS"}`,
    });

    // ── receber o mesmo arquivo, como se viesse de outra rede ───────────
    await modal.locator('input[type="file"]').setInputFiles(caminho);
    await p.getByText(/Perfil recebido/).waitFor({ timeout: 25_000 });
    await p.waitForTimeout(1800);
    /* A LISTA é a prova de que o documento entrou — a mensagem some no próximo
       clique. E o veredito se lê no AVISO DESTA importação: o texto do diálogo
       inteiro carrega as linhas de execuções anteriores. */
    const naLista = await modal.locator("li", { hasText: /emitido em/ }).count();
    const aviso = await modal.locator('[class*="feedback"], [role="alert"]').last().innerText();
    const conferiu = /assinatura confere/i.test(aviso);
    r.exigir(naLista > 0, `o documento entrou na lista de recebidos (${naLista})`);
    await modal.getByText("Recebidos").scrollIntoViewIfNeeded();
    await r.registrar(p, "documento-recebido", {
      titulo: "E recebido de volta",
      mostra: `${naLista} documento(s) na lista de recebidos sobre esta criança.`,
      prova: conferiu
        ? "A assinatura foi conferida contra os emissores configurados nesta instalação."
        : "Sem emissores configurados, o documento entra marcado como NÃO VERIFICADO — e a tela " +
          "diz isso, em vez de fingir que conferiu.",
      detalhe: conferiu ? "assinatura conferida" : "marcado como não verificado",
    });

    // ── e um byte trocado ───────────────────────────────────────────────
    /*
     * O 400 que vem a seguir é a PROVA, não o defeito: a rota recusa o
     * documento cuja assinatura não cobre mais o conteúdo. Sem declarar isso, a
     * suíte reprovava por "erro de console" com as 8 verificações VERDES — o
     * pior tipo de vermelho, o que acusa a trava de segurança justamente por
     * ela ter funcionado.
     */
    r.provocado(/perfil-recebido/, "a rota recusa o documento adulterado — é o que esta suíte existe para provar");

    const adulterado = JSON.parse(JSON.stringify(documento));
    adulterado.perfil.titular.nome = "Outra Criança Qualquer";
    const caminhoRuim = join(r.saida, "adulterado.json");
    writeFileSync(caminhoRuim, JSON.stringify(adulterado, null, 2), "utf8");

    await modal.locator('input[type="file"]').setInputFiles(caminhoRuim);
    await p.waitForTimeout(3000);
    const textoFinal = await modal.innerText();
    const recusou = /Recusado/i.test(textoFinal);
    await r.registrar(p, "documento-adulterado", {
      titulo: "Um byte trocado",
      mostra: recusou
        ? "O documento adulterado, recusado pela tela."
        : "O documento adulterado, marcado como não verificado.",
      prova:
        "É o único ponto do recurso onde um erro silencioso seria grave: um perfil adulterado " +
        "aceito é um histórico escolar falsificado entrando na rede.",
      detalhe: recusou ? "RECUSADO — a assinatura não cobre o conteúdo" : "não verificado",
    });

    /* A garantia: ONDE HÁ VERIFICAÇÃO, um byte trocado não passa. Sem
       `PORTABILIDADE_EMISSORES` não há o que conferir, e os dois caminhos caem
       em `nao-verificada` — aí não há o que exigir, e dizer isso é mais honesto
       que reprovar um ambiente que não configurou emissores. */
    if (conferiu) {
      r.exigir(recusou, "onde a instalação confere assinatura, o documento adulterado é RECUSADO");
    } else {
      r.ressalva(
        "esta instalação não tem `PORTABILIDADE_EMISSORES` configurado: sem emissor conhecido não " +
          "há assinatura a conferir, e os dois documentos entram como não verificados. A recusa por " +
          "assinatura inválida só se prova num ambiente com emissores",
      );
    }
  },
);
