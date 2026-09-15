---
paths:
  - "apps/hub/**/*.{tsx,ts}"
  - "apps/experiencias/**/*.{tsx,ts}"
  - "apps/api/src/**/*.ts"
---

# O idioma da interface — três zonas (ADR-91)

Regra transversal da plataforma. Complementa o `AGENTS.md` da raiz, que vence
em conflito.

## O idioma da interface — três zonas, e a fronteira é o que erra (ADR-91)

**Todo texto que uma pessoa lê é pt-BR** — rótulo, botão, título, `aria-label`,
`placeholder`, mensagem de erro, guia do professor, página legal. Mas "traduzir
tudo" faz a plataforma melhorar e as experiências piorarem, porque há três zonas
com regras opostas:

| Zona | Regra |
|---|---|
| **Plataforma** — hub, exp-9x do professor | pt-BR, sem exceção. É a Unooria falando com professor, gestor e estudante, e numa rede pública não se pode pressupor repertório de inglês |
| **Superfície disfarçada** — dentro do clone | o nome que o app REAL usa em português. `Shorts`, `Stories`, `Feed`, `Playlists`, `Ranking` FICAM: traduzi-los quebra o disfarce que a experiência está medindo |
| **O professor falando SOBRE o clone** — guia da aula, catálogo, painéis | depende de o termo nomear um objeto na tela ou ser jargão vazado — abaixo |

**A fronteira, que é onde se erra:** o termo **nomeia um objeto que está na
tela** (`feed`, `Shorts`, `ranking`)? Fica — traduzir faria o guia dizer uma
palavra e a tela mostrar outra, e o professor perde o referente no meio da aula.
É **jargão de implementação que vazou** (`card de pausa`, `o modal`, `num
popup`)? Traduz: não nomeia nada que a criança veja, descreve a mecânica da
interface, e o professor não tem por que saber o que é um "modal". As traduções
já feitas: **tela** de pausa, **quadro** de sistematização, **janela** (para
`modal` e `popup`), **usuário** (para `login`), **dica** (para `insight`).

**Identificador NÃO é texto.** Ficam como estão, e mudá-los é outra tarefa com
outro custo: chave de objeto, rota, nome de coluna, verbo/objeto de telemetria,
nome de glifo do Material Symbols (`checklist`, `psychology`, `schedule`),
variante de componente (`warning`, `success`, `danger`), severidade de log,
método HTTP. O rótulo `abertura: 'A missão'` mudou; o `'abertura'` do banco não.

**Anglicismo que FICA por decisão pedagógica, não por esquecimento** — a lista é
curta e cada item tem razão registrada na ADR-91: `fake news` (consagrado no
Brasil, e a instrução "não anuncie que é uma aula sobre fake news" perde o
sentido traduzida — o que o professor não deve dizer é a expressão que a criança
reconhece), `cyberbullying` (BNCC EF07CO09 e Lei 13.185/2015), `print` (é a
palavra da criança, e a exp-06/07 gira em torno desse objeto), `chat`, `on-line`
(citação verbatim da BNCC). **Não "corrija" nenhum deles.**

**Rótulo visível em dois lugares muda nos DOIS.** `ROTULO_PASSO` da exp-03 é
espelho declarado de `apps/api/src/unoogpt/regras/passos.ts`; mudar um só faz a
trilha do estudante divergir do que a api devolve. E **a suíte e2e casa por
texto exato** (`getByText`, `getByRole({name})`): trocar copy sem atualizar a
suíte a derruba com timeout, e o timeout reporta o seletor que faltou, nunca a
causa.
