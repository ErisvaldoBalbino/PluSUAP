"""
Tests for main.py — FastAPI route handlers.

Uses TestClient with mocked SUAP API calls.
"""

import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

import main
from client.suap import SUAPAuthError


# ============================================================================
# Unauthenticated route tests
# ============================================================================

class TestUnauthenticatedAccess:
    """Routes that should redirect to /login when no token is present."""

    def test_dashboard_redirects_to_login(self, client):
        resp = client.get("/", follow_redirects=False)
        assert resp.status_code in (303, 307)
        assert "/login" in resp.headers["location"]

    def test_simulador_redirects_to_login(self, client):
        resp = client.get("/simulador", follow_redirects=False)
        assert resp.status_code in (303, 307)

    def test_requisitos_redirects_to_login(self, client):
        resp = client.get("/requisitos", follow_redirects=False)
        assert resp.status_code in (303, 307)

    def test_disciplinas_redirects_to_login(self, client):
        resp = client.get("/disciplinas", follow_redirects=False)
        assert resp.status_code in (303, 307)

    def test_faltas_redirects_to_login(self, client):
        resp = client.get("/faltas", follow_redirects=False)
        assert resp.status_code in (303, 307)

    def test_api_dashboard_returns_401(self, client):
        resp = client.get("/api/dashboard-data")
        assert resp.status_code == 401
        assert resp.json()["detail"] == "Não autenticado"

    def test_api_periods_returns_401(self, client):
        resp = client.get("/api/periods")
        assert resp.status_code == 401

    def test_api_disciplinas_returns_401(self, client):
        resp = client.get("/api/disciplinas")
        assert resp.status_code == 401

    def test_api_diarios_returns_401(self, client):
        resp = client.get("/api/diarios")
        assert resp.status_code == 401


# ============================================================================
# Login / Auth routes
# ============================================================================

class TestLoginPage:
    def test_login_page_renders(self, client):
        resp = client.get("/login")
        assert resp.status_code == 200
        assert "text/html" in resp.headers["content-type"]

    def test_login_redirects_if_already_authed(self, authenticated_client):
        resp = authenticated_client.get("/login", follow_redirects=False)
        assert resp.status_code in (303, 307)
        assert resp.headers["location"] == "/"


class TestOAuthFlow:
    def test_auth_suap_redirects(self, client):
        resp = client.get("/auth/suap", follow_redirects=False)
        assert resp.status_code in (303, 307)
        assert "suap.ifrn.edu.br" in resp.headers["location"]

    def test_callback_without_code_redirects_to_login_error(self, client):
        resp = client.get("/oauth/callback", follow_redirects=False)
        assert resp.status_code in (303, 307)
        assert "/login" in resp.headers["location"]

    def test_callback_sets_token_and_redirects(self, client):
        with patch.object(main.suap_api, "get_token_from_code", new_callable=AsyncMock, return_value="abc123"):
            resp = client.get("/oauth/callback?code=testcode", follow_redirects=False)
            assert resp.status_code in (303, 307)
            assert resp.headers["location"] == "/"

    def test_callback_failed_auth_redirects_to_error(self, client):
        with patch.object(main.suap_api, "get_token_from_code", new_callable=AsyncMock, return_value=None):
            resp = client.get("/oauth/callback?code=badcode", follow_redirects=False)
            assert resp.status_code in (303, 307)
            assert "error" in resp.headers["location"].lower()


class TestLogout:
    def test_logout_clears_session(self, authenticated_client):
        resp = authenticated_client.get("/logout", follow_redirects=False)
        assert resp.status_code in (303, 307)
        assert "/login" in resp.headers["location"]


# ============================================================================
# Authenticated page routes
# ============================================================================

class TestAuthenticatedPages:
    def test_dashboard_page(self, authenticated_client):
        resp = authenticated_client.get("/")
        assert resp.status_code == 200

    def test_simulador_page(self, authenticated_client):
        resp = authenticated_client.get("/simulador")
        assert resp.status_code == 200

    def test_requisitos_page(self, authenticated_client):
        resp = authenticated_client.get("/requisitos")
        assert resp.status_code == 200

    def test_disciplinas_page(self, authenticated_client):
        resp = authenticated_client.get("/disciplinas")
        assert resp.status_code == 200

    def test_faltas_page(self, authenticated_client):
        resp = authenticated_client.get("/faltas")
        assert resp.status_code == 200


# ============================================================================
# Authenticated API routes (mocked SUAP)
# ============================================================================

class TestDashboardDataAPI:
    def test_dashboard_data(self, authenticated_client, sample_grades, sample_periods):
        mock_data = {
            "user": {"nome": "João", "curso": "Info"},
            "grades": sample_grades,
            "periods": sample_periods,
            "selected_ano": "2026",
            "selected_periodo": "1",
        }
        with patch.object(main.suap_api, "get_dashboard_data", new_callable=AsyncMock, return_value=mock_data):
            resp = authenticated_client.get("/api/dashboard-data")
            assert resp.status_code == 200
            data = resp.json()
            assert "grades" in data
            assert "summary" in data
            assert "user" in data
            assert data["selected_ano"] == "2026"

    def test_dashboard_data_includes_processed_grades(self, authenticated_client):
        mock_data = {
            "user": {},
            "grades": [{
                "disciplina": "Test",
                "situacao": "Aprovado",
                "nota_etapa_1": {"nota": 80},
                "nota_etapa_2": {"nota": 90},
                "media_disciplina": 85,
                "carga_horaria": 60,
                "carga_horaria_cumprida": 60,
                "numero_faltas": 0,
            }],
            "periods": [],
            "selected_ano": "2026",
            "selected_periodo": "1",
        }
        with patch.object(main.suap_api, "get_dashboard_data", new_callable=AsyncMock, return_value=mock_data):
            resp = authenticated_client.get("/api/dashboard-data")
            data = resp.json()
            grade = data["grades"][0]
            assert "estado_ui" in grade
            assert "freq_perc" in grade
            assert grade["estado_ui"] == "SUCESSO"


