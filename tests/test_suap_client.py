"""
Tests for client/suap.py — AsyncSUAPAPI client.

All network calls are mocked so no real HTTP requests are made.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import httpx

from client.suap import AsyncSUAPAPI, SUAPAuthError


# ============================================================================
# Helper: build a fake httpx.Response
# ============================================================================

def make_response(status_code: int, json_data=None, content_type="application/json"):
    """Create a mock httpx.Response."""
    response = MagicMock(spec=httpx.Response)
    response.status_code = status_code
    response.headers = {"Content-Type": content_type}
    if json_data is not None:
        response.json.return_value = json_data
    response.raise_for_status = MagicMock()
    if status_code >= 400:
        from httpx import HTTPStatusError
        request = MagicMock()
        error = HTTPStatusError(
            message=f"{status_code} error",
            request=request,
            response=response,
        )
        response.raise_for_status.side_effect = error
    return response


# ============================================================================
# AsyncSUAPAPI._extract_results
# ============================================================================

class TestExtractResults:
    def test_dict_with_results_key(self):
        data = {"results": [1, 2, 3]}
        assert AsyncSUAPAPI._extract_results(data) == [1, 2, 3]

    def test_dict_without_results_key(self):
        data = {"other": "value"}
        assert AsyncSUAPAPI._extract_results(data) == {"other": "value"}

    def test_list_passthrough(self):
        data = [1, 2, 3]
        assert AsyncSUAPAPI._extract_results(data) == [1, 2, 3]

    def test_string_passthrough(self):
        assert AsyncSUAPAPI._extract_results("hello") == "hello"

    def test_none_passthrough(self):
        assert AsyncSUAPAPI._extract_results(None) is None


# ============================================================================
# get_authorization_url
# ============================================================================

class TestGetAuthorizationUrl:
    def test_basic_url(self, mock_suap_api):
        url = mock_suap_api.get_authorization_url()
        assert "suap.ifrn.edu.br/o/authorize/" in url
        assert "client_id=test_client_id" in url
        assert "response_type=code" in url

    def test_url_with_state(self, mock_suap_api):
        url = mock_suap_api.get_authorization_url(state="random_state")
        assert "state=random_state" in url

    def test_scope_in_url(self, mock_suap_api):
        url = mock_suap_api.get_authorization_url()
        assert "scope=identificacao" in url


# ============================================================================
# _make_request (network mocked)
# ============================================================================

class TestMakeRequest:
    @pytest.mark.asyncio
    async def test_successful_json_response(self, mock_suap_api):
        """Should return parsed JSON for a 200 response."""
        fake_response = make_response(200, {"key": "value"})
        fake_client = AsyncMock(spec=httpx.AsyncClient)
        fake_client.request = AsyncMock(return_value=fake_response)

        result = await mock_suap_api._make_request(fake_client, "GET", "http://test.com/api/")
        assert result == {"key": "value"}

    @pytest.mark.asyncio
    async def test_404_returns_none(self, mock_suap_api):
        """Should return None for 404 responses."""
        fake_response = make_response(404)
        fake_response.raise_for_status = MagicMock()  # 404 doesn't raise
        fake_client = AsyncMock(spec=httpx.AsyncClient)
        fake_client.request = AsyncMock(return_value=fake_response)

        result = await mock_suap_api._make_request(fake_client, "GET", "http://test.com/api/")
        assert result is None

    @pytest.mark.asyncio
    async def test_401_raises_auth_error(self, mock_suap_api):
        """Should raise SUAPAuthError for 401 responses."""
        fake_response = make_response(401)
        fake_client = AsyncMock(spec=httpx.AsyncClient)
        fake_client.request = AsyncMock(return_value=fake_response)

        with pytest.raises(SUAPAuthError):
            await mock_suap_api._make_request(fake_client, "GET", "http://test.com/api/")

    @pytest.mark.asyncio
    async def test_timeout_retries_and_returns_none(self, mock_suap_api):
        """Should return None after max_retries timeouts."""
        fake_client = AsyncMock(spec=httpx.AsyncClient)
        fake_client.request = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
        mock_suap_api.max_retries = 2  # reduce for speed

        result = await mock_suap_api._make_request(fake_client, "GET", "http://test.com/api/")
        assert result is None
        assert fake_client.request.call_count == 2

    @pytest.mark.asyncio
    async def test_non_json_content_type_returns_none(self, mock_suap_api):
        """Should return None if Content-Type is not application/json."""
        fake_response = make_response(200, content_type="text/html")
        fake_response.raise_for_status = MagicMock()
        fake_client = AsyncMock(spec=httpx.AsyncClient)
        fake_client.request = AsyncMock(return_value=fake_response)

        result = await mock_suap_api._make_request(fake_client, "GET", "http://test.com/api/")
        assert result is None

    @pytest.mark.asyncio
    async def test_server_error_retries_and_returns_none(self, mock_suap_api):
        """Should return None after retries on 500 errors."""
        fake_response = make_response(500)
        fake_client = AsyncMock(spec=httpx.AsyncClient)
        fake_client.request = AsyncMock(return_value=fake_response)
        mock_suap_api.max_retries = 2

        result = await mock_suap_api._make_request(fake_client, "GET", "http://test.com/api/")
        assert result is None
        assert fake_client.request.call_count == 2


# ============================================================================
# get_token_from_code
# ============================================================================

class TestGetTokenFromCode:
    @pytest.mark.asyncio
    async def test_successful_token(self, mock_suap_api):
        with patch.object(mock_suap_api, "_make_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"access_token": "abc123", "token_type": "Bearer"}
            token = await mock_suap_api.get_token_from_code("valid_code")
            assert token == "abc123"

    @pytest.mark.asyncio
    async def test_failed_token(self, mock_suap_api):
        with patch.object(mock_suap_api, "_make_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = None
            token = await mock_suap_api.get_token_from_code("bad_code")
            assert token is None


# ============================================================================
# get_user_data
# ============================================================================

class TestGetUserData:
    @pytest.mark.asyncio
    async def test_with_curso_from_student_data(self, mock_suap_api):
        with patch.object(mock_suap_api, "_make_request", new_callable=AsyncMock) as mock_req:
            mock_req.side_effect = [
                {"nome": "João", "email": "joao@example.com"},  # user_data
                {"curso": "Informática"},                        # student_data
            ]
            result = await mock_suap_api.get_user_data("fake-token")
            assert result["nome"] == "João"
            assert result["curso"] == "Informática"

    @pytest.mark.asyncio
    async def test_with_curso_from_extra_data(self, mock_suap_api):
        with patch.object(mock_suap_api, "_make_request", new_callable=AsyncMock) as mock_req:
            mock_req.side_effect = [
                {"nome": "João"},                    # user_data
                {},                                  # student_data (no curso)
                {"vinculo": {"curso": "Redes"}},     # extra_data
            ]
            result = await mock_suap_api.get_user_data("fake-token")
            assert result["curso"] == "Redes"

    @pytest.mark.asyncio
    async def test_no_user_data_returns_none(self, mock_suap_api):
        with patch.object(mock_suap_api, "_make_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = None
            result = await mock_suap_api.get_user_data("fake-token")
            assert result is None


# ============================================================================
# get_academic_periods
# ============================================================================

class TestGetAcademicPeriods:
    @pytest.mark.asyncio
    async def test_returns_list(self, mock_suap_api):
        with patch.object(mock_suap_api, "_make_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"results": [
                {"ano_letivo": 2026, "periodo_letivo": 1},
            ]}
            result = await mock_suap_api.get_academic_periods("fake-token")
            assert len(result) == 1
            assert result[0]["ano_letivo"] == 2026

    @pytest.mark.asyncio
    async def test_returns_none_on_failure(self, mock_suap_api):
        with patch.object(mock_suap_api, "_make_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = None
            result = await mock_suap_api.get_academic_periods("fake-token")
            assert result is None


# ============================================================================
# get_user_grades
# ============================================================================

class TestGetUserGrades:
    @pytest.mark.asyncio
    async def test_with_explicit_period(self, mock_suap_api):
        with patch.object(mock_suap_api, "_make_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"results": [{"disciplina": "Matemática"}]}
            result = await mock_suap_api.get_user_grades("fake-token", "2026", "1")
            assert len(result) == 1

    @pytest.mark.asyncio
    async def test_uses_first_period_when_none_given(self, mock_suap_api):
        with patch.object(mock_suap_api, "_make_request", new_callable=AsyncMock) as mock_req:
            # First call: get_academic_periods, Second call: get grades
            mock_req.side_effect = [
                {"results": [{"ano_letivo": 2026, "periodo_letivo": 1}]},
                {"results": [{"disciplina": "Foo"}]},
            ]
            result = await mock_suap_api.get_user_grades("fake-token")
            assert result is not None


# ============================================================================
# get_dashboard_data
# ============================================================================

class TestGetDashboardData:
    @pytest.mark.asyncio
    async def test_full_dashboard(self, mock_suap_api):
        with patch.object(mock_suap_api, "_get_user_data_with_client", new_callable=AsyncMock) as mock_user, \
             patch.object(mock_suap_api, "_get_academic_periods_with_client", new_callable=AsyncMock) as mock_periods, \
             patch.object(mock_suap_api, "_get_user_grades_with_client", new_callable=AsyncMock) as mock_grades:
            mock_user.return_value = {"nome": "João", "curso": "Info"}
            mock_periods.return_value = [{"ano_letivo": 2026, "periodo_letivo": 1}]
            mock_grades.return_value = [{"disciplina": "Matemática"}]
            result = await mock_suap_api.get_dashboard_data("fake-token", "2026", "1")
            assert result["user"]["nome"] == "João"
            assert result["selected_ano"] == "2026"
            assert result["selected_periodo"] == "1"
            assert len(result["grades"]) == 1

    @pytest.mark.asyncio
    async def test_auto_select_period(self, mock_suap_api):
        """Should auto-select first period when none given."""
        with patch.object(mock_suap_api, "_get_user_data_with_client", new_callable=AsyncMock) as mock_user, \
             patch.object(mock_suap_api, "_get_academic_periods_with_client", new_callable=AsyncMock) as mock_periods, \
             patch.object(mock_suap_api, "_get_user_grades_with_client", new_callable=AsyncMock) as mock_grades:
            mock_user.return_value = {"nome": "João", "curso": "Info"}
            mock_periods.return_value = [{"ano_letivo": 2025, "periodo_letivo": 2}]
            mock_grades.return_value = []
            result = await mock_suap_api.get_dashboard_data("fake-token")
            assert result["selected_ano"] == "2025"
            assert result["selected_periodo"] == "2"


# ============================================================================
# get_disciplinas
# ============================================================================

class TestGetDisciplinas:
    @pytest.mark.asyncio
    async def test_returns_disciplinas(self, mock_suap_api):
        with patch.object(mock_suap_api, "_make_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"results": [{"id": 1, "descricao": "Prog I"}]}
            result = await mock_suap_api.get_disciplinas("fake-token", "2026.1")
            assert len(result) == 1

    @pytest.mark.asyncio
    async def test_returns_none_on_error(self, mock_suap_api):
        with patch.object(mock_suap_api, "_make_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = None
            result = await mock_suap_api.get_disciplinas("fake-token", "2026.1")
            assert result is None


# ============================================================================
# get_disciplina_etapas
# ============================================================================

class TestGetDisciplinaEtapas:
    @pytest.mark.asyncio
    async def test_returns_etapas(self, mock_suap_api):
        with patch.object(mock_suap_api, "_make_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"results": [{"etapa": 1}]}
            result = await mock_suap_api.get_disciplina_etapas("fake-token", 42)
            assert len(result) == 1


# ============================================================================
# get_diarios
# ============================================================================

class TestGetDiarios:
    @pytest.mark.asyncio
    async def test_returns_diarios(self, mock_suap_api):
        with patch.object(mock_suap_api, "_make_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"results": [{"id": 10}]}
            result = await mock_suap_api.get_diarios("fake-token", "2026.1")
            assert len(result) == 1


# ============================================================================
# get_completion_requirements
# ============================================================================

class TestGetCompletionRequirements:
    @pytest.mark.asyncio
    async def test_returns_data(self, mock_suap_api):
        with patch.object(mock_suap_api, "_make_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"requisitos": ["foo"]}
            result = await mock_suap_api.get_completion_requirements("fake-token")
            assert "requisitos" in result

    @pytest.mark.asyncio
    async def test_returns_none_on_error(self, mock_suap_api):
        with patch.object(mock_suap_api, "_make_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = None
            result = await mock_suap_api.get_completion_requirements("fake-token")
            assert result is None