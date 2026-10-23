import type { RespostaDossie } from '../../../lib/dossie-tipos';

import { CORES_DE_SERIE } from './cores';

/** Dossiê em texto (doc 02 §5.8): insumo do relatório em dupla do doc 09. */
export function dossieEmTexto(dados: RespostaDossie): string {
  const { dossie, posts } = dados;
  const nomeEstudante = dossie.estudante?.displayName ?? 'Estudante';
  const pct = (valor: number) => `${Math.round(valor * 100)}%`;
  const rotulo =
    dossie.ladoDominante === 'A'
      ? dossie.atividade.ladoALabel
      : dossie.ladoDominante === 'B'
        ? dossie.atividade.ladoBLabel
        : 'nenhum lado dominante';

  const rotuloDoLado = (lado: 'A' | 'B') =>
    lado === 'A' ? dossie.atividade.ladoALabel : dossie.atividade.ladoBLabel;
  const semeado = rotuloDoLado(dossie.bolha.ladoInicial);
  const duracao = (ms: number) => {
    const total = Math.round(ms / 1000);
    return total >= 60 ? `${Math.floor(total / 60)}min${String(total % 60).padStart(2, '0')}s` : `${total}s`;
  };
  const outroLado = dossie.bolha.ladoInicial === 'A' ? 'B' : 'A';

  const linhas = [
    `RELATÓRIO — ${nomeEstudante}`,
    dossie.atividade.titulo,
    '',
    `PERGUNTA DO DEBATE: ${dossie.atividade.perguntaChave}`,
    '',
    'POR QUE MEU FEED COMEÇOU DESSE LADO',
    dossie.explicacaoDoLado.origem === 'perfil'
      ? `- no jogo, o que mais me move é ${dossie.explicacaoDoLado.perfilRotulo}; o lado que fala essa língua é ${semeado}${dossie.explicacaoDoLado.porQue ? `: ${dossie.explicacaoDoLado.porQue}` : ''}`
      : dossie.explicacaoDoLado.origem === 'redistribuido'
        ? `- comecei em ${semeado}: o lado foi ajustado para a turma não ficar toda do mesmo lado`
        : `- comecei em ${semeado}: sem o resultado do jogo, o lado foi sorteado`,
    '',
    'VIREI O JOGO?',
    dossie.bolha.inverteu
      ? `- comecei em ${semeado} e terminei em ${rotulo}${dossie.bolha.blocoDaInversao ? ` (a virada apareceu no ${dossie.bolha.blocoDaInversao}º bloco)` : ''}`
      : `- comecei em ${semeado} e terminei em ${rotulo}`,
    '',
    'TEMPO DE TELA',
    `- posts de ${semeado}: ${duracao(dossie.tempo.porLadoMs[dossie.bolha.ladoInicial])}`,
    `- posts do outro lado: ${duracao(dossie.tempo.porLadoMs[outroLado])}`,
    `- outros assuntos: ${duracao(dossie.tempo.porLadoMs.neutro)}`,
    `- no app, do começo ao fim: ${duracao(dossie.tempo.feedMs)}`,
    '',
    'MEU MUNDO NO FEED',
    `- ${dossie.atividade.ladoALabel}: ${pct(dossie.proporcaoFinal.A)}`,
    `- ${dossie.atividade.ladoBLabel}: ${pct(dossie.proporcaoFinal.B)}`,
    `- outros assuntos: ${pct(dossie.proporcaoFinal.neutro)}`,
    `- lado dominante: ${rotulo} (domínio ${pct(dossie.dominio)})`,
    '',
    'A BOLHA SE FECHANDO (por bloco)',
    ...dossie.porBloco.map(
      (bloco) =>
        `- bloco ${bloco.bloco}: ${dossie.atividade.ladoALabel} ${pct(bloco.A)} · ${dossie.atividade.ladoBLabel} ${pct(bloco.B)} · outros ${pct(bloco.neutro)} · intensidade média do lado dominante ${bloco.intensidadeMediaDominante}`,
    ),
    '',
    'O QUE ME PRENDEU (top 5 por tempo de tela)',
    ...posts.topDwell.map(
      (post, indice) =>
        `${indice + 1}. ${post.segundos.toString().replace('.', ',')}s — ${post.handle}: ${post.caption.slice(0, 90)}`,
    ),
    '',
    `O QUE EU NUNCA VI: o algoritmo escondeu ${dossie.postsOcultados.total} posts do outro lado.`,
    '',
    'COMO ELE DECIDIU',
    ...dossie.sinais.map((sinal) => `- ${sinal.sinal}: ${sinal.valorSessao}`),
    '',
    `INTERAÇÕES: ${dossie.interacoes.curtidas} curtidas · ${dossie.interacoes.comentarios} comentários · ${dossie.interacoes.salvos} salvos · ${dossie.interacoes.seguidos} perfis seguidos · ${dossie.interacoes.naoInteressa} "não tenho interesse"`,
    '',
    'A SAÍDA QUE EXISTIA',
    dossie.investigacao.usosDaBusca > 0
      ? `- abri a busca ${dossie.investigacao.usosDaBusca}x (ela não é filtrada por lado)${dossie.investigacao.termosBuscados.length > 0 ? `: ${dossie.investigacao.termosBuscados.slice(0, 6).join(', ')}` : ''}`
      : '- não abri a busca nenhuma vez, e ela mostrava os dois lados sem filtro',
    `- posts do outro lado em que realmente parei: ${dossie.investigacao.consideracaoDoOposto}`,
    '- o algoritmo estreitou o meu feed; as minhas próprias escolhas estreitaram mais.',
    '',
    'O JEITO DE FALAR COMIGO (dwell ÷ exposição)',
    ...dossie.rotulosDePerfil.map(
      (perfil) =>
        `- ${perfil.rotulo}: ${pct(dossie.perfilObservado.normalizado[perfil.chave] ?? 0)}${dossie.perfilJogo?.dominante === perfil.chave ? ' (o do jogo)' : ''}`,
    ),
    dossie.perfilObservado.veredito === 'reforcou'
      ? '- aqui dentro, o jeito que mais me segurou foi o mesmo que o jogo apontou'
      : dossie.perfilObservado.veredito === 'divergiu'
        ? '- aqui dentro, o jeito que mais me segurou foi outro, e não tem nada de errado nisso'
        : '- nesta sessão não deu para dizer qual jeito me segurou mais',
  ];

  if (dossie.conclusao) {
    linhas.push(
      '',
      'MINHA CONCLUSÃO',
      `- inclinação: ${dossie.conclusao.inclinacao === 'duvida' ? 'ainda em dúvida' : rotuloDoLado(dossie.conclusao.inclinacao)}`,
      `- "${dossie.conclusao.texto}"`,
      `- meu feed havia começado em: ${semeado}`,
    );
  }

  if (dossie.studentPost) {
    linhas.push('', `MEU POST: "${dossie.studentPost.texto}"`);
  }

  linhas.push(
    '',
    'Simulação feita para a aula. Os perfis e os posts foram criados por IA.',
    'O perfil do jogo é uma pista sobre aquele dia e não diz quem eu sou.',
    'Meus dados ficam com meu professor e não vão para nenhuma rede real.',
  );

  return linhas.join('\n');
}

