import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { TEXTOS } from "./textos";

/**
 * A copy canônica (`design/06-copy-strings-revisada.md`, passada 2) — os textos
 * que o briefing TRAVA estão aqui LITERAIS, e este teste é a rede: trocar uma
 * vírgula no `textos.ts` sem trocar o sheet faz a tela contar outra coisa que o
 * documento aprovado. E a suíte e2e casa por texto exato (ADR-91).
 */
describe("a copy literal do sheet", () => {
  test.each([
    ["e1.rotulo.app_titulo", TEXTOS.lista.titulo, "WhatsApp"],
    ["e1.rotulo.aba_conversas", TEXTOS.lista.abaConversas, "Conversas"],
    ["e1.narrativa.chat_nina_preview", TEXTOS.lista.previaDaNina, "Preciso da sua ajuda! Rolou uma..."],
    ["e1.rotulo.convite_subtitulo", TEXTOS.nina.conviteSubtitulo, "Convite para grupo de conversa"],
    ["e1.rotulo.entrar_grupo", TEXTOS.nina.entrarNoGrupo, "Entrar no grupo"],
    ["e2.feedback.sistema_entrou", TEXTOS.grupo.entrou, "Você entrou usando o link de convite deste grupo"],
    ["e2.instrucao.banner_topo", TEXTOS.grupo.banner, "Encaminhe 3 mensagens para o Mural da Turma"],
    ["e2.feedback.rodape_bloqueado", TEXTOS.grupo.soAdmins, "Apenas administradores podem enviar mensagens"],
    ["e2.rotulo.botao_avancar_mural", TEXTOS.grupo.irParaOMural, "Ir para o Mural da Turma"],
    [
      "e2.instrucao.microbanner_inatividade",
      TEXTOS.grupo.apoioDaNina,
      "Nina está esperando as 3 mensagens no Mural da Turma. Toque na seta ao lado das bolhas para escolher.",
    ],
    [
      "e2.erro.toast_menor_3",
      TEXTOS.grupo.faltamMensagens,
      "Você precisa selecionar exatamente 3 mensagens antes de continuar.",
    ],
    [
      "e2.erro.toast_limite_3",
      TEXTOS.grupo.limiteAtingido,
      "Limite de 3 mensagens atingido. Desmarque uma mensagem para escolher outra.",
    ],
    ["e2.erro.offline_cabecalho", TEXTOS.erros.conectando, "Conectando..."],
    ["e2.erro.sessao_expirada_modal", TEXTOS.erros.sessaoExpirada, "Sua conexão expirou. Toque para reconectar."],
    ["e2.rotulo.modal_fechar", TEXTOS.midia.fechar, "Fechar"],
    [
      "e2.acessibilidade.modal_alt_comunicado",
      TEXTOS.midia.altDoComunicado,
      "Imagem de comunicado escolar em papel timbrado com carimbo e assinatura",
    ],
    ["e2.rotulo.sheet_titulo", TEXTOS.folha.titulo, "Encaminhar para..."],
    ["e2.rotulo.sheet_destino", TEXTOS.folha.destino, "Mural da Turma"],
    ["e2.rotulo.sheet_subdestino", TEXTOS.folha.subdestino, "Conversa com a professora"],
    ["e2.rotulo.sheet_confirmar", TEXTOS.folha.enviar, "Enviar"],
    ["e3.rotulo.mural_titulo", TEXTOS.mural.titulo, "Mural da Turma"],
    ["e3.rotulo.tag_encaminhada", TEXTOS.mural.encaminhada, "Encaminhada"],
    ["e3.instrucao.revisao_aviso", TEXTOS.mural.confira, "Confira as 3 mensagens escolhidas antes de confirmar o envio."],
    ["e3.rotulo.botao_revisar", TEXTOS.mural.revisar, "Revisar seleção no grupo"],
    ["e3.rotulo.botao_confirmar", TEXTOS.mural.confirmar, "Confirmar envio"],
    ["e3.pergunta.enquete_titulo", TEXTOS.enquete.pergunta, "O que mais te fez escolher essas mensagens?"],
    ["e3.rotulo.enquete_votar", TEXTOS.enquete.votar, "Votar"],
    ["e3.feedback.espera_titulo", TEXTOS.espera.titulo, "Mensagens entregues no Mural da Turma"],
    [
      "e3.feedback.espera_descricao",
      TEXTOS.espera.descricao,
      "Você terminou esta etapa. Aguarde a orientação do professor para a revelação.",
    ],
    ["e3.feedback.espera_status", TEXTOS.espera.status, "Suas escolhas foram registradas com sucesso."],
    ["e5.instrucao.infografico_titulo", TEXTOS.sintese.titulo, "O gatilho do compartilhamento"],
    [
      "e5.narrativa.infografico_sintese",
      TEXTOS.sintese.frase,
      "A velocidade do repasse não mede a verdade da notícia. A desinformação não se espalha porque as pessoas querem mentir, mas porque a embalagem da mensagem (urgência, autoridade aparente, indignação ou calma técnica) desarma nosso filtro de checagem.",
    ],
    [
      "e5.narrativa.infografico_callback",
      TEXTOS.sintese.callback,
      "Vocês não estão descobrindo isso agora: desde o começo do bimestre vocês treinam duas ferramentas pra essa hora — comparar com uma fonte confiável e não deixar a emoção apertar o botão por você. Foi isso que usamos, ou esquecemos de usar, no Mural da Turma.",
    ],
    [
      "e5.feedback.trava_debate",
      TEXTOS.sintese.trava,
      "Participe da conversa na sala. O professor liberará a atividade final em instantes.",
    ],
    ["e6.rotulo.conclusao_titulo", TEXTOS.conclusao.titulo, "Missão Concluída"],
    ["e6.instrucao.conclusao_rodape", TEXTOS.conclusao.rodape, "Você completou todas as etapas desta missão no Unooria Hub."],
    [
      "e4.professor.telao_titulo",
      TEXTOS.revelacao.termometro.titulo,
      "Termômetro da Turma — Como a sala compartilhou",
    ],
  ])("%s", (_chave, texto, canonico) => {
    expect(texto).toBe(canonico);
  });

  test("os textos com número seguem o formato do sheet", () => {
    expect(TEXTOS.grupo.participantes(24)).toBe("você e mais 24 participantes");
    expect(TEXTOS.grupo.contador(2)).toBe("Mensagens selecionadas para o Mural: 2/3");
    expect(TEXTOS.revelacao.motivoDeclarado("Confiança em quem mandou")).toBe(
      "Seu motivo declarado: Confiança em quem mandou",
    );
    expect(TEXTOS.revelacao.termometro.falsaNeutraValor(68)).toBe("68% da turma repassou");
    expect(TEXTOS.revelacao.termometro.verdadeiraEmocionalValor(54)).toBe("54% da turma descartou");
    expect(TEXTOS.midia.transcricao("A direção informa.")).toBe("Texto do comunicado: A direção informa.");
  });

  test("o singular é concordância, não copy nova", () => {
    expect(TEXTOS.grupo.participantes(1)).toBe("você e mais 1 participante");
  });

  test("os crachás duplos: pictograma + rótulo por extenso, e os dois eixos com formas diferentes", () => {
    const { veracidade, tom } = TEXTOS.revelacao;
    expect(`${veracidade.verdadeira.icone} ${veracidade.verdadeira.rotulo}`).toBe("✅ Verdadeira");
    expect(`${veracidade.falsa.icone} ${veracidade.falsa.rotulo}`).toBe("❌ Falsa");
    expect(`${tom.emocional.icone} ${tom.emocional.rotulo}`).toBe("🔥 Emocional");
    expect(`${tom.neutra.icone} ${tom.neutra.rotulo}`).toBe("💬 Neutra");
    const pictogramas = new Set([veracidade.verdadeira.icone, veracidade.falsa.icone, tom.emocional.icone, tom.neutra.icone]);
    expect(pictogramas.size).toBe(4);
  });

  test("as palavras da lâmina desenhada estão todas na frase da síntese (o desenho não inventa)", () => {
    for (const palavra of [...TEXTOS.sintese.embalagens, TEXTOS.sintese.filtro]) {
      expect(TEXTOS.sintese.frase).toContain(palavra);
    }
  });
});

