"""
Tests for services/calculadora.py — pure functions with no external dependencies.
"""

import pytest
from services.calculadora import process_grades_data, calculate_summary, process_diarios_faltas


# ============================================================================
# process_grades_data
# ============================================================================

class TestProcessGradesData:
    """Unit tests for process_grades_data."""

    def test_empty_input(self):
        assert process_grades_data([]) == []
        assert process_grades_data(None) == []

    def test_approved_subject(self, sample_grades):
        result = process_grades_data(sample_grades)
        math = next(r for r in result if r["disciplina"] == "Matemática")
        assert math["estado_ui"] == "SUCESSO"
        assert math["alerta"] is None
        assert math["n1_limpa"] == 80.0
        assert math["n2_limpa"] == 85.0

    def test_failed_subject(self, sample_grades):
        result = process_grades_data(sample_grades)
        bd = next(r for r in result if r["disciplina"] == "Banco de Dados")
        assert bd["estado_ui"] == "FALHA"

    def test_cursando_only_n1_good(self, sample_grades):
        """Cursando, N1 >= 60, N2 missing → BOM status."""
        result = process_grades_data(sample_grades)
        prog = next(r for r in result if r["disciplina"] == "Programação I")
        assert prog["estado_ui"] == "BOM"
        assert "50.0 na N2" in prog["alerta"]

    def test_cursando_only_n1_bad(self, sample_grades):
        """Cursando, N1 < 40, N2 missing → PERIGO status."""
        result = process_grades_data(sample_grades)
        alg = next(r for r in result if r["disciplina"] == "Algoritmos")
        assert alg["estado_ui"] == "PERIGO"
        assert "Cuidado" in alg["alerta"]

    def test_cursando_both_notes_media_below_60(self, sample_grades):
        """Cursando with both notes, media < 60 → PERIGO, mentions prova final."""
        result = process_grades_data(sample_grades)
        red = next(r for r in result if r["disciplina"] == "Redes")
        assert red["estado_ui"] == "PERIGO"
        assert "prova final" in red["alerta"].lower()

    def test_cursando_both_notes_media_ok(self):
        """Cursando with both notes, media >= 60 → OK."""
        grades = [{
            "disciplina": "Foo",
            "situacao": "Cursando",
            "nota_etapa_1": {"nota": 70},
            "nota_etapa_2": {"nota": 70},
            "media_disciplina": 70,
            "carga_horaria": 60,
            "carga_horaria_cumprida": 60,
            "numero_faltas": 0,
        }]
        result = process_grades_data(grades)
        assert result[0]["estado_ui"] == "OK"
        assert result[0]["alerta"] is None

    def test_missing_notes_show_dash(self, sample_grades):
        result = process_grades_data(sample_grades)
        etica = next(r for r in result if r["disciplina"] == "Ética")
        assert etica["n1_limpa"] == "-"
        assert etica["n2_limpa"] == "-"

    def test_note_string_conversion(self):
        """Notes may come as strings from the API."""
        grades = [{
            "disciplina": "Test",
            "situacao": "Cursando",
            "nota_etapa_1": {"nota": "85"},
            "nota_etapa_2": {"nota": "90"},
            "media_disciplina": 87.5,
            "carga_horaria": 60,
            "carga_horaria_cumprida": 60,
            "numero_faltas": 0,
        }]
        result = process_grades_data(grades)
        assert result[0]["n1_limpa"] == 85.0
        assert result[0]["n2_limpa"] == 90.0

    def test_empty_string_note_treated_as_none(self):
        grades = [{
            "disciplina": "Test",
            "situacao": "Cursando",
            "nota_etapa_1": {"nota": ""},
            "nota_etapa_2": {"nota": ""},
            "media_disciplina": None,
            "carga_horaria": 60,
            "carga_horaria_cumprida": 0,
            "numero_faltas": 0,
        }]
        result = process_grades_data(grades)
        assert result[0]["n1_limpa"] == "-"
        assert result[0]["n2_limpa"] == "-"

    # --- Frequency percent tests ---

    def test_frequency_calculation(self, sample_grades):
        result = process_grades_data(sample_grades)
        prog = next(r for r in result if r["disciplina"] == "Programação I")
        # 2 faltas / 40 cumpridas = 5% → freq = 95%
        assert prog["freq_perc"] == 95

    def test_frequency_zero_absences(self):
        grades = [{
            "disciplina": "Perf",
            "situacao": "Aprovado",
            "nota_etapa_1": {"nota": 90},
            "nota_etapa_2": {"nota": 80},
            "media_disciplina": 85,
            "carga_horaria": 60,
            "carga_horaria_cumprida": 60,
            "numero_faltas": 0,
        }]
        result = process_grades_data(grades)
        assert result[0]["freq_perc"] == 100

    def test_frequency_zero_classes_held(self):
        """When carga_horaria_cumprida is 0, freq should be 100%."""
        grades = [{
            "disciplina": "New",
            "situacao": "Cursando",
            "nota_etapa_1": {"nota": None},
            "nota_etapa_2": {"nota": None},
            "media_disciplina": None,
            "carga_horaria": 40,
            "carga_horaria_cumprida": 0,
            "numero_faltas": 0,
        }]
        result = process_grades_data(grades)
        assert result[0]["freq_perc"] == 100

    def test_frequency_capped_at_100(self):
        """Frequency should never exceed 100 even with weird data."""
        grades = [{
            "disciplina": "Weird",
            "situacao": "Aprovado",
            "nota_etapa_1": {"nota": 80},
            "nota_etapa_2": {"nota": 80},
            "media_disciplina": 80,
            "carga_horaria": 60,
            "carga_horaria_cumprida": 10,
            "numero_faltas": 0,
        }]
        result = process_grades_data(grades)
        assert result[0]["freq_perc"] == 100

    def test_transferido_status(self, sample_grades):
        result = process_grades_data(sample_grades)
        logica = next(r for r in result if r["disciplina"] == "Lógica")
        assert logica["estado_ui"] == "OK"  # falls through to default


