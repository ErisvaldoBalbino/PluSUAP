(function () {
    const grades_body = document.getElementById('grades-body');
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

    function render_grades(grades) {
        if (!grades || grades.length === 0) {
            grades_body.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-8 text-base-content/50">Nenhuma disciplina cursada neste período.</td>
                </tr>
            `;
            return;
        }

        grades_body.innerHTML = grades.map((grade) => `
            <tr>
                <td class="font-medium whitespace-normal min-w-48">${escape_html(grade.disciplina || '-')}</td>
                <td>${escape_html(grade.n1_limpa ?? '-')}</td>
                <td>${escape_html(grade.n2_limpa ?? '-')}</td>
                <td>${escape_html(grade.media_disciplina ?? '-')}</td>
                <td>
                    <div class="flex items-center gap-2">
                        <progress class="progress ${grade.freq_perc >= 75 ? 'progress-success' : 'progress-error'} w-12 xl:w-20" value="${grade.freq_perc}" max="100"></progress>
                        <span class="text-xs font-semibold">${escape_html(grade.freq_perc)}%</span>
                    </div>
                </td>
                <td>${render_status_badge(grade)}</td>
            </tr>
        `).join('');
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

        grades_body.innerHTML = Array.from({ length: 6 }).map(() => `
            <tr>
                <td><span class="skeleton h-4 w-52 inline-block"></span></td>
                <td><span class="skeleton h-4 w-8 inline-block"></span></td>
                <td><span class="skeleton h-4 w-8 inline-block"></span></td>
                <td><span class="skeleton h-4 w-10 inline-block"></span></td>
                <td><span class="skeleton h-4 w-20 inline-block"></span></td>
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
        grades_body.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-8 text-error">${safe_message}</td>
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
