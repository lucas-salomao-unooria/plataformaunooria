"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertBox,
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  PasswordInput,
  RadioGroup,
  Selection,
  TextField,
} from "@edu/ui/ds";
import { ehPapelSemEscola, papeisQueCria, rotuloDoPapel } from "@/lib/papeis";
import type { Papel } from "@/lib/papeis";
import { normalizarSerie, rotuloDaSerie } from "@/lib/series";

/**
 * O balcão: cadastrar UMA pessoa, sem montar planilha.
 *
 * A tela não escreve nada por conta própria — ela posta em `POST /usuarios`,
 * que monta a mesma linha de planilha e chama o mesmo importador da tela de
 * `/admin/importar` (ADR-59). É por isso que as regras aqui são idênticas às de
 * lá: CPF com dígito verificador, login gerado quando fica em branco, estudante
 * que precisa de turma.
 *
 * Duas escolhas de interface que não são estéticas:
 *
 * A TURMA é escolhida numa lista, nunca digitada. A importação CRIA a turma que
 * não existe — virtude num arquivo com mil linhas, armadilha num formulário:
 * "8A " com espaço abriria uma segunda oitava série A, e a diferença entre as
 * duas é invisível na listagem.
 *
 * O PAPEL some da lista quando quem está logado não pode criá-lo. Gestor não vê
 * "Admin do contrato" — e, se contornar a tela, a api recusa com 403: a tranca
 * que vale é a de lá, esta só evita oferecer o que vai ser negado.
 */

interface TurmaDaEscola {
  id: string;
  nome: string;
  serie: string;
}

/** O que a api devolve — inclusive a senha, que sai UMA vez. */
export interface PessoaCriada {
  id: string;
  nome: string;
  usuario: string;
  papel: string;
  turma: string | null;
  turmaCriada: boolean;
  senha: string;
  avisos: Array<{ campo: string; mensagem: string }>;
}

type ErroDeCampo = Record<string, string>;


const TURNOS = [
  { value: "", label: "Sem turno" },
  { value: "manha", label: "Manhã" },
  { value: "tarde", label: "Tarde" },
  { value: "noite", label: "Noite" },
  { value: "integral", label: "Integral" },
];