/** PNG do dossiê desenhado em canvas (sem dependência externa). */
export function dossieEmPng(dados: RespostaDossie): Promise<Blob | null> {
  const { dossie } = dados;
  const largura = 1080;
  const altura = 1350;

  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);

  const pct = (valor: number) => Math.round(valor * 100);

  ctx.fillStyle = '#0B0B10';
  ctx.fillRect(0, 0, largura, altura);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 58px -apple-system, Helvetica, Arial, sans-serif';
  ctx.fillText('Meu feed virou', 80, 150);

  const rotulo =
    dossie.ladoDominante === 'A'
      ? dossie.atividade.ladoALabel
      : dossie.ladoDominante === 'B'
        ? dossie.atividade.ladoBLabel
        : 'um feed equilibrado';

  ctx.fillStyle = '#FF9A6E';
  ctx.font = 'bold 58px -apple-system, Helvetica, Arial, sans-serif';
  const linhas = quebrarTexto(ctx, `um feed de: ${rotulo}`, largura - 160);
  linhas.forEach((linha, indice) => ctx.fillText(linha, 80, 225 + indice * 66));

  // Barras da proporção final
  const base = 245 + linhas.length * 66;
  const barras: [string, number, string][] = [
    [dossie.atividade.ladoALabel, pct(dossie.proporcaoFinal.A), CORES_DE_SERIE.escuro.A],
    [dossie.atividade.ladoBLabel, pct(dossie.proporcaoFinal.B), CORES_DE_SERIE.escuro.B],
    ['Outros assuntos', pct(dossie.proporcaoFinal.neutro), CORES_DE_SERIE.escuro.neutro],
  ];

  barras.forEach(([nome, valor, cor], indice) => {
    const y = base + indice * 110;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '32px -apple-system, Helvetica, Arial, sans-serif';
    ctx.fillText(`${nome} — ${valor}%`, 80, y);

    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(80, y + 18, largura - 160, 26);
    ctx.fillStyle = cor;
    ctx.fillRect(80, y + 18, ((largura - 160) * valor) / 100, 26);
  });

  // Números da sessão
  const yNumeros = base + 3 * 110 + 40;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 40px -apple-system, Helvetica, Arial, sans-serif';
  ctx.fillText('Os sinais que ele usou', 80, yNumeros);

  ctx.font = '30px -apple-system, Helvetica, Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  dossie.sinais.slice(0, 5).forEach((sinal, indice) => {
    ctx.fillText(`${sinal.sinal}: ${sinal.valorSessao}`, 80, yNumeros + 55 + indice * 48);
  });

  const yEscondeu = yNumeros + 55 + 5 * 48 + 50;
  ctx.fillStyle = '#FF6E6E';
  ctx.font = 'bold 40px -apple-system, Helvetica, Arial, sans-serif';
  ctx.fillText(`Ele escondeu ${dossie.postsOcultados.total} posts do outro lado`, 80, yEscondeu);

  // A pergunta
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'italic 34px -apple-system, Helvetica, Arial, sans-serif';
  quebrarTexto(ctx, `"${dossie.atividade.perguntaChave}"`, largura - 160).forEach((linha, indice) =>
    ctx.fillText(linha, 80, yEscondeu + 90 + indice * 46),
  );

  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '24px -apple-system, Helvetica, Arial, sans-serif';
  const nomeEstudantePng = dossie.estudante?.displayName ?? 'Estudante';
  ctx.fillText(`${nomeEstudantePng} · simulação educacional · posts gerados por IA`, 80, altura - 70);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
}

function quebrarTexto(ctx: CanvasRenderingContext2D, texto: string, larguraMaxima: number): string[] {
  const palavras = texto.split(' ');
  const linhas: string[] = [];
  let atual = '';

  for (const palavra of palavras) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (ctx.measureText(tentativa).width > larguraMaxima && atual) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = tentativa;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}
