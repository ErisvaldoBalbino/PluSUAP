(function () {
    const grades_body = document.getElementById('grades-body');
    const grades_footer = document.getElementById('grades-footer');
    const footer_ch = document.getElementById('footer-ch');
    const footer_aulas = document.getElementById('footer-aulas');
    const footer_faltas = document.getElementById('footer-faltas');
    const footer_freq = document.getElementById('footer-freq');
    const summary_total = document.getElementById('summary-total');
    const summary_approved = document.getElementById('summary-approved');
    const summary_risk = document.getElementById('summary-risk');
    const student_name = document.getElementById('student-name');
    const student_course = document.getElementById('student-course');

    if (!grades_body) {
        return;
    }

    function escape_html(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function state_of(grade) {
        return ['SUCESSO', 'FALHA', 'PERIGO', 'BOM'].includes(grade.estado_ui) ? grade.estado_ui : 'NEUTRO';
    }

    function render_status_badge(grade) {
        const state = state_of(grade);
        const label = {
            SUCESSO: 'Aprovado',
            FALHA: grade.situacao || 'Reprovado',
            PERIGO: 'Atenção',
            BOM: 'No caminho',
        }[state] || grade.situacao || '-';
        const tone = {
            SUCESSO: 'bg-success/15 text-success',
            FALHA: 'bg-error/12 text-error',
            PERIGO: 'bg-warning/15 text-warning',
            BOM: 'bg-info/12 text-info',
        }[state] || 'bg-base-content/8 text-base-content/60';
        return `<span class="badge shrink-0 uppercase tracking-wider text-[10px] font-extrabold ${tone}">${escape_html(label)}</span>`;
    }

    function score_tone(value) {
        const num = parseFloat(String(value).replace(',', '.'));
        if (isNaN(num)) return 'text-base-content/30';
        if (num >= 70) return 'text-success';
        if (num >= 40) return 'text-warning';
        return 'text-error';
    }

    // "TEC.0080 - Paradigmas de Linguagens" -> { code: "TEC.0080", title: "Paradigmas de Linguagens" }
    function split_code(name) {
        const text = String(name || '-').trim();
        const match = text.match(/^([A-Z]{2,}[A-Z0-9.]*\d[A-Z0-9.]*)\s*-\s*(.+)$/);
        return match ? { code: match[1], title: match[2] } : { code: '', title: text };
    }

    function first_name(full) {
        const first = String(full || '').trim().split(/\s+/)[0] || 'Aluno';
        return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
    }

    function format_score(value) {
        if (value === undefined || value === null || String(value).trim() === '' || String(value).trim() === '-') return '–';
        const num = parseFloat(String(value).replace(',', '.'));
        return isNaN(num) ? escape_html(value) : num.toFixed(1);
    }

    function render_footer_totals(grades) {
        if (!grades || grades.length === 0) {
            grades_footer.classList.add('hidden');
            return;
        }

        let total_ch = 0;
        let total_aulas = 0;
        let total_faltas = 0;

        grades.forEach((grade) => {
            total_ch += Number(grade.carga_horaria || 0);
            total_aulas += Number(grade.carga_horaria_cumprida || 0);
            total_faltas += Number(grade.numero_faltas || 0);
        });

        const total_freq = total_aulas > 0
            ? Math.min(Math.max(((total_aulas - total_faltas) / total_aulas) * 100, 0), 100)
            : 100;

        footer_ch.textContent = `${total_ch}h`;
        footer_aulas.textContent = total_aulas;
        footer_faltas.textContent = total_faltas;
        footer_freq.innerHTML = `<span class="${total_freq >= 75 ? 'text-success' : 'text-error'}">${total_freq.toFixed(1)}%</span>`;
        grades_footer.classList.remove('hidden');
    }

    function render_grades(grades) {
        if (!grades || grades.length === 0) {
            grades_body.innerHTML = `
                <div class="col-span-full card p-10 text-center text-base-content/45 font-semibold">
                    Nenhuma disciplina cursada neste período.
                </div>
            `;
            grades_footer.classList.add('hidden');
            return;
        }

        grades_body.innerHTML = grades.map((grade) => {
            const ch = Number(grade.carga_horaria || 0);
            const aulas = Number(grade.carga_horaria_cumprida || 0);
            const faltas = Number(grade.numero_faltas || 0);
            const freq = Number(grade.freq_perc || 100);
            const state = state_of(grade);
            const show_hint = grade.alerta && (state === 'PERIGO' || state === 'BOM' || state === 'FALHA');
            const { code, title } = split_code(grade.disciplina);
            const meta = [
                code,
                `${faltas} ${faltas === 1 ? 'falta' : 'faltas'}`,
                ch > 0 ? `${aulas}/${ch}h` : '',
            ].filter(Boolean).join(' · ');

            return `
            <div class="subject-row" data-state="${state}">
                <div class="subject-main">
                    <div class="flex items-center gap-2 flex-wrap">
                        <h3 class="subject-name">${escape_html(title)}</h3>
                        ${state === 'NEUTRO' ? '' : render_status_badge(grade)}
                    </div>
                    <div class="subject-meta">${escape_html(meta)}</div>
                    ${show_hint ? `<div class="subject-hint">${escape_html(grade.alerta)}</div>` : ''}
                </div>
                <div class="cell">
                    <span class="cell-label">Média</span>
                    <span class="cell-media ${score_tone(grade.media_disciplina)}">${format_score(grade.media_disciplina)}</span>
                </div>
                <div class="cell">
                    <span class="cell-label">N1</span>
                    <span class="cell-n ${score_tone(grade.n1_limpa)}">${format_score(grade.n1_limpa)}</span>
                </div>
                <div class="cell">
                    <span class="cell-label">N2</span>
                    <span class="cell-n ${score_tone(grade.n2_limpa)}">${format_score(grade.n2_limpa)}</span>
                </div>
                <div class="cell cell-freq">
                    <span class="cell-label">Frequência</span>
                    <span class="pct ${freq >= 75 ? 'text-success' : 'text-error'}">${freq}%</span>
                    <progress class="progress ${freq >= 75 ? 'progress-success' : 'progress-error'} mt-1" style="height:.3rem" value="${freq}" max="100"></progress>
                </div>
            </div>
        `;
        }).join('');

        render_footer_totals(grades);
    }

    function render_dashboard(data) {
        summary_total.textContent = data.summary?.total_subjects ?? 0;
        summary_approved.textContent = data.summary?.approved_subjects ?? 0;
        summary_risk.textContent = data.summary?.at_risk_subjects ?? 0;
        const full_name = data.user?.nome_registro || data.user?.nome_social || '';
        student_name.textContent = first_name(data.user?.nome_social || full_name);
        student_name.title = full_name;
        student_course.textContent = data.user?.curso || 'Curso não informado';
        student_course.title = data.user?.curso || '';
        render_grades(data.grades);
    }

    function render_loading_state() {
        summary_total.innerHTML = '<span class="skeleton h-8 w-8 inline-block rounded"></span>';
        summary_approved.innerHTML = '<span class="skeleton h-8 w-8 inline-block rounded"></span>';
        summary_risk.innerHTML = '<span class="skeleton h-8 w-8 inline-block rounded"></span>';
        student_name.innerHTML = '<span class="skeleton h-8 w-56 inline-block rounded"></span>';
        student_course.innerHTML = '<span class="skeleton h-4 w-72 inline-block rounded"></span>';

        grades_footer.classList.add('hidden');
        grades_body.innerHTML = Array.from({ length: 4 }).map(() => `
            <div class="subject-row" data-state="NEUTRO">
                <div class="subject-main"><span class="skeleton h-5 w-2/3"></span></div>
                <div class="cell"><span class="skeleton h-6 w-10"></span></div>
                <div class="cell"><span class="skeleton h-4 w-8"></span></div>
                <div class="cell"><span class="skeleton h-4 w-8"></span></div>
                <div class="cell"><span class="skeleton h-4 w-full"></span></div>
            </div>
        `).join('');
    }

    function render_error(message) {
        const safe_message = escape_html(message || 'Erro inesperado.');
        summary_total.textContent = '-';
        summary_approved.textContent = '-';
        summary_risk.textContent = '-';
        student_name.textContent = 'Erro ao carregar';
        student_course.textContent = message || 'Erro inesperado.';
        grades_footer.classList.add('hidden');
        grades_body.innerHTML = `
            <div class="col-span-full card p-10 text-center text-error font-bold">${safe_message}</div>
        `;
    }

    async function load_dashboard_data(ano_letivo = '', periodo_letivo = '') {
        const query = new URLSearchParams();
        if (ano_letivo && periodo_letivo) {
            query.set('ano_letivo', ano_letivo);
            query.set('periodo_letivo', periodo_letivo);
        }

        const endpoint = `/api/dashboard-data${query.toString() ? `?${query.toString()}` : ''}`;
        const response = await fetch(endpoint, { credentials: 'same-origin' });
        if (!response.ok) {
            throw new Error(response.status === 401 ? 'Sua sessão expirou, faça login novamente.' : 'Falha ao buscar dados da dashboard.');
        }

        const data = await response.json();
        render_dashboard(data);
    }

    function get_selected_period() {
        const selected = window.plusuapPeriod || {};
        return {
            ano_letivo: selected.ano_letivo || '',
            periodo_letivo: selected.periodo_letivo || '',
        };
    }

    window.addEventListener('plusuap:period-changed', async (event) => {
        const selected = event.detail || get_selected_period();
        render_loading_state();
        try {
            await load_dashboard_data(selected.ano_letivo, selected.periodo_letivo);
        } catch (error) {
            render_error(error.message || 'Erro ao atualizar período.');
        }
    });

    window.addEventListener('DOMContentLoaded', async () => {
        if (window.plusuapPeriodReady && typeof window.plusuapPeriodReady.then === 'function') {
            await window.plusuapPeriodReady;
        }
        const selected = get_selected_period();
        render_loading_state();
        try {
            await load_dashboard_data(selected.ano_letivo, selected.periodo_letivo);
        } catch (error) {
            render_error(error.message || 'Erro inesperado ao carregar os dados.');
        }
    });
}());
