(function () {
    const report_grades_body = document.getElementById('report-grades-body');
    if (!report_grades_body) {
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

    function render_status(grade) {
        const situacao = String(grade.situacao || 'Indefinido');
        if (situacao === 'Aprovado') {
            return '<span class="badge badge-success">Aprovado</span>';
        }
        if (situacao === 'Reprovado') {
            return '<span class="badge badge-error">Reprovado</span>';
        }
        if (situacao === 'Cursando') {
            return '<span class="badge badge-info">Cursando</span>';
        }
        return `<span class="badge badge-outline">${escape_html(situacao)}</span>`;
    }

    function render_table(grades) {
        if (!grades || grades.length === 0) {
            report_grades_body.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-8 text-base-content/50">Nenhuma disciplina encontrada para o período selecionado.</td>
                </tr>
            `;
            return;
        }

        report_grades_body.innerHTML = grades.map((grade) => {
            const faltas = Number(grade.numero_faltas || 0);
            const carga = Number(grade.carga_horaria || 0);
            const total_aulas = carga > 0 ? Math.round(carga) : 0;
            const aulas_presentes = Math.max(total_aulas - faltas, 0);

            return `
                <tr>
                    <td class="font-medium whitespace-normal min-w-56">${escape_html(grade.disciplina || '-')}</td>
                    <td>
                        <div class="flex flex-wrap gap-2 text-xs">
                            <span class="badge badge-outline">N1: ${escape_html(grade.n1_limpa ?? '-')}</span>
                            <span class="badge badge-outline">N2: ${escape_html(grade.n2_limpa ?? '-')}</span>
                            <span class="badge badge-outline">M: ${escape_html(grade.media_disciplina ?? '-')}</span>
                        </div>
                    </td>
                    <td>${escape_html(grade.freq_perc ?? 0)}% (${escape_html(aulas_presentes)}/${escape_html(total_aulas)})</td>
                    <td>${escape_html(carga)}h</td>
                    <td>${render_status(grade)}</td>
                </tr>
            `;
        }).join('');
    }

    function render_error(message) {
        report_grades_body.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-8 text-error">${escape_html(message || 'Erro ao carregar relatório.')}</td>
            </tr>
        `;
    }

    function render_loading_state() {
        report_grades_body.innerHTML = Array.from({ length: 5 }).map(() => `
            <tr>
                <td><span class="skeleton h-4 w-56 inline-block"></span></td>
                <td><span class="skeleton h-4 w-40 inline-block"></span></td>
                <td><span class="skeleton h-4 w-24 inline-block"></span></td>
                <td><span class="skeleton h-4 w-14 inline-block"></span></td>
                <td><span class="skeleton h-6 w-24 inline-block"></span></td>
            </tr>
        `).join('');
    }

    function get_selected_period() {
        const selected = window.plusuapPeriod || {};
        return {
            ano_letivo: selected.ano_letivo || '',
            periodo_letivo: selected.periodo_letivo || '',
        };
    }

    async function load_report_data(ano_letivo = '', periodo_letivo = '') {
        const query = new URLSearchParams();
        if (ano_letivo && periodo_letivo) {
            query.set('ano_letivo', ano_letivo);
            query.set('periodo_letivo', periodo_letivo);
        }
        const endpoint = `/api/report-data${query.toString() ? `?${query.toString()}` : ''}`;

        const response = await fetch(endpoint, { credentials: 'same-origin' });
        if (!response.ok) {
            throw new Error(response.status === 401 ? 'Sua sessão expirou, faça login novamente.' : 'Falha ao carregar relatório.');
        }

        const data = await response.json();
        render_table(data.grades || []);
    }

    window.addEventListener('plusuap:period-changed', async (event) => {
        const selected = event.detail || get_selected_period();
        render_loading_state();
        try {
            await load_report_data(selected.ano_letivo, selected.periodo_letivo);
        } catch (error) {
            render_error(error.message);
        }
    });

    window.addEventListener('DOMContentLoaded', async () => {
        if (window.plusuapPeriodReady && typeof window.plusuapPeriodReady.then === 'function') {
            await window.plusuapPeriodReady;
        }

        const selected = get_selected_period();
        render_loading_state();
        try {
            await load_report_data(selected.ano_letivo, selected.periodo_letivo);
        } catch (error) {
            render_error(error.message);
        }
    });
}());
