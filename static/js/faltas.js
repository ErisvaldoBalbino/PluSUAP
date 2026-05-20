(function () {
    const faltas_loading = document.getElementById('faltas-loading');
    const faltas_empty = document.getElementById('faltas-empty');
    const faltas_content = document.getElementById('faltas-content');
    const faltas_list = document.getElementById('faltas-list');
    const global_dias = document.getElementById('global-dias');

    function escape_html(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function render_horarios(horarios_agrupados) {
        if (!horarios_agrupados || Object.keys(horarios_agrupados).length === 0) {
            return '<span class="text-xs text-base-content/50">Sem horários registrados</span>';
        }

        return Object.entries(horarios_agrupados)
            .map(([dia, qtd]) => `<div class="badge bg-base-content/5 border-base-content/15 text-base-content/80 badge-sm font-semibold">${dia}: ${qtd} aula(s)</div>`)
            .join(' ');
    }

    const order_dias = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

    function render_faltas(data) {
        faltas_loading.classList.add('hidden');

        if (!data || !data.diarios || data.diarios.length === 0) {
            faltas_empty.classList.remove('hidden');
            faltas_content.classList.add('hidden');
            return;
        }

        faltas_empty.classList.add('hidden');
        faltas_content.classList.remove('hidden');

        // Preencher Summary Global
        const global_ch = data.summary.ch_total || 0;
        const global_aulas = data.summary.aulas_cumpridas || 0;
        const global_faltas = data.summary.faltas || 0;
        const global_limite = data.summary.limite_faltas || 0;
        const global_restantes = data.summary.faltas_restantes || 0;
        const global_freq = global_aulas > 0 ? Math.max(0, 100 - ((global_faltas / global_aulas) * 100)) : 100;

        document.getElementById('global-ch').textContent = global_ch;
        document.getElementById('global-limite').textContent = global_limite;
        document.getElementById('global-faltas').textContent = global_faltas;
        document.getElementById('global-restantes').textContent = global_restantes;

        const global_radial = document.getElementById('global-freq-radial');
        const global_val = document.getElementById('global-freq-val');
        const global_badge = document.getElementById('global-freq-badge');
        const remaining_box_icon = document.getElementById('remaining-box-icon');
        const global_restantes_el = document.getElementById('global-restantes');

        if (global_radial && global_val && global_badge) {
            global_radial.style.setProperty('--value', Math.round(global_freq));
            global_val.textContent = `${global_freq.toFixed(1)}%`;

            global_radial.classList.remove('text-success', 'text-error');
            global_badge.className = 'badge mt-2.5 font-extrabold text-[10px] tracking-wide uppercase border';
            if (remaining_box_icon) {
                remaining_box_icon.className = 'p-3 rounded-xl border';
            }
            if (global_restantes_el) {
                global_restantes_el.className = 'text-2xl font-black transition-colors';
            }

            if (global_freq >= 75) {
                global_radial.classList.add('text-success');
                global_badge.classList.add('bg-success/10', 'border-success/20', 'text-success');
                global_badge.textContent = 'Regular';
                if (remaining_box_icon) remaining_box_icon.classList.add('bg-success/10', 'text-success', 'border-success/20');
                if (global_restantes_el) global_restantes_el.classList.add('text-success');
            } else {
                global_radial.classList.add('text-error');
                global_badge.classList.add('bg-error/10', 'border-error/20', 'text-error');
                global_badge.textContent = 'Risco';
                if (remaining_box_icon) remaining_box_icon.classList.add('bg-error/10', 'text-error', 'border-error/20');
                if (global_restantes_el) global_restantes_el.classList.add('text-error');
            }
        }

        // Renderizar dias da semana
        const diasData = data.dias_semana || {};
        const diasOrdenados = Object.keys(diasData).sort((a, b) => {
            let indexA = order_dias.indexOf(a);
            let indexB = order_dias.indexOf(b);
            if (indexA === -1) indexA = 99;
            if (indexB === -1) indexB = 99;
            return indexA - indexB;
        });

        if (diasOrdenados.length === 0) {
            global_dias.innerHTML = '<div class="col-span-full text-center text-base-content/40 text-xs font-bold py-6">Não há aulas cadastradas na semana.</div>';
        } else {
            global_dias.innerHTML = diasOrdenados.map(dia => {
                const info = diasData[dia];
                const pode_faltar = info.pode_faltar_vezes;
                const aulas_no_dia = info.aulas_no_dia;

                let limit_class = 'text-primary';
                let bg_class = 'bg-base-200/20';
                if (pode_faltar <= 0) {
                    limit_class = 'text-error';
                    bg_class = 'bg-error/5 border border-error/10';
                } else if (pode_faltar <= 2) {
                    limit_class = 'text-warning';
                    bg_class = 'bg-warning/5 border border-warning/10';
                }

                return `
                    <div class="rounded-xl p-3 text-center shadow-sm flex flex-col justify-between border border-base-300/20 ${bg_class}">
                        <div>
                            <div class="font-extrabold border-b border-base-300/10 pb-1 mb-2 text-xs text-base-content/85">${dia}</div>
                            <div class="text-[10px] font-semibold text-base-content/50 mb-2">${aulas_no_dia} aula(s)</div>
                        </div>
                        <div>
                            <div class="text-xl font-black ${limit_class} leading-none">${pode_faltar}</div>
                            <div class="text-[9px] uppercase font-bold text-base-content/40 mt-1">vezes</div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Renderizar Lista de Disciplinas
        faltas_list.innerHTML = data.diarios.map((diario) => {
            const freq = diario.aulas_cumpridas > 0 ? Math.max(0, 100 - ((diario.qtd_faltas / diario.aulas_cumpridas) * 100)) : 100;

            let color_class = 'text-success';
            let badge_text = `Pode faltar +${diario.faltas_restantes}`;
            let badge_color = 'bg-success/10 text-success border-success/20';

            if (freq < 75) {
                color_class = 'text-error';
            } else if (diario.faltas_restantes <= 2) {
                color_class = 'text-warning';
            }

            if (diario.faltas_restantes <= 2) {
                badge_text = `Restam ${diario.faltas_restantes} faltas`;
                badge_color = 'bg-warning/10 text-warning border-warning/20';
                if (diario.faltas_restantes <= 0) {
                    badge_color = 'bg-error/10 text-error border-error/20';
                }
            }

            return `
                <div class="card glass-card card-hoverable bg-base-100/25 p-5 border border-base-300/40 flex flex-row items-center justify-between gap-4">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-2 flex-wrap">
                            <span class="badge badge-sm font-bold tracking-wide uppercase bg-primary/10 border-primary/25 text-primary text-[9px] rounded-md px-2 py-0.5">${diario.sigla || 'Sem Sigla'}</span>
                            <span class="badge badge-sm font-extrabold text-[9px] uppercase border px-2 py-0.5 rounded-md ${badge_color}">${badge_text}</span>
                        </div>
                        <h3 class="font-extrabold text-base text-base-content leading-snug mb-3 truncate-two-lines" title="${escape_html(diario.descricao)}">${escape_html(diario.descricao)}</h3>
                        <div class="flex flex-wrap gap-1.5 mb-4">
                            ${render_horarios(diario.horarios_agrupados)}
                        </div>
                        
                        <div class="flex items-center gap-4 text-xs font-semibold text-base-content/50">
                            <span class="flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                                ${diario.ch_total_aula} aulas total
                            </span>
                            <span class="flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                ${diario.qtd_faltas} faltas
                            </span>
                        </div>
                    </div>
                    
                    <!-- Radial Gauge for Subject Attendance -->
                    <div class="flex flex-col items-center justify-center gap-1.5 shrink-0 select-none">
                        <div class="radial-progress ${color_class} transition-all duration-300 font-black text-xs" style="--value: ${freq.toFixed(0)}; --size: 4.5rem; --thickness: 6px;" role="progressbar">
                            ${freq.toFixed(0)}%
                        </div>
                        <div class="text-[9px] uppercase font-bold tracking-wider text-base-content/40 text-center">
                            Frequência
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    async function load_diarios() {
        const selected = window.plusuapPeriod || {};
        const query = new URLSearchParams();
        if (selected.ano_letivo && selected.periodo_letivo) {
            query.set('ano_letivo', selected.ano_letivo);
            query.set('periodo_letivo', selected.periodo_letivo);
        }

        const endpoint = `/api/diarios${query.toString() ? `?${query.toString()}` : ''}`;

        faltas_loading.classList.remove('hidden');
        faltas_empty.classList.add('hidden');
        faltas_content.classList.add('hidden');

        try {
            const response = await fetch(endpoint, { credentials: 'same-origin' });
            if (!response.ok) {
                if (response.status === 401) {
                    window.location.href = '/login';
                    return;
                }
                throw new Error('Erro ao carregar diários');
            }
            const data = await response.json();
            render_faltas(data);
        } catch (error) {
            console.error(error);
            render_faltas({ diarios: [] });

            faltas_empty.querySelector('h3').textContent = 'Erro ao carregar';
            faltas_empty.querySelector('p').textContent = 'Não foi possível buscar as faltas no momento.';
            faltas_empty.classList.remove('hidden');
            faltas_loading.classList.add('hidden');
        }
    }

    window.addEventListener('plusuap:period-changed', () => {
        load_diarios();
    });

    window.addEventListener('DOMContentLoaded', async () => {
        if (window.plusuapPeriodReady && typeof window.plusuapPeriodReady.then === 'function') {
            await window.plusuapPeriodReady;
        }
        load_diarios();
    });
})();
