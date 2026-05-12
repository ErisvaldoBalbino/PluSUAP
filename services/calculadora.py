from typing import Dict, Any, List

def process_grades_data(grades_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not grades_data:
        return []
        
    processed_grades = []
    for grade in grades_data:
        n1 = grade.get('nota_etapa_1', {}).get('nota')
        n2 = grade.get('nota_etapa_2', {}).get('nota')
        
        n1_val = float(n1) if n1 is not None and str(n1).strip() != '' else None
        n2_val = float(n2) if n2 is not None and str(n2).strip() != '' else None
        
        situacao = grade.get('situacao', 'Cursando')
        media_parcial = grade.get('media_disciplina')
        
        estado = "OK" 
        alerta = None
        
        if situacao == 'Cursando':
            if n1_val is not None and n2_val is None:
                if n1_val >= 60:
                    estado = "BOM"
                    alerta = f"Precisa de {max((120 - n1_val), 0)} na N2 para aprovação direta."
                else:
                    estado = "PERIGO"
                    alerta = f"Cuidado! Precisa de {120 - n1_val} pontos na N2 para aprovação direta."
            elif n1_val is not None and n2_val is not None:
                media_atual = (n1_val + n2_val) / 2
                if media_atual < 60:
                    estado = "PERIGO"
                    alerta = f"Em prova final. Precisa de {120 - media_atual} na AF."
                else:
                    estado = "OK"
                    
        elif situacao == 'Aprovado':
            estado = "SUCESSO"
        elif situacao == 'Reprovado':
            estado = "FALHA"

        c_grade = grade.copy()
        c_grade['n1_limpa'] = n1_val if n1_val is not None else '-'
        c_grade['n2_limpa'] = n2_val if n2_val is not None else '-'
        c_grade['estado_ui'] = estado
        c_grade['alerta'] = alerta
        
        carga = grade.get('carga_horaria', 0)
        aulas_cumpridas = grade.get('carga_horaria_cumprida', 0)
        faltas = grade.get('numero_faltas', 0)
        
        if aulas_cumpridas:
            freq_percent = 100 - ((faltas / aulas_cumpridas) * 100)
        else:
            freq_percent = 100
        
        c_grade['freq_perc'] = min(max(round(freq_percent), 0), 100)
            
        processed_grades.append(c_grade)
        
    return processed_grades

def calculate_summary(grades_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not grades_data:
        return {'total_subjects': 0, 'approved_subjects': 0, 'at_risk_subjects': 0}

    total = len(grades_data)
    approved = sum(1 for g in grades_data if g.get('situacao') == 'Aprovado')
    at_risk = sum(1 for g in grades_data if g.get('situacao') not in ['Aprovado', 'Transferido', 'Cursando'])
    for g in grades_data:
        if g.get('situacao') == 'Cursando':
            n1 = g.get('nota_etapa_1', {}).get('nota')
            if n1 is not None and float(n1) < 40:
                at_risk += 1

    return {
        'total_subjects': total,
        'approved_subjects': approved,
        'at_risk_subjects': at_risk
    }

def process_diarios_faltas(diarios_data: List[Dict[str, Any]], grades_data: List[Dict[str, Any]] = None) -> Dict[str, Any]:
    if not diarios_data:
        return {"summary": {}, "dias_semana": {}, "diarios": []}

    grades_data = grades_data or []
    processed = []
    
    global_ch_total = 0
    global_faltas = 0
    global_dias_aulas = {}
    
    for diario in diarios_data:
        disciplina = diario.get('disciplina', {})
        descricao = disciplina.get('descricao', 'Desconhecida')
        sigla = disciplina.get('sigla', '')
        
        ch_total_aula = disciplina.get('ch_total_aula', 0)
        qtd_faltas = disciplina.get('qtd_faltas', 0)
        
        matching_grade = None
        for grade in grades_data:
            grade_disc = str(grade.get('disciplina', ''))
            if (sigla and sigla in grade_disc) or (descricao and descricao.lower() in grade_disc.lower()):
                matching_grade = grade
                break
                
        if matching_grade:
            ch_total_aula = matching_grade.get('carga_horaria', ch_total_aula)
            qtd_faltas = matching_grade.get('numero_faltas', qtd_faltas)
            
        try:
            ch_total_aula = int(ch_total_aula)
        except (ValueError, TypeError):
            ch_total_aula = 0
            
        try:
            qtd_faltas = int(qtd_faltas)
        except (ValueError, TypeError):
            qtd_faltas = 0

        global_ch_total += ch_total_aula
        global_faltas += qtd_faltas
        
        limite_faltas = int(ch_total_aula * 0.25)
        faltas_restantes = max(0, limite_faltas - qtd_faltas)
        
        horarios = diario.get('horarios', [])
        dias_aulas = {}
        for h in horarios:
            dia = h.get('dia')
            if dia:
                dias_aulas[dia] = dias_aulas.get(dia, 0) + 1
                global_dias_aulas[dia] = global_dias_aulas.get(dia, 0) + 1
                
        processed.append({
            'id': diario.get('id'),
            'descricao': descricao,
            'sigla': sigla,
            'ch_total_aula': ch_total_aula,
            'qtd_faltas': qtd_faltas,
            'limite_faltas': limite_faltas,
            'faltas_restantes': faltas_restantes,
            'horarios_agrupados': dias_aulas
        })
        
    global_limite = int(global_ch_total * 0.25)
    global_restantes = max(0, global_limite - global_faltas)
    
    # Calculate how many times they can miss each specific day of the week
    dias_semana_faltas = {}
    for dia, qtd in global_dias_aulas.items():
        if qtd > 0:
            dias_semana_faltas[dia] = {
                "aulas_no_dia": qtd,
                "pode_faltar_vezes": global_restantes // qtd
            }

    return {
        "summary": {
            "ch_total": global_ch_total,
            "faltas": global_faltas,
            "limite_faltas": global_limite,
            "faltas_restantes": global_restantes
        },
        "dias_semana": dias_semana_faltas,
        "diarios": processed
    }
