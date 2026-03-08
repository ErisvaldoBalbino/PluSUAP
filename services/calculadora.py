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
        faltas = grade.get('numero_faltas', 0)
        max_faltas = carga * 0.25 if carga else 0
        freq_percent = 100 - ((faltas / (carga if carga else 1)) * 100)
        
        c_grade['freq_perc'] = min(max(round(freq_percent), 0), 100)
        if c_grade['freq_perc'] < 75 and situacao == 'Cursando':
            c_grade['estado_ui'] = "FALHA"
            c_grade['alerta'] = "Reprovado por Falta!"
            
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
