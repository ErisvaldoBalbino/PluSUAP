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
            return `<div class="badge h-auto bg-info/10 border border-info/30 text-info font-bold uppercase tracking-wider text-[10px] py-1.5 px-3 leading-tight whitespace-normal text-center max-w-[180px]">${escape_html(grade.alerta || '-')}</div>`;
        }
        if (grade.estado_ui === 'PERIGO') {
            return `<div class="badge h-auto bg-warning/10 border border-warning/30 text-warning font-bold uppercase tracking-wider text-[10px] py-1.5 px-3 leading-tight whitespace-normal text-center max-w-[180px] animate-pulse">${escape_html(grade.alerta || '-')}</div>`;
        }
        if (grade.estado_ui === 'SUCESSO') {
            return '<div class="badge h-auto bg-success/15 border border-success/30 text-success font-extrabold uppercase tracking-wider text-[10px] py-1.5 px-3 leading-tight whitespace-normal text-center">APROVADO</div>';
        }
        if (grade.estado_ui === 'FALHA') {
            return `<div class="badge h-auto bg-error/10 border border-error/30 text-error font-extrabold uppercase tracking-wider text-[10px] py-1.5 px-3 leading-tight whitespace-normal text-center max-w-[180px]">${escape_html(grade.alerta || 'REPROVADO')}</div>`;
        }
        return `<div class="badge badge-outline h-auto border-base-300 text-base-content/65 font-bold uppercase tracking-wider text-[10px] py-1.5 px-3 leading-tight whitespace-normal text-center max-w-[180px]">${escape_html(grade.situacao || '-')}</div>`;
    }

    function render_grade_cell(value) {
        if (value === undefined || value === null || String(value).trim() === '-' || String(value).trim() === '') {
            return '<span class="text-base-content/25 font-bold">-</span>';
        }
        const cleanVal = String(value).replace(',', '.');
        const num = parseFloat(cleanVal);
        if (isNaN(num)) {
            return `<span class="inline-block px-2.5 py-0.5 rounded-lg text-xs font-bold border bg-base-200/50 border-base-300 text-base-content/75">${escape_html(value)}</span>`;
        }
        let classes = '';
        if (num >= 70) {
            classes = 'bg-success/10 border border-success/30 text-success';
        } else if (num >= 40) {
            classes = 'bg-warning/10 border border-warning/30 text-warning';
        } else {
            classes = 'bg-error/10 border border-error/30 text-error';
        }
        return `<span class="inline-block px-2.5 py-0.5 rounded-lg text-xs font-extrabold border ${classes}">${num.toFixed(1)}</span>`;
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
        footer_freq.innerHTML = `
            <div class="flex flex-col gap-1 items-center justify-center">
                <span class="font-extrabold ${total_freq >= 75 ? 'text-success' : 'text-error'}">${total_freq.toFixed(1)}%</span>
                <progress class="progress ${total_freq >= 75 ? 'progress-success' : 'progress-error'} w-16 h-1" value="${total_freq}" max="100"></progress>
            </div>
        `;
        grades_footer.classList.remove('hidden');
    }

    function render_grades(grades) {
        if (!grades || grades.length === 0) {
            grades_body.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center py-12 text-base-content/40 font-medium">Nenhuma disciplina cursada neste período.</td>
                </tr>
            `;
            grades_footer.classList.add('hidden');
            return;
        }

        grades_body.innerHTML = grades.map((grade) => {
            const ch = Number(grade.carga_horaria || 0);
            const aulas = Number(grade.carga_horaria_cumprida || 0);
            const faltas = Number(grade.numero_faltas || 0);
            const freq = Number(grade.freq_perc || 100);

            return `
            <tr class="hover:bg-base-200/50 transition duration-150">
                <td class="font-bold text-sm whitespace-normal min-w-[200px] pl-6 text-base-content">${escape_html(grade.disciplina || '-')}</td>
                <td class="text-center font-semibold text-xs text-base-content/75">${ch > 0 ? `${ch}h` : '-'}</td>
                <td class="text-center font-semibold text-xs text-base-content/75">${aulas}</td>
                <td class="text-center font-bold text-xs ${faltas > 0 ? 'text-warning' : 'text-base-content/40'}">${faltas}</td>
                <td class="text-center">
                    <div class="flex flex-col gap-1 items-center justify-center">
                        <span class="text-xs font-black ${freq >= 75 ? 'text-success' : 'text-error'}">${freq}%</span>
                        <progress class="progress ${freq >= 75 ? 'progress-success' : 'progress-error'} w-14 h-1.5" value="${freq}" max="100"></progress>
                    </div>
                </td>
                <td class="text-center">${render_grade_cell(grade.n1_limpa)}</td>
                <td class="text-center">${render_grade_cell(grade.n2_limpa)}</td>
                <td class="text-center">${render_grade_cell(grade.media_disciplina)}</td>
                <td class="pr-6">${render_status_badge(grade)}</td>
            </tr>
        `;
        }).join('');

        render_footer_totals(grades);
    }

    function render_dashboard(data) {
        summary_total.textContent = data.summary?.total_subjects ?? 0;
        summary_approved.textContent = data.summary?.approved_subjects ?? 0;
        summary_risk.textContent = data.summary?.at_risk_subjects ?? 0;
        student_name.textContent = data.user?.nome_registro || data.user?.nome_social || 'Aluno';
        student_course.textContent = data.user?.curso || 'Curso não informado';
        render_grades(data.grades);
    }

    function render_loading_state() {
        summary_total.innerHTML = '<span class="skeleton h-8 w-8 inline-block rounded"></span>';
        summary_approved.innerHTML = '<span class="skeleton h-8 w-8 inline-block rounded"></span>';
        summary_risk.innerHTML = '<span class="skeleton h-8 w-8 inline-block rounded"></span>';
        student_name.innerHTML = '<span class="skeleton h-8 w-56 inline-block rounded"></span>';
        student_course.innerHTML = '<span class="skeleton h-4 w-72 inline-block rounded"></span>';

        grades_footer.classList.add('hidden');
        grades_body.innerHTML = Array.from({ length: 6 }).map(() => `
            <tr>
                <td class="pl-6"><span class="skeleton h-4 w-52 inline-block rounded"></span></td>
                <td><span class="skeleton h-4 w-12 inline-block rounded"></span></td>
                <td><span class="skeleton h-4 w-8 inline-block rounded"></span></td>
                <td><span class="skeleton h-4 w-8 inline-block rounded"></span></td>
                <td><span class="skeleton h-4 w-14 inline-block rounded"></span></td>
                <td><span class="skeleton h-4 w-8 inline-block rounded"></span></td>
                <td><span class="skeleton h-4 w-8 inline-block rounded"></span></td>
                <td><span class="skeleton h-4 w-10 inline-block rounded"></span></td>
                <td class="pr-6"><span class="skeleton h-6 w-20 inline-block rounded"></span></td>
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
                <td colspan="9" class="text-center py-12 text-error font-bold">${safe_message}</td>
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
