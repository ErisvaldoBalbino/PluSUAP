const MEDIA_APROVACAO = 60;
const MEDIA_FINAL = 40;
const NOTA_MAXIMA = 100;
const NOTA_MINIMA = 0;
const CARGA_HORARIA_MAXIMA = 1000;

(function () {
    const form = document.getElementById('simulador-form');
    if (!form) return;

    const disciplina_select = document.getElementById('disciplinaSelect');
    const resultado_hint = document.getElementById('resultadoHint');
    const resultados = document.getElementById('resultados');
    const necessidade_final = document.getElementById('necessidadeFinal');
    const form_loading = document.getElementById('simuladorFormLoading');
    const resultado_loading = document.getElementById('simuladorResultadoLoading');
    const resultado_content = document.getElementById('simuladorResultadoContent');

    const nota_1 = document.getElementById('nota1');
    const nota_2 = document.getElementById('nota2');
    const faltas = document.getElementById('faltas');
    const carga_horaria = document.getElementById('cargaHoraria');
    const limite_faltas = document.getElementById('limiteFaltas');

    const media_parcial = document.getElementById('mediaParcial');
    const situacao_atual = document.getElementById('situacaoAtual');
    const frequencia_atual = document.getElementById('frequenciaAtual');
    const pode_faltar = document.getElementById('podeFaltar');
    const possibilidades_finais = document.getElementById('possibilidadesFinais');
    const submit_button = form.querySelector('button[type="submit"]');

    let disciplinas_data = [];
    const default_hint = 'Preencha os campos e clique em calcular para ver os detalhes.';

    function parse_number(value) {
        const parsed = parseFloat(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function show_alert(message, type = 'warning') {
        const existing = document.querySelector('.simulador-alert');
        if (existing) existing.remove();

        const alert = document.createElement('div');
        alert.className = `alert alert-${type} simulador-alert fixed top-4 right-4 z-[9999] shadow-lg max-w-sm`;
        alert.innerHTML = `<span>${message}</span>`;
        document.body.appendChild(alert);
        setTimeout(() => alert.remove(), 3000);
    }

    function set_loading_state(is_loading) {
        form_loading.classList.toggle('hidden', !is_loading);
        resultado_loading.classList.toggle('hidden', !is_loading);
        form.classList.toggle('hidden', is_loading);
        resultado_content.classList.toggle('hidden', is_loading);

        disciplina_select.disabled = is_loading;
        if (submit_button) submit_button.disabled = is_loading;

        if (is_loading) {
            resultado_hint.textContent = 'Atualizando dados do período...';
            resultado_hint.classList.remove('hidden');
            resultados.classList.add('hidden');
        } else {
            resultado_hint.textContent = default_hint;
        }
    }

    function validate_grade_input(input) {
        const value = parseFloat(input.value);
        if (Number.isNaN(value)) {
            input.value = '';
            return;
        }
        if (value > NOTA_MAXIMA) {
            input.value = String(NOTA_MAXIMA);
            show_alert(`A nota não pode ser maior que ${NOTA_MAXIMA}.`);
        } else if (value < NOTA_MINIMA) {
            input.value = String(NOTA_MINIMA);
            show_alert(`A nota não pode ser menor que ${NOTA_MINIMA}.`);
        }
    }

    function validate_non_negative_input(input) {
        const value = parseFloat(input.value);
        if (Number.isNaN(value)) {
            input.value = '';
            return;
        }
        if (value < 0) {
            input.value = '0';
            show_alert('O valor não pode ser negativo.');
            return;
        }
        if (input.id === 'cargaHoraria' && value > CARGA_HORARIA_MAXIMA) {
            input.value = String(CARGA_HORARIA_MAXIMA);
            show_alert(`A carga horária não pode passar de ${CARGA_HORARIA_MAXIMA}.`);
        }
        if (input.id === 'faltas') {
            const total = parse_number(carga_horaria.value);
            if (value > total) {
                input.value = String(total);
                show_alert('Faltas não podem ser maiores que a carga horária.');
            }
        }
    }

    function update_absence_limit() {
        const total = parse_number(carga_horaria.value);
        limite_faltas.value = String(Math.floor(total * 0.25));
    }

    function calculate_higher_average(n1, n2) {
        return (2 * n1 + 3 * n2) / 5;
    }

    function calculate_higher_final_needed(average) {
        return (MEDIA_APROVACAO * 2) - average;
    }

    function set_situacao_label(average, has_any_grade) {
        if (!has_any_grade) {
            situacao_atual.innerHTML = '<span class="text-base-content/60">Preencha as notas para simular.</span>';
            return;
        }
        if (average >= MEDIA_APROVACAO) {
            situacao_atual.innerHTML = '<span class="badge badge-success badge-lg">Aprovado</span>';
            return;
        }
        if (average < MEDIA_FINAL) {
            situacao_atual.innerHTML = '<span class="badge badge-error badge-lg">Reprovado por Nota</span>';
            return;
        }
        situacao_atual.innerHTML = '<span class="badge badge-warning badge-lg">Prova Final</span>';
    }

    function render_results() {
        const n1 = parse_number(nota_1.value);
        const n2 = parse_number(nota_2.value);
        const total_classes = parse_number(carga_horaria.value);
        const misses = parse_number(faltas.value);

        const has_any_grade = [nota_1.value, nota_2.value]
            .some((value) => String(value).trim() !== '');

        const average = calculate_higher_average(n1, n2);
        media_parcial.textContent = average.toFixed(1);
        set_situacao_label(average, has_any_grade);

        if (average >= MEDIA_FINAL && average < MEDIA_APROVACAO) {
            necessidade_final.classList.remove('hidden');
            const needed = calculate_higher_final_needed(average);
            possibilidades_finais.innerHTML = `<span>Nota necessária na final: <strong>${Number(needed).toFixed(1)}</strong></span>`;
        } else {
            necessidade_final.classList.add('hidden');
            possibilidades_finais.innerHTML = '';
        }

        const limit = Math.floor(total_classes * 0.25);
        const remaining = limit - misses;
        const freq = total_classes > 0 ? ((total_classes - misses) / total_classes) * 100 : 0;
        pode_faltar.textContent = remaining >= 0 ? `${remaining} aulas` : '0 aulas (limite excedido)';
        frequencia_atual.textContent = `${Math.max(freq, 0).toFixed(1)}%`;

        resultado_hint.classList.add('hidden');
        resultados.classList.remove('hidden');
    }

    async function load_disciplines_from_period() {
        const selected = window.plusuapPeriod || {};
        const query = new URLSearchParams();
        if (selected.ano_letivo && selected.periodo_letivo) {
            query.set('ano_letivo', selected.ano_letivo);
            query.set('periodo_letivo', selected.periodo_letivo);
        }

        const endpoint = `/api/dashboard-data${query.toString() ? `?${query.toString()}` : ''}`;
        const response = await fetch(endpoint, { credentials: 'same-origin' });
        if (!response.ok) throw new Error('Não foi possível carregar disciplinas do período.');

        const data = await response.json();
        disciplinas_data = Array.isArray(data.grades) ? data.grades : [];

        disciplina_select.innerHTML = '<option value="">Selecione uma disciplina para preencher automaticamente</option>';
        disciplinas_data.forEach((grade, index) => {
            const option = document.createElement('option');
            option.value = String(index);
            option.textContent = grade.disciplina || `Disciplina ${index + 1}`;
            disciplina_select.appendChild(option);
        });
    }

    function apply_discipline_data() {
        const selected_index = parseInt(disciplina_select.value, 10);
        if (Number.isNaN(selected_index) || !disciplinas_data[selected_index]) return;

        const grade = disciplinas_data[selected_index];
        nota_1.value = grade.n1_limpa !== '-' ? String(grade.n1_limpa) : '';
        nota_2.value = grade.n2_limpa !== '-' ? String(grade.n2_limpa) : '';
        carga_horaria.value = String(grade.carga_horaria ?? '');
        faltas.value = String(grade.numero_faltas ?? '');
        update_absence_limit();
        show_alert('Dados da disciplina carregados.', 'success');
    }

    [nota_1, nota_2].forEach((input) => input.addEventListener('input', () => validate_grade_input(input)));
    [faltas, carga_horaria].forEach((input) => {
        input.addEventListener('input', () => {
            validate_non_negative_input(input);
            if (input.id === 'cargaHoraria') update_absence_limit();
        });
    });
    disciplina_select.addEventListener('change', apply_discipline_data);
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        render_results();
    });

    window.addEventListener('plusuap:period-changed', async () => {
        set_loading_state(true);
        try {
            await load_disciplines_from_period();
        } catch (_error) {
            disciplina_select.innerHTML = '<option value="">Erro ao carregar disciplinas</option>';
        } finally {
            set_loading_state(false);
        }
    });

    window.addEventListener('DOMContentLoaded', async () => {
        update_absence_limit();
        set_loading_state(true);

        if (window.plusuapPeriodReady && typeof window.plusuapPeriodReady.then === 'function') {
            await window.plusuapPeriodReady;
        }

        try {
            await load_disciplines_from_period();
        } catch (_error) {
            disciplina_select.innerHTML = '<option value="">Erro ao carregar disciplinas</option>';
        } finally {
            set_loading_state(false);
        }
    });
}());
