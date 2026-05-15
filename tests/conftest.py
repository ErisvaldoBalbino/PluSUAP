import os
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient

# Set env vars before importing the app so SessionMiddleware gets a stable key
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-testing")
os.environ.setdefault("SUAP_CLIENT_ID", "test_client_id")
os.environ.setdefault("SUAP_CLIENT_SECRET", "test_client_secret")
os.environ.setdefault("SUAP_REDIRECT_URI", "http://localhost:8000/oauth/callback")

import main  # noqa: E402
from client.suap import AsyncSUAPAPI, SUAPAuthError  # noqa: E402


# ---------------------------------------------------------------------------
# Fixtures for the FastAPI test client
# ---------------------------------------------------------------------------

@pytest.fixture
def client():
    """Synchronous TestClient – good for non-async route tests."""
    with TestClient(main.app) as c:
        yield c


@pytest.fixture
def authenticated_client():
    """
    TestClient with a pre-set session that already contains a SUAP token,
    so every request acts as an authenticated user.
    """
    with TestClient(main.app) as c:
        # We simulate login by hitting the callback with a mocked code
        # but it's simpler to just set the session directly:
        # The session middleware uses itsdangerous, so we manually set it.
        # Instead, we'll patch suap_api.get_token_from_code and use the real flow.
        with patch.object(main.suap_api, "get_token_from_code", new_callable=AsyncMock, return_value="fake-token"):
            resp = c.get("/oauth/callback?code=fakecode", follow_redirects=False)
        assert resp.status_code == 303 or resp.status_code == 307  # redirect
        yield c


# ---------------------------------------------------------------------------
# Fixtures for SUAP API mock
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_suap_api():
    """
    Returns an AsyncSUAPAPI instance with all network calls mocked out.
    Useful for unit-testing the client itself.
    """
    api = AsyncSUAPAPI()
    api.client_id = "test_client_id"
    api.client_secret = "test_client_secret"
    api.redirect_uri = "http://localhost:8000/oauth/callback"
    return api


# ---------------------------------------------------------------------------
# Sample data fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_grades():
    """Realistic grade data as returned by the SUAP API."""
    return [
        {
            "disciplina": "Programação I",
            "situacao": "Cursando",
            "nota_etapa_1": {"nota": 70},
            "nota_etapa_2": {"nota": None},
            "media_disciplina": 70,
            "carga_horaria": 80,
            "carga_horaria_cumprida": 40,
            "numero_faltas": 2,
        },
        {
            "disciplina": "Matemática",
            "situacao": "Aprovado",
            "nota_etapa_1": {"nota": 80},
            "nota_etapa_2": {"nota": 85},
            "media_disciplina": 82.5,
            "carga_horaria": 60,
            "carga_horaria_cumprida": 60,
            "numero_faltas": 1,
        },
        {
            "disciplina": "Banco de Dados",
            "situacao": "Reprovado",
            "nota_etapa_1": {"nota": 30},
            "nota_etapa_2": {"nota": 40},
            "media_disciplina": 35,
            "carga_horaria": 60,
            "carga_horaria_cumprida": 60,
            "numero_faltas": 20,
        },
        {
            "disciplina": "Redes",
            "situacao": "Cursando",
            "nota_etapa_1": {"nota": 50},
            "nota_etapa_2": {"nota": 65},
            "media_disciplina": 57.5,
            "carga_horaria": 80,
            "carga_horaria_cumprida": 80,
            "numero_faltas": 5,
        },
        {
            "disciplina": "Algoritmos",
            "situacao": "Cursando",
            "nota_etapa_1": {"nota": 35},
            "nota_etapa_2": {"nota": None},
            "media_disciplina": 35,
            "carga_horaria": 80,
            "carga_horaria_cumprida": 40,
            "numero_faltas": 3,
        },
        {
            "disciplina": "Ética",
            "situacao": "Cursando",
            "nota_etapa_1": {"nota": None},
            "nota_etapa_2": {"nota": None},
            "media_disciplina": None,
            "carga_horaria": 40,
            "carga_horaria_cumprida": 0,
            "numero_faltas": 0,
        },
        {
            "disciplina": "Lógica",
            "situacao": "Transferido",
            "nota_etapa_1": {"nota": None},
            "nota_etapa_2": {"nota": None},
            "media_disciplina": None,
            "carga_horaria": 60,
            "carga_horaria_cumprida": 0,
            "numero_faltas": 0,
        },
    ]


@pytest.fixture
def sample_diarios():
    """Realistic diários data as returned by the SUAP API."""
    return [
        {
            "id": 101,
            "disciplina": {
                "descricao": "Programação I",
                "sigla": "PROG1",
                "ch_total_aula": 80,
                "qtd_faltas": 2,
            },
            "horarios": [
                {"dia": "Seg", "horario": "07:00-08:40"},
                {"dia": "Qua", "horario": "07:00-08:40"},
            ],
        },
        {
            "id": 102,
            "disciplina": {
                "descricao": "Matemática",
                "sigla": "MAT",
                "ch_total_aula": 60,
                "qtd_faltas": 1,
            },
            "horarios": [
                {"dia": "Ter", "horario": "07:00-08:40"},
            ],
        },
    ]


@pytest.fixture
def sample_periods():
    """Sample academic periods from SUAP."""
    return [
        {"ano_letivo": 2026, "periodo_letivo": 1},
        {"ano_letivo": 2025, "periodo_letivo": 2},
    ]