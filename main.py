import os
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware
from dotenv import load_dotenv

from client.suap import suap_api
from services.calculadora import process_grades_data, calculate_summary

load_dotenv()

app = FastAPI(title="PluSUAP")

app.add_middleware(SessionMiddleware, secret_key=os.getenv("SECRET_KEY", "uma-chave-secreta-padrao-aqui-123"))

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

def get_token(request: Request):
    """Pega o token salva na seção"""
    return request.session.get("suap_token")


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

    raw_data = await suap_api.get_dashboard_data(token, ano_letivo, periodo_letivo)
    raw_grades = raw_data.get("grades", [])

    processed_grades = process_grades_data(raw_grades)
    summary = calculate_summary(raw_grades)

    periods = []
    for period in raw_data.get("periods", []):
        ano = str(period.get("ano_letivo", period.get("ano", "")))
        periodo = str(period.get("periodo_letivo", period.get("periodo", "")))
        if ano and periodo:
            periods.append({
                "ano_letivo": ano,
                "periodo_letivo": periodo,
                "label": f"{ano}.{periodo}",
            })

    return {
        "user": raw_data.get("user", {}),
        "grades": processed_grades,
        "summary": summary,
        "periods": periods,
        "selected_ano": raw_data.get("selected_ano"),
        "selected_periodo": raw_data.get("selected_periodo"),
    }

@app.get("/relatorios", response_class=HTMLResponse)
async def page_relatorios(request: Request):
    if not get_token(request):
        return RedirectResponse("/login")
        
    return templates.TemplateResponse("relatorios.html", {"request": request, "title": "Relatório"})

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

@app.get("/exportar/{formato}")
async def exportar_dados(request: Request, formato: str):
    if not get_token(request):
        return RedirectResponse("/login")
        
    return {"status": f"Exportando {formato}"}
