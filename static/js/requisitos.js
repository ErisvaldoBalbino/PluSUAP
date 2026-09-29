(function () {
    const progress_radial = document.getElementById('progress-radial');
    const progress_percent = document.getElementById('progress-percent');
    const progress_totals = document.getElementById('progress-totals');
    const progress_bar = document.getElementById('progress-bar');
    const grid = document.getElementById('requisitos-grid');

    if (!grid) return;

    const LABELS = {
        regulares_obrigatorios: 'Obrigatórias',
        regulares_optativos: 'Optativas',
        eletivos: 'Eletivas',
        seminarios: 'Seminários',
        pratica_profissional: 'Prática Profissional',
        pratica_profissional_estagio: 'Estágio',
        extensao_componentes: 'Extensão (Componentes)',
        extensao_outras_atividades: 'Extensão (Outras Atividades)',
        extensao_outros_componentes: 'Extensão (Outros Componentes)',
        atividades_aprofundamento: 'Atividades de Aprofundamento',
        atividades_complementares: 'Atividades Complementares',
        tcc: 'TCC',
        pratica_componente: 'Prática como Componente',
        visita_tecnica: 'Visita Técnica',
    };

    function escape_html(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function render(data) {
        const pct = Math.round(data.percentual_cumprida || 0);
        const totais = data.totais || {};

        progress_percent.textContent = `${pct}%`;
        
        const cumprida_el = document.getElementById('progress-cumprida');
        const esperada_el = document.getElementById('progress-esperada');
        const percentage_label = document.getElementById('progress-bar-percentage-label');
        
        if (cumprida_el) cumprida_el.textContent = `${totais.ch_cumprida || 0}h`;
        if (esperada_el) esperada_el.textContent = `${totais.ch_esperada || 0}h`;
        if (percentage_label) percentage_label.textContent = `${pct}% Concluído`;

        // Animate progress indicators with a micro delay
        setTimeout(() => {
            if (progress_radial) {
                progress_radial.style.setProperty('--value', pct);
            }
            const fill = document.getElementById('progress-bar-fill');
            if (fill) {
                fill.style.width = `${pct}%`;
            }
        }, 80);

        const items = Object.entries(LABELS)
            .filter(([key]) => data[key] && data[key].ch_esperada > 0)
            .map(([key, label]) => {
                const cat = data[key];
                const cat_pct = cat.ch_esperada > 0
                    ? Math.round((cat.ch_cumprida / cat.ch_esperada) * 100)
                    : 0;
                const done = cat.ch_pendente === 0;
                return { label, ...cat, pct: cat_pct, done };
            });

        if (items.length === 0) {
            grid.innerHTML = '<div class="p-10 text-center text-base-content/50 font-semibold">Nenhum requisito encontrado para o curso.</div>';
            return;
        }

        // Most hours still missing comes first; finished categories sink to the bottom.
        items.sort((x, y) => Number(x.done) - Number(y.done) || y.ch_pendente - x.ch_pendente);

        grid.innerHTML = items.map((item) => {
            const tone = item.done ? 'ok' : (item.pct < 40 ? 'bad' : 'warn');
            const bar = { ok: 'bg-success', warn: 'bg-warning', bad: 'bg-error' }[tone];
            const text = { ok: 'text-success', warn: 'text-warning', bad: 'text-error' }[tone];

            return `
                <div class="req-row" data-tone="${tone}" data-done="${item.done}">
                    <div class="min-w-0">
                        <h3 class="subject-name" title="${escape_html(item.label)}">${escape_html(item.label)}</h3>
                    </div>
                    <div class="req-bar flex items-center gap-3">
                        <div class="flex-1 bg-base-content/10 rounded-full h-2 overflow-hidden">
                            <div class="${bar} h-full rounded-full transition-all duration-1000 ease-out" style="width: ${item.pct}%"></div>
                        </div>
                        <span class="text-xs font-extrabold w-10 text-right ${text}">${item.done ? '✓' : `${item.pct}%`}</span>
                    </div>
                    <div class="cell">
                        <span class="cell-n">${item.ch_cumprida}h</span>
                        <span class="text-xs font-semibold text-base-content/40"> / ${item.ch_esperada}h</span>
                    </div>
                    <div class="cell">
                        <span class="cell-n ${item.ch_pendente > 0 ? 'text-warning' : 'text-base-content/30'}">${item.ch_pendente > 0 ? `${item.ch_pendente}h` : '—'}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    function render_error(message) {
        progress_percent.textContent = '-';
        const fill = document.getElementById('progress-bar-fill');
        if (fill) fill.style.width = '0%';
        grid.innerHTML = `<div class="p-10 text-center text-error font-bold text-sm">${escape_html(message)}</div>`;
    }

    async function load() {
        const res = await fetch('/api/requisitos', { credentials: 'same-origin' });
        if (!res.ok) throw new Error(res.status === 401 ? 'Sessão expirou.' : 'Falha ao buscar requisitos.');
        const data = await res.json();
        render(data);
    }

    window.addEventListener('DOMContentLoaded', async () => {
        try {
            await load();
        } catch (e) {
            render_error(e.message);
        }
    });
}());
