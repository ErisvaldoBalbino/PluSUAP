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

    function render_status_badge(grade) {
        if (grade.estado_ui === 'BOM') {
            return `<div class="badge badge-info gap-2 text-xs py-3 w-full">${escape_html(grade.alerta || '-')}</div>`;
        }
        if (grade.estado_ui === 'PERIGO') {
            return `<div class="badge badge-warning gap-2 text-xs py-3 w-full font-semibold">${escape_html(grade.alerta || '-')}</div>`;
        }
        if (grade.estado_ui === 'SUCESSO') {
            return '<div class="badge badge-success gap-2 py-3 w-full font-bold text-white">APROVADO</div>';
        }
        if (grade.estado_ui === 'FALHA') {
            return `<div class="badge badge-error gap-2 text-xs py-3 w-full font-bold text-white">${escape_html(grade.alerta || 'REPROVADO')}</div>`;
        }
        return `<div class="badge badge-outline gap-2">${escape_html(grade.situacao || '-')}</div>`;
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
            ? Math.min(Math.max(Math.round(((total_aulas - total_faltas) / total_aulas) * 100), 0), 100)
            : 100;

        footer_ch.textContent = `${total_ch} aulas`;
        footer_aulas.textContent = total_aulas;
        footer_faltas.textContent = total_faltas;
        footer_freq.textContent = `${total_freq}%`;
        grades_footer.classList.remove('hidden');
    }

    function render_grades(grades) {
        if (!grades || grades.length === 0) {
            grades_body.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center py-8 text-base-content/50">Nenhuma disciplina cursada neste período.</td>
                </tr>
            `;
            grades_footer.classList.add('hidden');
            return;
        }

        grades_body.innerHTML = grades.map((grade) => {
            const ch = Number(grade.carga_horaria || 0);
            const aulas = Number(grade.carga_horaria_cumprida || 0);
            const faltas = Number(grade.numero_faltas || 0);

            return `
            <tr>
                <td class="font-medium whitespace-normal min-w-48">${escape_html(grade.disciplina || '-')}</td>
                <td class="text-center">${ch > 0 ? `${ch} aulas` : '-'}</td>
                <td class="text-center">${aulas}</td>
                <td class="text-center">${faltas}</td>
                <td class="text-center">
                    <span class="font-semibold ${grade.freq_perc >= 75 ? 'text-success' : 'text-error'}">${escape_html(grade.freq_perc)}%</span>
                </td>
                <td class="text-center">${escape_html(grade.n1_limpa ?? '-')}</td>
                <td class="text-center">${escape_html(grade.n2_limpa ?? '-')}</td>
                <td class="text-center">${escape_html(grade.media_disciplina ?? '-')}</td>
                <td>${render_status_badge(grade)}</td>
            </tr>
        `;
        }).join('');

        render_footer_totals(grades);
    }

    function render_dashboard(data) {
        summary_total.textContent = data.summary?.total_subjects ?? 0;
        summary_approved.textContent = data.summary?.approved_subjects ?? 0;
        summary_risk.textContent = data.summary?.at_risk_subjects ?? 0;
        student_name.textContent = data.user?.nome_usual || data.user?.nome || 'Aluno';
        student_course.textContent = data.user?.curso || 'Curso não informado';
        render_grades(data.grades);
    }

    function render_loading_state() {
        summary_total.innerHTML = '<span class="skeleton h-10 w-12 inline-block"></span>';
        summary_approved.innerHTML = '<span class="skeleton h-10 w-12 inline-block"></span>';
        summary_risk.innerHTML = '<span class="skeleton h-10 w-12 inline-block"></span>';
        student_name.innerHTML = '<span class="skeleton h-8 w-56 inline-block"></span>';
        student_course.innerHTML = '<span class="skeleton h-4 w-72 inline-block"></span>';

        grades_footer.classList.add('hidden');
        grades_body.innerHTML = Array.from({ length: 6 }).map(() => `
            <tr>
                <td><span class="skeleton h-4 w-52 inline-block"></span></td>
                <td><span class="skeleton h-4 w-12 inline-block"></span></td>
                <td><span class="skeleton h-4 w-8 inline-block"></span></td>
                <td><span class="skeleton h-4 w-8 inline-block"></span></td>
                <td><span class="skeleton h-4 w-14 inline-block"></span></td>
                <td><span class="skeleton h-4 w-8 inline-block"></span></td>
                <td><span class="skeleton h-4 w-8 inline-block"></span></td>
                <td><span class="skeleton h-4 w-10 inline-block"></span></td>
                <td><span class="skeleton h-6 w-full inline-block"></span></td>
            </tr>
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
            <tr>
                <td colspan="9" class="text-center py-8 text-error">${safe_message}</td>
            </tr>
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
