import os
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware
from dotenv import load_dotenv

from client.suap import suap_api, SUAPAuthError
from services.calculadora import process_grades_data, calculate_summary

load_dotenv()

app = FastAPI(title="PluSUAP")


@app.exception_handler(SUAPAuthError)
async def suap_auth_error_handler(request: Request, exc: SUAPAuthError):
    """Limpa a sessão quando o token SUAP expira e retorna 401."""
    request.session.clear()
    return JSONResponse(
        status_code=401,
        content={"detail": "Token SUAP expirado. Faça login novamente."},
    )

app.add_middleware(SessionMiddleware, secret_key=os.getenv("SECRET_KEY", "uma-chave-secreta-padrao-aqui-123"))

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

def get_token(request: Request):
    """Pega o token salva na seção"""
    return request.session.get("suap_token")

def normalize_periods(raw_periods):
    periods = []
    for period in raw_periods or []:
        ano = str(period.get("ano_letivo", period.get("ano", "")))
        periodo = str(period.get("periodo_letivo", period.get("periodo", "")))
        if ano and periodo:
            periods.append({
                "ano_letivo": ano,
                "periodo_letivo": periodo,
                "label": f"{ano}.{periodo}",
            })
    return periods

def get_selected_period(request: Request):
    return (
        request.session.get("selected_ano_letivo"),
        request.session.get("selected_periodo_letivo"),
    )

def save_selected_period(request: Request, ano_letivo: str, periodo_letivo: str):
    request.session["selected_ano_letivo"] = str(ano_letivo)
    request.session["selected_periodo_letivo"] = str(periodo_letivo)


@app.get("/login", response_class=HTMLResponse)
async def page_login(request: Request):
    if get_token(request):
        return RedirectResponse("/")
    return templates.TemplateResponse("login.html", {"request": request, "title": "Login Simplificado"})

@app.get("/auth/suap")
async def login_suap():
    """Redireciona o usuário para a página de permissão oficial do SUAP"""
    url = suap_api.get_authorization_url()
    return RedirectResponse(url)

@app.get("/oauth/callback")
async def suap_callback(request: Request, code: str = None):
    """Callback chamado pelo próprio servidor do SUAP após o login bem-sucedido"""
    if not code:
        return RedirectResponse("/login?error=No_Code")
        
    token = await suap_api.get_token_from_code(code)
    if token:
        request.session["suap_token"] = token
        return RedirectResponse("/")
        
    return RedirectResponse("/login?error=Auth_Failed")

@app.get("/logout")
async def logout(request: Request):
    """Destrói a sessão e retorna ao login"""
    request.session.clear()
    return RedirectResponse("/login")

@app.get("/", response_class=HTMLResponse)
async def page_dashboard(request: Request):
    token = get_token(request)
    if not token:
        return RedirectResponse("/login")

    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "title": "Início",
    })

@app.get("/api/dashboard-data")
async def dashboard_data(request: Request, ano_letivo: str = None, periodo_letivo: str = None):
    token = get_token(request)
    if not token:
        return JSONResponse({"detail": "Não autenticado"}, status_code=401)

    selected_ano, selected_periodo = get_selected_period(request)
    ano_letivo = ano_letivo or selected_ano
    periodo_letivo = periodo_letivo or selected_periodo

    raw_data = await suap_api.get_dashboard_data(token, ano_letivo, periodo_letivo)
    raw_grades = raw_data.get("grades", [])

    processed_grades = process_grades_data(raw_grades)
    summary = calculate_summary(raw_grades)

    periods = normalize_periods(raw_data.get("periods", []))
    final_selected_ano = raw_data.get("selected_ano")
    final_selected_periodo = raw_data.get("selected_periodo")

    if final_selected_ano and final_selected_periodo:
        save_selected_period(request, final_selected_ano, final_selected_periodo)

    return {
        "user": raw_data.get("user", {}),
        "grades": processed_grades,
        "summary": summary,
        "periods": periods,
        "selected_ano": final_selected_ano,
        "selected_periodo": final_selected_periodo,
    }

@app.get("/api/periods")
async def list_periods(request: Request):
    token = get_token(request)
    if not token:
        return JSONResponse({"detail": "Não autenticado"}, status_code=401)

    raw_periods = await suap_api.get_academic_periods(token)
    periods = normalize_periods(raw_periods)
    selected_ano, selected_periodo = get_selected_period(request)

    if periods:
        has_saved_selection = any(
            selected_ano == period["ano_letivo"] and selected_periodo == period["periodo_letivo"]
            for period in periods
        )
        if not has_saved_selection:
            selected_ano = periods[0]["ano_letivo"]
            selected_periodo = periods[0]["periodo_letivo"]
            save_selected_period(request, selected_ano, selected_periodo)

    return {
        "periods": periods,
        "selected_ano": selected_ano,
        "selected_periodo": selected_periodo,
    }

@app.post("/api/periods/select")
async def select_period(request: Request, ano_letivo: str, periodo_letivo: str):
    token = get_token(request)
    if not token:
        return JSONResponse({"detail": "Não autenticado"}, status_code=401)

    save_selected_period(request, ano_letivo, periodo_letivo)
    return {"ok": True}

@app.get("/simulador", response_class=HTMLResponse)
async def page_simulador(request: Request):
    if not get_token(request):
        return RedirectResponse("/login")
        
    return templates.TemplateResponse("simulador.html", {"request": request, "title": "Simulador de Notas"})

@app.get("/requisitos", response_class=HTMLResponse)
async def page_requisitos(request: Request):
    if not get_token(request):
        return RedirectResponse("/login")
        
    return templates.TemplateResponse("requisitos.html", {"request": request, "title": "Requisitos de Conclusão"})

@app.get("/api/requisitos")
async def api_requisitos(request: Request):
    token = get_token(request)
    if not token:
        return JSONResponse({"detail": "Não autenticado"}, status_code=401)

    data = await suap_api.get_completion_requirements(token)
    return data or {}

@app.get("/disciplinas", response_class=HTMLResponse)
async def page_disciplinas(request: Request):
    if not get_token(request):
        return RedirectResponse("/login")
    return templates.TemplateResponse("disciplinas.html", {"request": request, "title": "Minhas Disciplinas"})

@app.get("/api/disciplinas")
async def api_disciplinas(request: Request, ano_letivo: str = None, periodo_letivo: str = None):
    token = get_token(request)
    if not token:
        return JSONResponse({"detail": "Não autenticado"}, status_code=401)

    selected_ano, selected_periodo = get_selected_period(request)
    ano = ano_letivo or selected_ano
    periodo = periodo_letivo or selected_periodo

    if not (ano and periodo):
        return JSONResponse({"detail": "Nenhum período selecionado"}, status_code=400)

    semestre = f"{ano}.{periodo}"
    disciplinas = await suap_api.get_disciplinas(token, semestre)
    return {"disciplinas": disciplinas or []}

@app.get("/api/disciplinas/{disciplina_id}/etapas")
async def api_disciplina_etapas(request: Request, disciplina_id: int):
    token = get_token(request)
    if not token:
        return JSONResponse({"detail": "Não autenticado"}, status_code=401)

    etapas = await suap_api.get_disciplina_etapas(token, disciplina_id)
    return {"etapas": etapas or []}
