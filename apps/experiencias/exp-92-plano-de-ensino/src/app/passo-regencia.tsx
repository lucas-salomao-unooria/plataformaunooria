import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  FeedbackAlert,
  Icon,
  SectionHeader,
  Selection,
  TextField,
  Toggle,
} from "@edu/ui/ds";

import { api } from "../lib/api";
import {
  ANOS,
  DIAS,
  rotuloDoAno,
  type CatalogoDeComponentes,
  type Configuracao,
  type Divisao,
  type FaixaDeHorario,
} from "../lib/tipos";

/**
 * PASSO 1 — A REGÊNCIA.
 *
 * O professor diz o que leciona e com quanta aula. É o passo que dimensiona
 * todo o resto: sem ele o plano anual distribuiria habilidades em "quatro
 * bimestres" sem saber se cabem 200 aulas de Matemática ou 40 de Arte.
 *
 * Três decisões de interface que valem explicação:
 *
 * 1. A carga horária vem PRÉ-PREENCHIDA com a mediana de nove redes públicas,
 *    e a tela diz que é sugestão. Campo numérico vazio é a forma mais rápida de
 *    fazer o professor desistir; número errado apresentado como obrigação legal
 *    é pior ainda, porque a BNCC não define grade horária — quem define é a rede.
 *
 * 2. `habilidadesPorArea` aparece como aviso VISÍVEL. O professor de Biologia
 *    precisa saber, antes de escolher, que as habilidades que vai ver são de
 *    Ciências da Natureza inteira. Descobrir isso na tela seguinte parece bug.
 *
 * 3. A grade de horários é conferida contra as aulas semanais declaradas. O erro
 *    clássico é digitar "5 aulas" e marcar dois dias com uma aula cada — e sem
 *    aviso a incoerência só aparece em setembro, quando o conteúdo não fecha.
 */

const valorSimples = (v: string | string[]) => (Array.isArray(v) ? (v[0] ?? "") : v);

const DIVISOES: { value: Divisao; label: string }[] = [
  { value: "bimestral", label: "Bimestral — 4 períodos de 10 semanas" },
  { value: "trimestral", label: "Trimestral — 3 períodos de ~13 semanas" },
  { value: "semestral", label: "Semestral — 2 períodos de 20 semanas" },
];

interface Props {
  configuracao: Configuracao | null;
  onSalvo: (c: Configuracao) => void;
  onCancelar: () => void;
}

