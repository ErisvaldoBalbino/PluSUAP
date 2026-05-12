import httpx
import asyncio
import logging
import os
from typing import Optional, Dict, Any, List
from urllib.parse import urlencode

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s]: %(message)s",
)
logger = logging.getLogger(__name__)


class SUAPAuthError(Exception):
    """Token SUAP expirado ou inválido (HTTP 401)."""
    pass

class AsyncSUAPAPI:
    def __init__(self):
        self.client_id = os.getenv('SUAP_CLIENT_ID')
        self.client_secret = os.getenv('SUAP_CLIENT_SECRET')
        self.redirect_uri = os.getenv('SUAP_REDIRECT_URI')
        
        self.authorization_url = 'https://suap.ifrn.edu.br/o/authorize/'
        self.access_token_url = 'https://suap.ifrn.edu.br/o/token/'
        self.api_url = 'https://suap.ifrn.edu.br/api/'
        
        self.user_data_url = f"{self.api_url}rh/eu/"
        self.extra_user_data_url = f"{self.api_url}v2/minhas-informacoes/meus-dados/"
        self.student_data_url = f"{self.api_url}ensino/meus-dados-aluno/"
        self.periods_url = f"{self.api_url}ensino/meus-periodos-letivos/"
        self.upcoming_evaluations_url = f"{self.api_url}ensino/minhas-proximas-avaliacoes/"
        self.completion_requirements_url = f"{self.api_url}ensino/requisitos-conclusao/"
        
        self.default_scope = ['identificacao', 'email']
        self.max_retries = 3
        self.timeout = 10.0

    @staticmethod
    def _extract_results(data: Any) -> Any:
        if isinstance(data, dict) and 'results' in data:
            return data['results']
        return data

    async def _get_user_data_with_client(self, client: httpx.AsyncClient) -> Optional[Dict[str, Any]]:
        user_task = asyncio.create_task(self._make_request(client, 'GET', self.user_data_url))
        student_task = asyncio.create_task(self._make_request(client, 'GET', self.student_data_url))

        user_data, student_data = await asyncio.gather(user_task, student_task)

        if not user_data:
            return None

        if student_data and 'curso' in student_data:
            user_data['curso'] = student_data['curso']
            return user_data

        extra_data = await self._make_request(client, 'GET', self.extra_user_data_url)
        if extra_data:
            if 'vinculo' in extra_data and 'curso' in extra_data['vinculo']:
                user_data['curso'] = extra_data['vinculo']['curso']
            elif 'curso' in extra_data:
                user_data['curso'] = extra_data['curso']

        return user_data

    async def _get_academic_periods_with_client(self, client: httpx.AsyncClient) -> Optional[List[Dict[str, Any]]]:
        data = await self._make_request(client, 'GET', self.periods_url)
        data = self._extract_results(data)
        if isinstance(data, list):
            return data
        return [data] if data else None

    async def _get_user_grades_with_client(
        self,
        client: httpx.AsyncClient,
        ano_letivo: str = None,
        periodo_letivo: str = None
    ) -> Optional[List[Dict[str, Any]]]:
        if not (ano_letivo and periodo_letivo):
            periods = await self._get_academic_periods_with_client(client)
            if not periods:
                return None
            current = periods[0]
            ano_letivo = current.get('ano_letivo', current.get('ano'))
            periodo_letivo = current.get('periodo_letivo', current.get('periodo'))

        url = f"{self.api_url}ensino/meu-boletim/{ano_letivo}/{periodo_letivo}/"
        data = await self._make_request(client, 'GET', url)
        return self._extract_results(data)

    async def _make_request(self, client: httpx.AsyncClient, method: str, url: str, **kwargs) -> Optional[Any]:
        kwargs.setdefault('timeout', self.timeout)
        for attempt in range(self.max_retries):
            try:
                response = await client.request(method, url, **kwargs)
                
                if response.status_code == 404:
                    logger.warning(f"Endpoint não encontrado (404): {url}")
                    return None
                
                response.raise_for_status()
                
                content_type = response.headers.get('Content-Type', '')
                if 'application/json' not in content_type:
                    return None
                    
                return response.json()

            except httpx.TimeoutException:
                logger.warning(f"Timeout ao acessar {url}. Tentativa {attempt + 1}")
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 401:
                    logger.warning(f"Token expirado/inválido (401) em {url}")
                    raise SUAPAuthError("Token SUAP expirado ou inválido")
                logger.error(f"Erro HTTP {e.response.status_code} em {url}")
            except httpx.RequestError as e:
                logger.error(f"Erro de Conexão em {url}: {e}")
                
            if attempt < self.max_retries - 1:
                await asyncio.sleep(1)
        return None

    def get_authorization_url(self, state: str = None) -> str:
        """Gera URL de autorização OAuth."""
        params = {
            'client_id': self.client_id,
            'redirect_uri': self.redirect_uri,
            'response_type': 'code',
            'scope': ' '.join(self.default_scope)
        }
        if state:
            params['state'] = state
        return f"{self.authorization_url}?{urlencode(params)}"

    async def get_token_from_code(self, code: str) -> Optional[str]:
        data = {
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'code': code,
            'redirect_uri': self.redirect_uri,
            'grant_type': 'authorization_code'
        }
        
        async with httpx.AsyncClient() as client:
            result = await self._make_request(client, 'POST', self.access_token_url, data=data)
            if result:
                return result.get('access_token')
        return None

    async def get_user_data(self, token: str) -> Optional[Dict[str, Any]]:
        headers = {'Authorization': f'Bearer {token}'}

        async with httpx.AsyncClient(headers=headers) as client:
            return await self._get_user_data_with_client(client)

    async def get_academic_periods(self, token: str) -> Optional[List[Dict[str, Any]]]:
        headers = {"Authorization": f"Bearer {token}"}
        async with httpx.AsyncClient(headers=headers) as client:
            return await self._get_academic_periods_with_client(client)

    async def get_user_grades(self, token: str, ano_letivo: str = None, periodo_letivo: str = None) -> Optional[List[Dict[str, Any]]]:
        headers = {"Authorization": f"Bearer {token}"}

        async with httpx.AsyncClient(headers=headers) as client:
            return await self._get_user_grades_with_client(client, ano_letivo, periodo_letivo)

    async def get_dashboard_data(self, token: str, ano_letivo: str = None, periodo_letivo: str = None) -> Dict[str, Any]:
        headers = {"Authorization": f"Bearer {token}"}

        async with httpx.AsyncClient(headers=headers) as client:
            user_task = asyncio.create_task(self._get_user_data_with_client(client))
            periods_task = asyncio.create_task(self._get_academic_periods_with_client(client))

            user_data, periods = await asyncio.gather(user_task, periods_task)
            periods = periods or []

            selected_ano = ano_letivo
            selected_periodo = periodo_letivo

            if not (selected_ano and selected_periodo) and periods:
                current = periods[0]
                selected_ano = str(current.get('ano_letivo', current.get('ano', '')))
                selected_periodo = str(current.get('periodo_letivo', current.get('periodo', '')))

            grades = []
            if selected_ano and selected_periodo:
                fetched_grades = await self._get_user_grades_with_client(client, selected_ano, selected_periodo)
                if isinstance(fetched_grades, list):
                    grades = fetched_grades

            return {
                "user": user_data or {},
                "grades": grades,
                "periods": periods,
                "selected_ano": selected_ano,
                "selected_periodo": selected_periodo,
            }

    async def get_upcoming_evaluations(self, token: str) -> Optional[List[Dict[str, Any]]]:
        headers = {"Authorization": f"Bearer {token}"}
        async with httpx.AsyncClient(headers=headers) as client:
            data = await self._make_request(client, 'GET', self.upcoming_evaluations_url)
            data = self._extract_results(data)
            if isinstance(data, list):
                return data
            return data if isinstance(data, list) else []
            
    async def get_completion_requirements(self, token: str) -> Optional[Dict[str, Any]]:
        headers = {"Authorization": f"Bearer {token}"}
        async with httpx.AsyncClient(headers=headers) as client:
            return await self._make_request(client, 'GET', self.completion_requirements_url)

    async def get_disciplinas(self, token: str, semestre: str) -> Optional[List[Dict[str, Any]]]:
        headers = {"Authorization": f"Bearer {token}"}
        url = f"{self.api_url}ensino/disciplinas/{semestre}/"
        async with httpx.AsyncClient(headers=headers) as client:
            data = await self._make_request(client, 'GET', url)
            return self._extract_results(data)

    async def get_disciplina_etapas(self, token: str, disciplina_id: int) -> Optional[List[Dict[str, Any]]]:
        headers = {"Authorization": f"Bearer {token}"}
        url = f"{self.api_url}ensino/disciplinas/{disciplina_id}/etapas/"
        async with httpx.AsyncClient(headers=headers) as client:
            data = await self._make_request(client, 'GET', url)
            return self._extract_results(data)

    async def get_diarios(self, token: str, semestre: str) -> Optional[List[Dict[str, Any]]]:
        headers = {"Authorization": f"Bearer {token}"}
        url = f"{self.api_url}ensino/diarios/{semestre}/"
        async with httpx.AsyncClient(headers=headers) as client:
            data = await self._make_request(client, 'GET', url)
            return self._extract_results(data)

suap_api = AsyncSUAPAPI()
