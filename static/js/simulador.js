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

    const nota1_val = document.getElementById('nota1-val');
    const nota2_val = document.getElementById('nota2-val');
    const faltas_val = document.getElementById('faltas-val');
    const outcome_ring = document.getElementById('outcome-ring');
    const freq_progress = document.getElementById('freq-progress');

    const media_parcial = document.getElementById('mediaParcial');
    const situacao_atual = document.getElementById('situacaoAtual');
    const frequencia_atual = document.getElementById('frequenciaAtual');
    const pode_faltar = document.getElementById('podeFaltar');
    const possibilidades_finais = document.getElementById('possibilidadesFinais');
    const submit_button = form.querySelector('button[type="submit"]');

    let disciplinas_data = [];
    const default_hint = 'Preencha ou selecione uma disciplina e ajuste os controles para ver a previsão.';

    function parse_number(value) {
        const parsed = parseFloat(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function show_alert(message, type = 'warning') {
        const existing = document.querySelector('.simulador-alert');
        if (existing) existing.remove();

        const alert = document.createElement('div');
        alert.className = `alert alert-${type} simulador-alert fixed top-4 right-4 z-[9999] shadow-lg max-w-sm rounded-xl border border-${type}/30 bg-${type}/10 backdrop-blur-md`;
        alert.innerHTML = `<span class="font-bold text-xs">${message}</span>`;
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
            resultado_hint.textContent = 'Buscando matérias do período no SUAP...';
            resultado_hint.classList.remove('hidden');
            resultados.classList.add('hidden');
        } else {
            resultado_hint.textContent = default_hint;
        }
    }

    function sync_range_indicators() {
        if (nota1_val) nota1_val.value = parse_number(nota_1.value).toFixed(0);
        if (nota2_val) nota2_val.value = parse_number(nota_2.value).toFixed(0);
        if (faltas_val) faltas_val.value = parse_number(faltas.value).toString();
    }

    function update_absence_limit() {
        const total = parse_number(carga_horaria.value);
        const maxLimit = Math.floor(total * 0.25);
        limite_faltas.value = String(maxLimit);

        // Save current absences value to prevent the browser from resetting it to the midpoint of the new range
        const currentFaltas = parse_number(faltas.value);

        // Adjust Absences slider boundaries to scale intelligently to double the presence limit or a base range
        const maxRange = total > 0 ? Math.max(maxLimit * 2, 10) : 40;
        faltas.max = String(maxRange);
        if (faltas_val) {
            faltas_val.max = String(maxRange);
        }

        // Restore/clamp the absences value so the browser preserves it
        faltas.value = String(Math.min(currentFaltas, maxRange));
        
        sync_range_indicators();
    }

    function calculate_higher_average(n1, n2) {
        // SUAP academic weight distribution formula: (2 * N1 + 3 * N2) / 5
        return (2 * n1 + 3 * n2) / 5;
    }

    function calculate_higher_final_needed(average) {
        // Passing academic average limit calculation
        return (MEDIA_APROVACAO * 2) - average;
    }

    function update_outcome_gauge(average, freq_perc) {
        if (!outcome_ring) return;

        outcome_ring.style.boxShadow = 'none';
        outcome_ring.className = 'w-12 h-12 rounded-full border-4 flex items-center justify-center font-black text-sm transition-all duration-300 ';

        if (freq_perc < 75) {
            outcome_ring.innerHTML = 'RF';
            outcome_ring.title = 'Reprovado por Faltas';
            outcome_ring.classList.add('bg-error/15', 'border-error', 'text-error');
            outcome_ring.style.boxShadow = '0 0 12px oklch(var(--er) / 0.4)';
            return;
        }

        if (average >= MEDIA_APROVACAO) {
            outcome_ring.innerHTML = 'AP';
            outcome_ring.title = 'Aprovado';
            outcome_ring.classList.add('bg-success/15', 'border-success', 'text-success');
            outcome_ring.style.boxShadow = '0 0 12px oklch(var(--su) / 0.4)';
        } else if (average >= MEDIA_FINAL) {
            outcome_ring.innerHTML = 'PF';
            outcome_ring.title = 'Prova Final';
            outcome_ring.classList.add('bg-warning/15', 'border-warning', 'text-warning');
            outcome_ring.style.boxShadow = '0 0 12px oklch(var(--wa) / 0.4)';
        } else {
            outcome_ring.innerHTML = 'RN';
            outcome_ring.title = 'Reprovado por Nota';
            outcome_ring.classList.add('bg-error/15', 'border-error', 'text-error');
            outcome_ring.style.boxShadow = '0 0 12px oklch(var(--er) / 0.4)';
        }
    }

    function set_situacao_label(average, freq_perc) {
        if (freq_perc < 75) {
            situacao_atual.innerHTML = '<span class="badge bg-error/15 border border-error/30 text-error font-extrabold px-3 py-1 text-xs">Reprovado por Faltas</span>';
            return;
        }
        if (average >= MEDIA_APROVACAO) {
            situacao_atual.innerHTML = '<span class="badge bg-success/15 border border-success/30 text-success font-extrabold px-3 py-1 text-xs">Aprovado Direto</span>';
            return;
        }
        if (average < MEDIA_FINAL) {
            situacao_atual.innerHTML = '<span class="badge bg-error/15 border border-error/30 text-error font-extrabold px-3 py-1 text-xs">Reprovado por Média</span>';
            return;
        }
        situacao_atual.innerHTML = '<span class="badge bg-warning/15 border border-warning/30 text-warning font-extrabold px-3 py-1 text-xs">Apto para Prova Final</span>';
    }

    function render_results() {
        const n1 = parse_number(nota_1.value);
        const n2 = parse_number(nota_2.value);
        const total_classes = parse_number(carga_horaria.value);
        const misses = parse_number(faltas.value);

        const average = calculate_higher_average(n1, n2);
        media_parcial.textContent = average.toFixed(1);

        const limit = Math.floor(total_classes * 0.25);
        const remaining = limit - misses;
        const freq = total_classes > 0 ? ((total_classes - misses) / total_classes) * 100 : 100;
        const safe_freq = Math.max(freq, 0);

        set_situacao_label(average, safe_freq);
        update_outcome_gauge(average, safe_freq);

        if (safe_freq >= 75 && average >= MEDIA_FINAL && average < MEDIA_APROVACAO) {
            necessidade_final.classList.remove('hidden');
            const needed = calculate_higher_final_needed(average);
            possibilidades_finais.innerHTML = `Nota mínima necessária na prova final: <strong class="text-sm font-black underline decoration-2">${Number(needed).toFixed(1)}</strong>`;
        } else {
            necessidade_final.classList.add('hidden');
            possibilidades_finais.innerHTML = '';
        }

        pode_faltar.textContent = remaining >= 0 ? `${remaining} aula(s)` : 'Limite excedido';
        pode_faltar.className = remaining >= 0 ? 'font-extrabold text-xl text-base-content' : 'font-extrabold text-lg text-error';

        frequencia_atual.textContent = `${safe_freq.toFixed(1)}%`;
        frequencia_atual.className = safe_freq >= 75 ? 'font-extrabold text-xl text-success' : 'font-extrabold text-xl text-error';

        if (freq_progress) {
            freq_progress.value = safe_freq;
            freq_progress.className = `progress ${safe_freq >= 75 ? 'progress-success' : 'progress-error'} w-full h-1 mt-3`;
        }

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

    function clean_grade_for_slider(val) {
        if (val === '-' || val === undefined || val === null || val === '') return 0;
        const num = parseFloat(String(val).replace(',', '.'));
        return isNaN(num) ? 0 : Math.round(num);
    }

    function apply_discipline_data() {
        const selected_index = parseInt(disciplina_select.value, 10);
        if (Number.isNaN(selected_index) || !disciplinas_data[selected_index]) {
            // Reset to defaults
            nota_1.value = '0';
            nota_2.value = '0';
            faltas.value = '0';
            sync_range_indicators();
            render_results();
            return;
        }

        const grade = disciplinas_data[selected_index];
        
        nota_1.value = String(clean_grade_for_slider(grade.n1_limpa));
        nota_2.value = String(clean_grade_for_slider(grade.n2_limpa));
        carga_horaria.value = String(grade.carga_horaria_cumprida ?? grade.carga_horaria ?? '80');
        
        update_absence_limit();
        
        faltas.value = String(grade.numero_faltas ?? '0');
        
        sync_range_indicators();
        render_results();
        
    }

    // Real-time calculation triggers on range slide and text input change
    [nota_1, nota_2, faltas].forEach((slider, index) => {
        slider.addEventListener('input', () => {
            sync_range_indicators();
            render_results();
        });
    });

    // Bidirectional sync for number inputs
    [nota1_val, nota2_val, faltas_val].forEach((numInput, index) => {
        if (!numInput) return;
        const slider = [nota_1, nota_2, faltas][index];

        numInput.addEventListener('input', () => {
            let val = parse_number(numInput.value);
            const min = parse_number(slider.min || 0);
            const max = parse_number(slider.max || 100);

            // Temporarily clamp while typing to ensure bounds
            if (val > max) val = max;
            if (val < min) val = min;

            slider.value = String(val);
            render_results();
        });

        numInput.addEventListener('blur', () => {
            let val = parse_number(numInput.value);
            const min = parse_number(slider.min || 0);
            const max = parse_number(slider.max || 100);

            if (val > max) val = max;
            if (val < min) val = min;

            numInput.value = String(val);
            slider.value = String(val);
            render_results();
        });
    });

    carga_horaria.addEventListener('input', () => {
        const total = parse_number(carga_horaria.value);
        if (total > CARGA_HORARIA_MAXIMA) {
            carga_horaria.value = String(CARGA_HORARIA_MAXIMA);
            show_alert(`Carga horária limitada a ${CARGA_HORARIA_MAXIMA}h.`, 'warning');
        }
        update_absence_limit();
        
        // Correct absences if they exceed the new bounds
        if (parse_number(faltas.value) > total) {
            faltas.value = String(total);
        }
        
        sync_range_indicators();
        render_results();
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
            apply_discipline_data(); // recalculate with reset values
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
            render_results();
        }
    });
}());
