import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MensagemDoVoluntario } from './app/pecas/mensagem-do-voluntario';

/**
 * O CANAL A NA TELA (1.5.0, ADR-172/170): a única peça de outra seção e a
 * saída das perguntas de múltipla escolha.
 */
const TEXTO = 'Sou voluntário do resgate no Morro Alto. Me manda a lista?';

function arquivos(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    return statSync(caminho).isDirectory() ? arquivos(caminho) : [caminho];
  });
}

describe('o balão do pedido pelo WhatsApp (clone dentro de clone, ADR-173)', () => {
  const html = renderToStaticMarkup(<MensagemDoVoluntario texto={TEXTO} />);

  it('fica preso no contêiner da peça, com o tema CLARO fixado nele', () => {
    expect(html).toContain('class="peca-unoochat"');
    expect(html).toContain('data-unc-theme="light"');
    expect(html).toContain(TEXTO);
  });

  it('não traz hora nem tiques: só a mensagem', () => {
    expect(html).not.toMatch(/\b\d{1,2}:\d{2}\b/);
  });

  it('a peça importa SÓ a ponte do unoochat, e só ela importa essa ponte', () => {
    const fontes = arquivos(join(__dirname, 'app'));
    const comUnoochat = fontes.filter((f) => readFileSync(f, 'utf8').includes('ds-unoochat'));
    expect(comUnoochat.map((f) => f.replace(/.*\/app\//, 'app/'))).toEqual(['app/pecas/mensagem-do-voluntario.tsx']);
  });
});

describe('o Canal B saiu (ADR-172)', () => {
  it('nenhuma tela pede as perguntas de múltipla escolha da ficha', () => {
    for (const f of arquivos(join(__dirname))) {
      expect(readFileSync(f, 'utf8')).not.toMatch(/\/evidencias\/\$\{EXP_ID\}\/perguntas|\/evidencias\/exp02em1b-v0\/perguntas/);
    }
  });
});