# ============================================================================
# calculate_summary
# ============================================================================

class TestCalculateSummary:
    def test_empty_input(self):
        result = calculate_summary([])
        assert result == {'total_subjects': 0, 'approved_subjects': 0, 'at_risk_subjects': 0}

    def test_none_input(self):
        result = calculate_summary(None)
        assert result == {'total_subjects': 0, 'approved_subjects': 0, 'at_risk_subjects': 0}

    def test_mixed_subjects(self, sample_grades):
        result = calculate_summary(sample_grades)
        assert result['total_subjects'] == 7
        assert result['approved_subjects'] == 1  # only Matemática
        # Reprovado (Banco de Dados) + Cursando N1<40 (Algoritmos) = 2
        assert result['at_risk_subjects'] == 2

    def test_all_approved(self):
        grades = [
            {"situacao": "Aprovado"},
            {"situacao": "Aprovado"},
        ]
        result = calculate_summary(grades)
        assert result['approved_subjects'] == 2
        assert result['at_risk_subjects'] == 0

    def test_cursando_safe_n1(self):
        """Cursando with N1=80 is not at risk."""
        grades = [{
            "situacao": "Cursando",
            "nota_etapa_1": {"nota": 80},
        }]
        result = calculate_summary(grades)
        assert result['at_risk_subjects'] == 0

    def test_cursando_risky_n1(self):
        """Cursando with N1=30 is at risk."""
        grades = [{
            "situacao": "Cursando",
            "nota_etapa_1": {"nota": 30},
        }]
        result = calculate_summary(grades)
        assert result['at_risk_subjects'] == 1

    def test_cursando_no_n1_not_at_risk(self):
        """Cursando without N1 is not counted as at risk."""
        grades = [{
            "situacao": "Cursando",
            "nota_etapa_1": {"nota": None},
        }]
        result = calculate_summary(grades)
        assert result['at_risk_subjects'] == 0


# ============================================================================
# process_diarios_faltas
# ============================================================================