export function NovoUsuario({
  aberto,
  papelDeQuemCria,
  sufixo,
  onFechar,
  onCriado,
}: {
  aberto: boolean;
  papelDeQuemCria: Papel;
  /** `?escolaId=` do admin-contrato, já montado pela tela que hospeda. */
  sufixo: string;
  onFechar: () => void;
  onCriado: (pessoa: PessoaCriada) => void;
}) {
  const [papelNovo, setPapelNovo] = useState("estudante");
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [matricula, setMatricula] = useState("");
  const [usuario, setUsuario] = useState("");
  const [email, setEmail] = useState("");
  const [turmaId, setTurmaId] = useState("");
  const [turno, setTurno] = useState("");
  const [regionalId, setRegionalId] = useState("");
  const [regionais, setRegionais] = useState<Array<{ id: string; nome: string }>>([]);
  const [modoDaSenha, setModoDaSenha] = useState<"gerar" | "definir">("gerar");
  const [senha, setSenha] = useState("");

  const [turmas, setTurmas] = useState<TurmaDaEscola[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [erroDeCampo, setErroDeCampo] = useState<ErroDeCampo>({});
  const [salvando, setSalvando] = useState(false);

  /* Os papéis que ESTE autor pode atribuir saem da cadeia (ADR-80), não de uma
     lista fixa: com a lista escrita à mão, o papel novo aparecia para quem não
     podia criá-lo e a pessoa preenchia a tela inteira para receber 403 no fim.
     Quem decide continua sendo a api — isto só evita oferecer o que ela recusa. */
  const papeis = papeisQueCria(papelDeQuemCria).map((p) => ({
    value: p,
    label: rotuloDoPapel(p),
  }));

  /* Papel SEM escola: turma, matrícula e turno não têm onde ser gravados, e
     mostrá-los prometeria o que a api ignora. O `gestor_regional` está aqui
     junto do `gestor_contrato` — ele também não pertence a unidade nenhuma; o
     que ele tem é uma regional. */
  const semEscola = ehPapelSemEscola(papelNovo as Papel);
  const ehRegional = papelNovo === "gestor_regional";
  const pedeTurma = papelNovo === "estudante" || papelNovo === "professor";

  function limpar() {
    setPapelNovo("estudante");
    setNome("");
    setCpf("");
    setMatricula("");
    setUsuario("");
    setEmail("");
    setTurmaId("");
    setTurno("");
    setRegionalId("");
    setModoDaSenha("gerar");
    setSenha("");
    setErro(null);
    setErroDeCampo({});
  }

  const carregarTurmas = useCallback(async () => {
    try {
      const resposta = await fetch(`/api/plataforma/turmas${sufixo}`);
      if (!resposta.ok) return;
      setTurmas((await resposta.json()) as TurmaDaEscola[]);
    } catch {
      /* Sem a lista, a tela ainda cria gestor e admin. O erro de "turma
         obrigatória" vem da api e aparece no campo. */
    }
  }, [sufixo]);

  useEffect(() => {
    if (aberto) void carregarTurmas();
  }, [aberto, carregarTurmas]);

  /* As regionais só são buscadas quando o papel escolhido precisa de uma: é
     uma consulta a menos em 99% das aberturas do formulário, e a lista aparece
     no mesmo instante em que o campo dela aparece. */
  useEffect(() => {
    if (!aberto || !ehRegional) return;
    void (async () => {
      try {
        const r = await fetch("/api/plataforma/escolas?tipo=regional");
        if (r.ok) setRegionais((await r.json()) as Array<{ id: string; nome: string }>);
      } catch {
        /* o seletor fica vazio e o botão não habilita — melhor que travar a tela */
      }
    })();
  }, [aberto, ehRegional]);

  const opcoesDeTurma = useMemo(
    () => [
      { value: "", label: papelNovo === "estudante" ? "Escolha a turma" : "Sem turma" },
      ...turmas.map((t) => {
        /* A série vem como texto da api. Grafia que o normalizador não conhece
           aparece crua em vez de sumir — a turma existe de qualquer jeito. */
        const serie = normalizarSerie(t.serie);
        return {
          value: t.id,
          label: `${t.nome} — ${serie ? rotuloDaSerie(serie) : t.serie}`,
        };
      }),
    ],
    [turmas, papelNovo],
  );

  async function criar() {
    if (!nome.trim()) {
      setErroDeCampo({ nome: "Informe o nome completo." });
      return;
    }
    if (modoDaSenha === "definir" && senha.length < 8) {
      setErroDeCampo({ senha: "A senha precisa de pelo menos 8 caracteres." });
      return;
    }

    setSalvando(true);
    setErro(null);
    setErroDeCampo({});
    try {
      const turmaEscolhida = turmas.find((t) => t.id === turmaId);
      const corpo = semEscola
        ? {
            papel: papelNovo,
            ...(ehRegional ? { regionalId } : {}),
            nome: nome.trim(),
            ...(cpf.trim() ? { cpf: cpf.trim() } : {}),
            ...(email.trim() ? { email: email.trim() } : {}),
            ...(usuario.trim() ? { usuario: usuario.trim() } : {}),
            ...(modoDaSenha === "definir" ? { senha } : {}),
          }
        : {
            papel: papelNovo,
            nome: nome.trim(),
            ...(cpf.trim() ? { cpf: cpf.trim() } : {}),
            ...(matricula.trim() ? { matricula: matricula.trim() } : {}),
            ...(usuario.trim() ? { usuario: usuario.trim() } : {}),
            ...(email.trim() ? { email: email.trim() } : {}),
            /* A api recebe o NOME da turma (é uma linha de planilha), e a série
               vem junto da turma escolhida — nunca digitada em separado. */
            ...(turmaEscolhida ? { turma: turmaEscolhida.nome, serie: turmaEscolhida.serie } : {}),
            ...(turno ? { turno } : {}),
            ...(modoDaSenha === "definir" ? { senha } : {}),
          };

      const rota = semEscola
        ? "/api/plataforma/usuarios/sem-escola"
        : `/api/plataforma/usuarios${sufixo}`;
      const resposta = await fetch(rota, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpo),
      });

      if (!resposta.ok) {
        const dados = (await resposta.json().catch(() => null)) as {
          mensagem?: string;
          message?: unknown;
          campo?: string;
          erros?: Array<{ campo: string; mensagem: string }>;
        } | null;

        /* 400 do cadastro traz `erros[]` por campo — é o que faz o formulário
           apontar o CPF errado em vez de dizer "não foi possível". */
        if (dados?.erros?.length) {
          const porCampo: ErroDeCampo = {};
          for (const e of dados.erros) porCampo[e.campo] = e.mensagem;
          setErroDeCampo(porCampo);
          setErro(dados.mensagem ?? "Confira os campos destacados.");
          return;
        }
        /* 409 aponta um campo só (CPF, matrícula ou login já em uso). */
        if (dados?.campo && dados.mensagem) {
          setErroDeCampo({ [dados.campo]: dados.mensagem });
          setErro(dados.mensagem);
          return;
        }
        const doNest = Array.isArray(dados?.message) ? dados.message.join("; ") : dados?.message;
        setErro(
          dados?.mensagem ??
            (typeof doNest === "string" ? doNest : "Não foi possível criar a pessoa."),
        );
        return;
      }

      /* `gestor_contrato` não tem turma nem avisos: a resposta dele é mais curta,
         e o modal de acesso lê os mesmos campos dos dois. */
      const criada = (await resposta.json()) as Partial<PessoaCriada> &
        Pick<PessoaCriada, "id" | "nome" | "usuario" | "papel" | "senha">;
      onCriado({
        ...criada,
        turma: criada.turma ?? null,
        turmaCriada: criada.turmaCriada ?? false,
        avisos: criada.avisos ?? [],
      });
      limpar();
    } catch {
      setErro("Sem conexão agora. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      isOpen={aberto}
      onClose={() => {
        limpar();
        onFechar();
      }}
      size="md"
      theme="light"
    >
      <ModalHeader>
        <ModalTitle>Novo usuário</ModalTitle>
      </ModalHeader>
      <ModalBody>
        <div className="flex flex-col gap-4">
          {erro ? <AlertBox theme="light" variant="error" device="auto" description={erro} /> : null}

          <Selection
            label="Papel"
            required
            value={papelNovo}
            onChange={(valor) => {
              setPapelNovo(String(valor));
              setErroDeCampo({});
            }}
            options={papeis}
          />

          <TextField
            id="novo-nome"
            label="Nome completo"
            required
            value={nome}
            error={erroDeCampo.nome}
            onChange={(e) => setNome(e.target.value)}
          />

          {ehRegional ? (
            <Selection
              id="novo-regional"
              label="Regional"
              helperText="É o escopo dele: as escolas desta regional passam a ser as que ele pode abrir. Ele não recebe vínculo com nenhuma."
              value={regionalId}
              options={regionais.map((r) => ({ value: r.id, label: r.nome }))}
              onChange={(v) => setRegionalId(String(v))}
            />
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              id="novo-cpf"
              label="CPF"
              placeholder="000.000.000-00"
              helperText="Identifica a pessoa na rede inteira."
              value={cpf}
              error={erroDeCampo.cpf}
              onChange={(e) => setCpf(e.target.value)}
            />
            {semEscola ? null : (
              <TextField
                id="novo-matricula"
                label="Matrícula da rede"
                value={matricula}
                error={erroDeCampo.matricula}
                onChange={(e) => setMatricula(e.target.value)}
              />
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              id="novo-usuario"
              label="Usuário"
              helperText="Em branco: gerado a partir do nome."
              value={usuario}
              error={erroDeCampo.usuario}
              onChange={(e) => setUsuario(e.target.value)}
            />
            <TextField
              id="novo-email"
              label="E-mail"
              value={email}
              error={erroDeCampo.email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {pedeTurma ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Selection
                label="Turma"
                required={papelNovo === "estudante"}
                value={turmaId}
                error={erroDeCampo.turma ?? erroDeCampo.serie}
                onChange={(valor) => setTurmaId(String(valor))}
                options={opcoesDeTurma}
              />
              <Selection
                label="Turno"
                value={turno}
                error={erroDeCampo.turno}
                onChange={(valor) => setTurno(String(valor))}
                options={TURNOS}
              />
            </div>
          ) : null}

          <RadioGroup
            label="Senha do primeiro acesso"
            direction="horizontal"
            value={modoDaSenha}
            onChange={(valor) => setModoDaSenha(valor === "definir" ? "definir" : "gerar")}
            options={[
              { value: "gerar", label: "Gerar automaticamente" },
              { value: "definir", label: "Definir agora" },
            ]}
          />
          {modoDaSenha === "definir" ? (
            <PasswordInput
              id="nova-senha"
              label="Senha provisória"
              helperText="Mínimo de 8 caracteres. A pessoa troca no primeiro acesso."
              value={senha}
              error={erroDeCampo.senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          ) : null}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="ghost"
          size="md"
          onClick={() => {
            limpar();
            onFechar();
          }}
        >
          Cancelar
        </Button>
        <Button
          variant="primary"
          size="md"
          isLoading={salvando}
          /* Sem regional não salva: a api reprova com 400 (o Zod tem `refine`
             bicondicional), e descobrir isso depois de preencher tudo é pior
             que o botão dizer que ainda falta algo. */
          disabled={!nome.trim() || (ehRegional && !regionalId)}
          onClick={() => void criar()}
        >
          Criar
        </Button>
      </ModalFooter>
    </Modal>
  );
}