export function PassoRegencia({ configuracao, onSalvo, onCancelar }: Props) {
  const [ano, setAno] = useState(configuracao?.serie ?? "");
  const [componente, setComponente] = useState(configuracao?.componente ?? "");
  const [catalogo, setCatalogo] = useState<CatalogoDeComponentes | null>(null);
  const [carregando, setCarregando] = useState(false);

  const [anoLetivo, setAnoLetivo] = useState(configuracao?.anoLetivo ?? new Date().getFullYear());
  const [inicio, setInicio] = useState(configuracao?.inicioDoAnoLetivo ?? "");
  const [divisao, setDivisao] = useState<Divisao>(configuracao?.divisaoDoAno ?? "bimestral");
  const [minutos, setMinutos] = useState(configuracao?.minutosPorAula ?? 50);
  const [aulasSemanais, setAulasSemanais] = useState(configuracao?.aulasSemanais ?? 0);
  const [grade, setGrade] = useState<FaixaDeHorario[]>(configuracao?.grade ?? []);
  const [computacao, setComputacao] = useState(configuracao?.incluirComputacao ?? false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // O catálogo de componentes muda com o ano: Língua Inglesa só existe do 6º em
  // diante, Biologia só no Médio, Ensino Religioso não existe no Médio.
  useEffect(() => {
    if (!ano) {
      setCatalogo(null);
      return;
    }
    let ativo = true;
    setCarregando(true);
    void api
      .get<CatalogoDeComponentes>(`/planejamento/curriculo/componentes?ano=${ano}`)
      .then((c) => ativo && setCatalogo(c))
      .catch(() => ativo && setErro("Não foi possível carregar os componentes deste ano."))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [ano]);

  const escolhido = useMemo(
    () => catalogo?.componentes.find((c) => c.slug === componente) ?? null,
    [catalogo, componente],
  );

  // A sugestão de carga só se aplica quando o professor ainda não digitou nada:
  // sobrescrever um número que ele escolheu seria a tela discordando dele.
  useEffect(() => {
    if (escolhido?.aulasSemanaisDeReferencia && !aulasSemanais) {
      setAulasSemanais(escolhido.aulasSemanaisDeReferencia);
    }
  }, [escolhido, aulasSemanais]);

  const aulasNaGrade = grade.reduce((t, f) => t + f.horarios.length, 0);
  const gradeCoerente = aulasNaGrade === aulasSemanais;
  const aulasNoAno = aulasSemanais * 40;
  const horas = Math.round(((aulasSemanais * minutos * 40) / 60) * 10) / 10;
  const minimo = ano.endsWith("EM") ? 1000 : 800;

  function alternarAula(dia: number, indice: number) {
    setGrade((atual) => {
      const faixa = atual.find((f) => f.diaDaSemana === dia);
      const horarios = faixa ? [...faixa.horarios] : [];
      if (indice < horarios.length) horarios.splice(indice, 1);
      else horarios.push(sugerirHorario(horarios.length));
      const semDia = atual.filter((f) => f.diaDaSemana !== dia);
      return horarios.length ? [...semDia, { diaDaSemana: dia, horarios }] : semDia;
    });
  }

  function definirHorario(dia: number, indice: number, valor: string) {
    setGrade((atual) =>
      atual.map((f) =>
        f.diaDaSemana === dia
          ? { ...f, horarios: f.horarios.map((h, i) => (i === indice ? valor : h)) }
          : f,
      ),
    );
  }

  async function salvar() {
    setErro(null);
    if (!ano || !componente) return setErro("Escolha o ano e o componente curricular.");
    if (!inicio) return setErro("Informe a data de início do ano letivo.");
    if (aulasSemanais < 1) return setErro("Informe quantas aulas por semana este componente tem.");

    setSalvando(true);
    try {
      const salva = await api.post<Configuracao>("/planejamento/configuracoes", {
        anoLetivo,
        serie: ano,
        componente,
        divisaoDoAno: divisao,
        minutosPorAula: minutos,
        aulasSemanais,
        grade: [...grade].sort((a, b) => a.diaDaSemana - b.diaDaSemana),
        incluirComputacao: computacao,
        inicioDoAnoLetivo: inicio,
      });
      onSalvo(salva);
    } catch (falha) {
      console.error("[plano-de-ensino] salvar regência", falha);
      setErro("Não foi possível salvar. Confira os campos e tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="passo">
      <SectionHeader
        title="O que você leciona"
        description="O componente, o ano e a carga horária. É daqui que sai o tamanho do plano: quantas aulas você tem no ano e quantas cabem em cada semana."
      />

      {erro && <FeedbackAlert type="error" description={erro} />}

      <div className="grade-de-campos">
        <Selection
          name="ano"
          label="Ano / série"
          placeholder="Selecione o ano"
          options={ANOS.map((a) => ({ value: a, label: rotuloDoAno(a) }))}
          value={ano}
          onChange={(v) => {
            setAno(valorSimples(v));
            setComponente("");
            setAulasSemanais(0);
          }}
          required
          disabled={Boolean(configuracao)}
          helperText={configuracao ? "O ano não muda depois de criada a regência." : undefined}
        />

        <Selection
          name="componente"
          label="Componente curricular"
          placeholder={ano ? "Selecione o componente" : "Escolha o ano primeiro"}
          options={(catalogo?.componentes ?? []).map((c) => ({
            value: c.slug,
            label: `${c.rotulo} — ${c.totalDeHabilidades} habilidades`,
          }))}
          value={componente}
          onChange={(v) => {
            setComponente(valorSimples(v));
            setAulasSemanais(0);
          }}
          required
          disabled={!ano || carregando || Boolean(configuracao)}
          showOptionCheckbox={false}
          maxBoxHeight={320}
          helperText={
            carregando ? "Carregando os componentes deste ano…" : "Só aparecem os componentes ofertados neste ano."
          }
        />
      </div>

      {escolhido && (
        <div className="cartao-informativo">
          <p className="cartao-informativo__linha">
            <Badge variant="info">{escolhido.areaRotulo}</Badge>
            <span>
              {escolhido.totalDeHabilidades} habilidades da BNCC para {rotuloDoAno(ano)}
            </span>
          </p>
          {escolhido.habilidadesPorArea && (
            <FeedbackAlert
              type="info"
              title="As habilidades são da área, não do componente"
              description={`No Ensino Médio a BNCC organiza as habilidades por área do conhecimento. As de ${escolhido.rotulo} são as de ${escolhido.areaRotulo}, compartilhadas com os outros componentes da área — você seleciona o recorte pertinente à sua disciplina.`}
            />
          )}
          {escolhido.opcional && escolhido.observacao && (
            <FeedbackAlert type="warning" description={escolhido.observacao} />
          )}
        </div>
      )}

      <SectionHeader title="Calendário e carga horária" />

      <div className="grade-de-campos">
        <TextField
          label="Ano letivo"
          type="number"
          value={String(anoLetivo)}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setAnoLetivo(Number(e.target.value) || anoLetivo)
          }
        />
        <TextField
          label="Início do ano letivo"
          type="date"
          value={inicio}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInicio(e.target.value)}
          helperText="A primeira semana de aula. Dela saem os bimestres e todas as semanas do plano."
        />
      </div>

      <div className="grade-de-campos">
        <Selection
          name="divisao"
          label="Divisão do ano"
          options={DIVISOES}
          value={divisao}
          onChange={(v) => setDivisao(valorSimples(v) as Divisao)}
          showOptionCheckbox={false}
          helperText="Como a escola fecha as notas. Nenhuma norma nacional fixa isso — o calendário é aprovado escola a escola."
        />
        {/* Havia aqui um "Passo do planejamento" (semanal ou quinzenal), e ele
            saiu na ADR-76 — a pergunta era sobre a ENTREGA e chegava disfarçada
            de configuração do produto. Esta nota fica no lugar dele porque a
            dúvida que ele criava era legítima: o professor precisa saber que
            detalha semana a semana, e que juntar duas é coisa da exportação. */}
        <p className="nota nota--no-formulario">
          <strong>O detalhamento das aulas é semana a semana.</strong> Você planeja a 1ª semana,
          depois a 2ª, e assim por diante. Na hora de entregar, o botão de baixar junta duas
          semanas (a quinzena) ou o período de avaliação inteiro num só documento.
        </p>
      </div>

      <div className="grade-de-campos">
        <TextField
          label="Aulas por semana"
          type="number"
          value={String(aulasSemanais || "")}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setAulasSemanais(Math.max(0, Number(e.target.value) || 0))
          }
          helperText={
            escolhido?.aulasSemanaisDeReferencia
              ? `Sugestão: ${escolhido.aulasSemanaisDeReferencia} aulas — mediana de nove redes públicas. A BNCC não define grade horária; quem define é a rede.`
              : "Quantas aulas deste componente sua turma tem por semana."
          }
        />
        <TextField
          label="Duração da aula (minutos)"
          type="number"
          value={String(minutos)}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setMinutos(Math.min(60, Math.max(30, Number(e.target.value) || 50)))
          }
          helperText="50 min é o padrão da maioria das redes."
        />
      </div>

      {aulasSemanais > 0 && (
        <div className="cartao-informativo">
          <p>
            <strong>{aulasNoAno} aulas</strong> em 40 semanas letivas ={" "}
            <strong>{horas} horas-relógio</strong>.
          </p>
          <p className="nota">
            Hora-aula não é hora-relógio: as {minimo}h anuais da LDB são horas de 60 minutos
            (Parecer CNE/CEB 8/2004). Este número é só deste componente — o mínimo legal vale para
            a matriz inteira da turma.
          </p>
        </div>
      )}

      <SectionHeader
        title="Seus dias e horários"
        description="Marque quando esta turma tem aula. É daqui que saem as aulas datadas do plano semanal."
      />

      <div className="grade-de-horarios">
        {DIAS.map((dia) => {
          const faixa = grade.find((f) => f.diaDaSemana === dia.valor);
          const horarios = faixa?.horarios ?? [];
          return (
            <div key={dia.valor} className="grade-de-horarios__dia">
              <span className="grade-de-horarios__rotulo">{dia.curto}</span>
              {horarios.map((h, i) => (
                <div key={i} className="grade-de-horarios__aula">
                  <input
                    type="time"
                    value={h}
                    aria-label={`Horário da ${i + 1}ª aula de ${dia.longo}`}
                    onChange={(e) => definirHorario(dia.valor, i, e.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={`Remover a ${i + 1}ª aula de ${dia.longo}`}
                    onClick={() => alternarAula(dia.valor, i)}
                  >
                    <Icon name="close" size="s" />
                  </button>
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => alternarAula(dia.valor, horarios.length)}
              >
                + aula
              </Button>
            </div>
          );
        })}
      </div>

      {aulasSemanais > 0 && aulasNaGrade > 0 && !gradeCoerente && (
        <FeedbackAlert
          type="warning"
          title="A grade não bate com a carga declarada"
          description={`Você declarou ${aulasSemanais} aula(s) por semana e marcou ${aulasNaGrade} na grade. O plano semanal usa a GRADE — ajuste um dos dois, ou as aulas do plano não vão fechar o conteúdo do ano.`}
        />
      )}

      <div className="linha-toggle">
        <Toggle
          checked={computacao}
          onChange={(v) => setComputacao(v)}
          label="Articular Computação de forma transversal"
          description="Traz as habilidades da BNCC Computação deste ano para você distribuir junto. A articulação entre elas e o seu componente é proposta pedagógica, não currículo obrigatório: a Resolução CNE/CEB 1/2022 delega a abordagem à rede."
        />
      </div>

      <div className="acoes">
        <Button variant="secondary" onClick={onCancelar} disabled={salvando}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={() => void salvar()} isLoading={salvando}>
          {configuracao ? "Salvar alterações" : "Criar planejamento"}
        </Button>
      </div>
    </section>
  );
}

/** Horários plausíveis para a 1ª, 2ª… aula do dia, em aulas de 50 minutos. */
function sugerirHorario(indice: number): string {
  const base = 7 * 60;
  const minutos = base + indice * 50;
  const h = String(Math.floor(minutos / 60)).padStart(2, "0");
  const m = String(minutos % 60).padStart(2, "0");
  return `${h}:${m}`;
}
