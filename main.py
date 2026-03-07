from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

app = FastAPI(title="PluSUAP")

app.mount("/static", StaticFiles(directory="static"), name="static")

templates = Jinja2Templates(directory="templates")

@app.get("/login", response_class=HTMLResponse)
async def page_login(request: Request):
    return templates.TemplateResponse("login.html", {"request": request, "title": "Login Simplificado"})

@app.get("/", response_class=HTMLResponse)
async def page_dashboard(request: Request):
    return templates.TemplateResponse("dashboard.html", {"request": request, "title": "Página Inicial"})

@app.get("/relatorios", response_class=HTMLResponse)
async def page_relatorios(request: Request):
    return templates.TemplateResponse("relatorios.html", {"request": request, "title": "Relatórios e Boletim"})

@app.get("/simulador", response_class=HTMLResponse)
async def page_simulador(request: Request):
    return templates.TemplateResponse("simulador.html", {"request": request, "title": "Simulador de Notas"})

@app.get("/requisitos", response_class=HTMLResponse)
async def page_requisitos(request: Request):
    return templates.TemplateResponse("requisitos.html", {"request": request, "title": "Requisitos de Conclusão"})

@app.get("/exportar/{formato}")
async def exportar_dados(formato: str):
    return {"status": f"Exportando {formato}"}
