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
            .map(([dia, qtd]) => `<div class="badge badge-neutral badge-outline badge-sm">${dia}: ${qtd} aula(s)</div>`)
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
        document.getElementById('global-ch').textContent = data.summary.ch_total || 0;
        document.getElementById('global-limite').textContent = data.summary.limite_faltas || 0;
        document.getElementById('global-faltas').textContent = data.summary.faltas || 0;
        document.getElementById('global-restantes').textContent = data.summary.faltas_restantes || 0;

        // Renderizar dias da semana
        const diasData = data.dias_semana || {};
        const diasOrdenados = Object.keys(diasData).sort((a, b) => {
            let indexA = order_dias.indexOf(a);
            let indexB = order_dias.indexOf(b);
            // If day is not in the array, put it at the end
            if (indexA === -1) indexA = 99;
            if (indexB === -1) indexB = 99;
            return indexA - indexB;
        });

        if (diasOrdenados.length === 0) {
            global_dias.innerHTML = '<div class="col-span-full text-center text-primary-content/80 text-sm py-2">Não há aulas cadastradas na semana.</div>';
        } else {
            global_dias.innerHTML = diasOrdenados.map(dia => {
                const info = diasData[dia];
                const pode_faltar = info.pode_faltar_vezes;
                const aulas_no_dia = info.aulas_no_dia;
                
                return `
                    <div class="bg-base-100 text-base-content rounded-lg p-3 text-center shadow-sm flex flex-col justify-between">
                        <div>
                            <div class="font-bold border-b border-base-200 pb-1 mb-2 text-sm">${dia}</div>
                            <div class="text-xs text-base-content/60 mb-2">${aulas_no_dia} aulas neste dia</div>
                        </div>
                        <div>
                            <div class="text-2xl font-bold text-primary leading-none">${pode_faltar}</div>
                            <div class="text-[10px] uppercase font-bold text-base-content/50 mt-1">vezes</div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Renderizar Lista de Disciplinas
        faltas_list.innerHTML = data.diarios.map((diario) => {
            return `
                <div class="card bg-base-100 shadow-md border border-base-200">
                    <div class="card-body p-5">
                        <div class="flex justify-between items-start gap-2 mb-2">
                            <h2 class="card-title text-base leading-tight">${escape_html(diario.descricao)}</h2>
                            <span class="badge whitespace-nowrap text-xs">${diario.sigla || 'Sem Sigla'}</span>
                        </div>
                        
                        <div class="mb-4 flex flex-wrap gap-1">
                            ${render_horarios(diario.horarios_agrupados)}
                        </div>

                        <div class="grid grid-cols-2 gap-4 text-sm mt-auto">
                            <div class="bg-base-200 rounded-lg p-3 text-center">
                                <div class="text-base-content/60 text-xs uppercase font-bold mb-1">Carga Horária</div>
                                <div class="text-lg font-bold">${diario.ch_total_aula}</div>
                            </div>
                            <div class="bg-base-200 rounded-lg p-3 text-center">
                                <div class="text-base-content/60 text-xs uppercase font-bold mb-1">Faltas Computadas</div>
                                <div class="text-lg font-bold">${diario.qtd_faltas}</div>
                            </div>
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