/**
 * O que o bundle NÃO pode carregar. O pacote do grupo, as falas da Nina que
 * dependem do servidor, o desafio do tio, as alternativas das perguntas (com o
 * nível) e o callback do motivo vêm da api — se um deles aparecer no código da
 * experiência, alguém o copiou para cá, e o gabarito (ou o texto que o
 * professor edita) passou a viajar no bundle público.
 *
 * O grep é por CONTEÚDO, não por nome de prop: `veracidade` e `verdadeira`
 * aparecem aqui de propósito (as chaves dos crachás). O que prova o segredo é o
 * texto do pacote e o par id ↔ resposta — a lição da v1.
 */
describe("o que o código da experiência não carrega", () => {
  const fontes: { caminho: string; texto: string }[] = [];
  const andar = (pasta: string) => {
    for (const nome of readdirSync(pasta)) {
      const caminho = join(pasta, nome);
      if (statSync(caminho).isDirectory()) andar(caminho);
      else if (/\.(ts|tsx|css)$/.test(nome) && !/\.test\.ts$/.test(nome)) {
        fontes.push({ caminho, texto: readFileSync(caminho, "utf8") });
      }
    }
  };
  andar("src");

  test("há fontes para varrer (senão o teste passaria vazio)", () => {
    expect(fontes.length).toBeGreaterThan(5);
  });

  test.each([
    ["o banco curado (remetentes)", /Pedro Henrique|Camila Duarte|Coordenação Pedagógica|Professora Helena/],
    ["o banco curado (conteúdo)", /portão lateral|Ofício Circular|museu pegou fogo|firma reconhecida/],
    ["as alternativas das perguntas", /Não dá pra saber só pelo tom|Eu sempre mando pro grupo|procuro a mesma notícia/],
    ["o nível das alternativas", /\b(em_processo|nao_atingiu)\b|\batingiu\b/],
    ["as falas que a api serve", /meu tio mandou um áudio|Pode confiar, essa é verdadeira|não deixar a pressa decidir/],
    ["um par id ↔ gabarito", /msg_[1-8]["'`]?\s*[:,=]\s*["'`]?(verdadeira|falsa|emocional|neutra)/],
  ])("%s", (_o, padrao) => {
    for (const { caminho, texto } of fontes) {
      expect(padrao.test(texto), caminho).toBe(false);
    }
  });
});
