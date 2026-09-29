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

    const order_dias = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

    function horarios_text(horarios_agrupados) {
        const entries = Object.entries(horarios_agrupados || {});
        if (entries.length === 0) return '';
        return entries.map(([dia, qtd]) => `${dia.slice(0, 3)} ${qtd}`).join(' · ');
    }

    function tone_of(diario, freq) {
        if (freq < 75 || diario.faltas_restantes <= 0) return 'bad';
        if (diario.faltas_restantes <= 2) return 'warn';
        return 'ok';
    }

    const TONE_TEXT = { ok: 'text-success', warn: 'text-warning', bad: 'text-error' };
    const TONE_PROGRESS = { ok: 'progress-success', warn: 'progress-warning', bad: 'progress-error' };

    function render_faltas(data) {
        faltas_loading.classList.add('hidden');

        if (!data || !data.diarios || data.diarios.length === 0) {
            faltas_empty.classList.remove('hidden');
            faltas_content.classList.add('hidden');
            return;
        }

        faltas_empty.classList.add('hidden');
        faltas_content.classList.remove('hidden');

        // Summary strip
        const summary = data.summary || {};
        const global_aulas = summary.aulas_cumpridas || 0;
        const global_faltas = summary.faltas || 0;
        const global_restantes = summary.faltas_restantes || 0;
        const global_freq = global_aulas > 0 ? Math.max(0, 100 - ((global_faltas / global_aulas) * 100)) : 100;
        const regular = global_freq >= 75;

        document.getElementById('global-ch').textContent = summary.ch_total || 0;
        document.getElementById('global-limite').textContent = summary.limite_faltas || 0;
        document.getElementById('global-faltas').textContent = global_faltas;

        const restantes_el = document.getElementById('global-restantes');
        restantes_el.textContent = global_restantes;
        restantes_el.className = `v ${global_restantes <= 0 ? 'text-error' : 'text-success'}`;

        const freq_el = document.getElementById('global-freq-val');
        freq_el.textContent = `${global_freq.toFixed(1)}%`;
        freq_el.className = regular ? 'text-success' : 'text-error';

        const badge = document.getElementById('global-freq-badge');
        badge.textContent = regular ? 'Regular' : 'Risco';
        badge.className = `badge badge-sm ml-1 ${regular ? 'bg-success/15 text-success' : 'bg-error/12 text-error'}`;

        // Weekday tolerance
        const dias_data = data.dias_semana || {};
        const dias = Object.keys(dias_data).sort((x, y) => {
            const ix = order_dias.indexOf(x);
            const iy = order_dias.indexOf(y);
            return (ix === -1 ? 99 : ix) - (iy === -1 ? 99 : iy);
        });

        global_dias.innerHTML = dias.length === 0
            ? '<p class="text-xs font-semibold text-base-content/40 py-4">Não há aulas cadastradas na semana.</p>'
            : dias.map((dia) => {
                const info = dias_data[dia];
                const pode = info.pode_faltar_vezes;
                const tone = pode <= 0 ? 'text-error' : (pode <= 2 ? 'text-warning' : 'text-success');
                return `
                    <div class="day-row">
                        <div>
                            <div class="text-sm font-bold">${escape_html(dia)}</div>
                            <div class="text-[11px] font-semibold text-base-content/45">${info.aulas_no_dia} aula(s)</div>
                        </div>
                        <div class="text-right">
                            <span class="font-display text-2xl font-extrabold ${tone}">${pode}</span>
                            <span class="text-[11px] font-semibold text-base-content/45"> ${pode === 1 ? 'vez' : 'vezes'}</span>
                        </div>
                    </div>
                `;
            }).join('');

        // Subjects, closest to the limit first
        const diarios = [...data.diarios].sort((x, y) => x.faltas_restantes - y.faltas_restantes);

        faltas_list.innerHTML = diarios.map((diario) => {
            const freq = diario.aulas_cumpridas > 0 ? Math.max(0, 100 - ((diario.qtd_faltas / diario.aulas_cumpridas) * 100)) : 100;
            const tone = tone_of(diario, freq);
            const limite = diario.qtd_faltas + Math.max(diario.faltas_restantes, 0);
            const used = limite > 0 ? Math.min(100, (diario.qtd_faltas / limite) * 100) : 100;
            const meta = [diario.sigla, horarios_text(diario.horarios_agrupados)].filter(Boolean).join(' · ');

            return `
                <div class="falta-row" data-tone="${tone}">
                    <div class="subject-main">
                        <h3 class="subject-name" title="${escape_html(diario.descricao)}">${escape_html(diario.descricao)}</h3>
                        ${meta ? `<div class="subject-meta">${escape_html(meta)}</div>` : ''}
                    </div>
                    <div class="cell">
                        <span class="cell-label">Pode faltar</span>
                        <span class="cell-media ${TONE_TEXT[tone]}">${Math.max(diario.faltas_restantes, 0)}</span>
                    </div>
                    <div class="cell cell-freq">
                        <span class="cell-label">Faltas / limite</span>
                        <span class="pct">${diario.qtd_faltas}<span class="text-base-content/40 font-semibold"> / ${limite}</span></span>
                        <progress class="progress ${TONE_PROGRESS[tone]} mt-1" style="height:.3rem" value="${used}" max="100"></progress>
                    </div>
                    <div class="cell">
                        <span class="cell-label">Freq.</span>
                        <span class="cell-n ${freq >= 75 ? 'text-success' : 'text-error'}">${freq.toFixed(0)}%</span>
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