class TestPeriodsAPI:
    def test_list_periods(self, authenticated_client, sample_periods):
        with patch.object(main.suap_api, "get_academic_periods", new_callable=AsyncMock, return_value=sample_periods):
            resp = authenticated_client.get("/api/periods")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data["periods"]) == 2
            assert data["periods"][0]["label"] == "2026.1"

    def test_select_period(self, authenticated_client):
        resp = authenticated_client.post("/api/periods/select?ano_letivo=2026&periodo_letivo=1")
        assert resp.status_code == 200
        assert resp.json()["ok"] is True


class TestDisciplinasAPI:
    def test_api_disciplinas(self, authenticated_client):
        mock_disciplinas = [{"id": 1, "descricao": "Prog I"}]
        with patch.object(main.suap_api, "get_disciplinas", new_callable=AsyncMock, return_value=mock_disciplinas):
            # Set a period first
            authenticated_client.post("/api/periods/select?ano_letivo=2026&periodo_letivo=1")
            resp = authenticated_client.get("/api/disciplinas")
            assert resp.status_code == 200
            data = resp.json()
            assert "disciplinas" in data

    def test_api_disciplinas_no_period(self, authenticated_client):
        """Should return 400 when no period is selected."""
        resp = authenticated_client.get("/api/disciplinas")
        assert resp.status_code == 400


class TestDisciplinaEtapasAPI:
    def test_api_etapas(self, authenticated_client):
        mock_etapas = [{"etapa": 1, "nota": 80}]
        with patch.object(main.suap_api, "get_disciplina_etapas", new_callable=AsyncMock, return_value=mock_etapas):
            resp = authenticated_client.get("/api/disciplinas/42/etapas")
            assert resp.status_code == 200
            assert "etapas" in resp.json()


class TestDiariosAPI:
    def test_api_diarios(self, authenticated_client):
        mock_diarios = [{"id": 1, "disciplina": {"descricao": "Prog"}}]
        mock_grades = []
        with patch.object(main.suap_api, "get_diarios", new_callable=AsyncMock, return_value=mock_diarios), \
             patch.object(main.suap_api, "get_user_grades", new_callable=AsyncMock, return_value=mock_grades):
            authenticated_client.post("/api/periods/select?ano_letivo=2026&periodo_letivo=1")
            resp = authenticated_client.get("/api/diarios")
            assert resp.status_code == 200

    def test_api_diarios_no_period(self, authenticated_client):
        resp = authenticated_client.get("/api/diarios")
        assert resp.status_code == 400


class TestRequisitosAPI:
    def test_api_requisitos(self, authenticated_client):
        mock_requirements = {"carga_horaria_total": 800, "carga_horaria_cumprida": 400}
        with patch.object(main.suap_api, "get_completion_requirements", new_callable=AsyncMock, return_value=mock_requirements):
            resp = authenticated_client.get("/api/requisitos")
            assert resp.status_code == 200
            data = resp.json()
            assert "carga_horaria_total" in data


# ============================================================================
# SUAPAuthError exception handler
# ============================================================================

class TestSUAPAuthErrorHandler:
    def test_auth_error_clears_session_and_returns_401(self, client):
        """When SUAPAuthError is raised, should return 401 and clear session."""
        with patch.object(main.suap_api, "get_dashboard_data", new_callable=AsyncMock) as mock:
            mock.side_effect = SUAPAuthError("Token expired")
            # First, sign in
            with patch.object(main.suap_api, "get_token_from_code", new_callable=AsyncMock, return_value="fake-token"):
                client.get("/oauth/callback?code=fakecode", follow_redirects=False)

            resp = client.get("/api/dashboard-data")
            assert resp.status_code == 401
            assert "Token SUAP expirado" in resp.json()["detail"]


# ============================================================================
# Helper functions
# ============================================================================

class TestNormalizePeriods:
    def test_normalize_with_ano_letivo_key(self):
        raw = [{"ano_letivo": 2026, "periodo_letivo": 1}]
        result = main.normalize_periods(raw)
        assert result == [{"ano_letivo": "2026", "periodo_letivo": "1", "label": "2026.1"}]

    def test_normalize_with_ano_key(self):
        raw = [{"ano": 2025, "periodo": 2}]
        result = main.normalize_periods(raw)
        assert result == [{"ano_letivo": "2025", "periodo_letivo": "2", "label": "2025.2"}]

    def test_normalize_none(self):
        result = main.normalize_periods(None)
        assert result == []

    def test_normalize_empty_list(self):
        result = main.normalize_periods([])
        assert result == []

    def test_normalize_skips_incomplete_entries(self):
        raw = [{"ano_letivo": 2026}]  # missing periodo_letivo
        result = main.normalize_periods(raw)
        assert result == []