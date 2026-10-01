import pytest

from agente_professor import curriculo


@pytest.mark.parametrize(
    ("entrada", "esperado"),
    [
        ("6", {"6"}),
        ("6º ano", {"6"}),
        ("6° ano", {"6"}),
        ("sexto ano", {"6"}),
        ("6EF", {"6"}),
        ("EF06", {"6"}),
        ("6º ano do EF", {"6"}),
        ("EM", {"EM"}),
        ("em", {"EM"}),
        ("Ensino Médio", {"EM"}),
        ("2ª série", {"EM"}),
        ("1EM", {"EM"}),
        ("em2", {"EM"}),
        ("3º ano do ensino médio", {"EM"}),
        ("anos iniciais", {"1", "2", "3", "4", "5"}),
        ("anos finais", {"6", "7", "8", "9"}),
        ("1º ao 5º ano", {"1", "2", "3", "4", "5"}),
        ("6º e 7º", {"6", "7"}),
    ],
)
def test_normaliza_ano(entrada: str, esperado: set[str]) -> None:
    assert curriculo.normalizar_ano(entrada) == esperado


@pytest.mark.parametrize("entrada", ["", "décimo ano", "ano", "12"])
def test_ano_desconhecido(entrada: str) -> None:
    with pytest.raises(curriculo.AnoDesconhecido):
        curriculo.normalizar_ano(entrada)


@pytest.mark.parametrize(
    ("entrada", "esperado"),
    [
        ("Matemática", ("matematica",)),
        ("língua portuguesa", ("lingua-portuguesa",)),
        ("Português", ("lingua-portuguesa",)),
        ("Computação", ("computacao",)),
        # As armadilhas do EM: componente da rede → área da BNCC.
        ("Biologia", ("ciencias-da-natureza",)),
        ("Física", ("ciencias-da-natureza",)),
        ("Química", ("ciencias-da-natureza",)),
        ("Filosofia", ("ciencias-humanas",)),
        ("Sociologia", ("ciencias-humanas",)),
        ("História", ("historia", "ciencias-humanas")),
        ("Arte", ("arte", "linguagens")),
        ("Educação Física", ("educacao-fisica", "linguagens")),
        ("Inglês", ("lingua-inglesa", "linguagens")),
    ],
)
def test_componente_vira_slugs_do_filtro(entrada: str, esperado: tuple[str, ...]) -> None:
    assert curriculo.componentes_bncc(entrada) == esperado


def test_componente_desconhecido() -> None:
    with pytest.raises(curriculo.ComponenteDesconhecido):
        curriculo.componentes_bncc("astrologia")


def test_componente_do_acervo_usa_o_componente_da_rede() -> None:
    assert curriculo.componente_do_acervo("Biologia") == "biologia"
    assert curriculo.componente_do_acervo("português") == "lingua-portuguesa"
    assert curriculo.componente_do_acervo("historia-em") == "historia"


def test_codigo_de_tres_digitos_e_valido() -> None:
    # EF05CO011 existe assim no documento oficial: não "conserte".
    assert curriculo.CODIGO_RE.match("EF05CO011")
    assert curriculo.normalizar_codigo(" ef05co011 ") == "EF05CO011"


@pytest.mark.parametrize(
    ("anos", "rotulo"),
    [
        (["6"], "6º ano"),
        (["6", "7"], "6º e 7º ano"),
        (["1", "2", "3", "4", "5"], "1º ao 5º ano"),
        (["EM"], "Ensino Médio"),
    ],
)
def test_rotulo_dos_anos(anos: list[str], rotulo: str) -> None:
    assert curriculo.rotulo_dos_anos(anos) == rotulo