class TestProcessDiariosFaltas:
    def test_empty_input(self):
        result = process_diarios_faltas([])
        assert result == {"summary": {}, "dias_semana": {}, "diarios": []}

    def test_none_input(self):
        result = process_diarios_faltas(None)
        assert result == {"summary": {}, "dias_semana": {}, "diarios": []}

    def test_basic_processing(self, sample_diarios):
        result = process_diarios_faltas(sample_diarios)
        assert len(result["diarios"]) == 2
        prog = next(d for d in result["diarios"] if d["descricao"] == "Programação I")
        assert prog["sigla"] == "PROG1"
        assert prog["ch_total_aula"] == 80
        assert prog["qtd_faltas"] == 2
        assert prog["limite_faltas"] == 20  # 80 * 0.25
        assert prog["faltas_restantes"] == 18  # 20 - 2
        assert prog["aulas_cumpridas"] == 0

    def test_summary_totals(self, sample_diarios):
        result = process_diarios_faltas(sample_diarios)
        assert result["summary"]["ch_total"] == 140  # 80 + 60
        assert result["summary"]["faltas"] == 3  # 2 + 1
        assert result["summary"]["limite_faltas"] == 35  # 140 * 0.25
        assert result["summary"]["aulas_cumpridas"] == 0

    def test_dias_semana(self, sample_diarios):
        result = process_diarios_faltas(sample_diarios)
        dias = result["dias_semana"]
        # PROG1 has Seg & Qua (2 per day), MAT has Ter (1)
        assert "Seg" in dias
        assert "Qua" in dias
        assert "Ter" in dias

    def test_dias_semana_pode_faltar(self, sample_diarios):
        result = process_diarios_faltas(sample_diarios)
        # global_restantes = 35 - 3 = 32
        # Seg has 1 aula (PROG1 has 1 class on Seg) → pode_faltar = 32 // 1 = 32
        assert result["dias_semana"]["Seg"]["pode_faltar_vezes"] == 32

    def test_grade_matching(self, sample_diarios, sample_grades):
        """When grades match diarios by sigla, grade data overrides diario data."""
        # sample_grades has "Programação I" with numero_faltas=2, carga_horaria=80
        # PROG1 diario also has qtd_faltas=2, ch_total_aula=80
        result = process_diarios_faltas(sample_diarios, sample_grades)
        prog = next(d for d in result["diarios"] if d["descricao"] == "Programação I")
        # Values should come from the matching grade
        assert prog["ch_total_aula"] == 80
        assert prog["qtd_faltas"] == 2
        assert prog["aulas_cumpridas"] == 40
        assert result["summary"]["aulas_cumpridas"] == 100

    def test_faltas_restantes_never_negative(self):
        """Even with more faltas than the limit, faltas_restantes should be 0."""
        diarios = [{
            "id": 1,
            "disciplina": {
                "descricao": "Hard",
                "sigla": "HRD",
                "ch_total_aula": 60,
                "qtd_faltas": 20,
            },
            "horarios": [],
        }]
        result = process_diarios_faltas(diarios)
        assert result["diarios"][0]["faltas_restantes"] == 0

    def test_invalid_ch_and_faltas_handled(self):
        """Non-numeric ch_total_aula and qtd_faltas should be treated as 0."""
        diarios = [{
            "id": 1,
            "disciplina": {
                "descricao": "Bad",
                "sigla": "BD",
                "ch_total_aula": "invalid",
                "qtd_faltas": None,
            },
            "horarios": [],
        }]
        result = process_diarios_faltas(diarios)
        assert result["diarios"][0]["ch_total_aula"] == 0
        assert result["diarios"][0]["qtd_faltas"] == 0
        assert result["diarios"][0]["limite_faltas"] == 0

    def test_horarios_grouped_by_dia(self, sample_diarios):
        result = process_diarios_faltas(sample_diarios)
        prog = next(d for d in result["diarios"] if d["descricao"] == "Programação I")
        assert "Seg" in prog["horarios_agrupados"]
        assert "Qua" in prog["horarios_agrupados"]
        assert prog["horarios_agrupados"]["Seg"] == 1
        assert prog["horarios_agrupados"]["Qua"] == 1