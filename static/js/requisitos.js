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

        progress_radial.style.setProperty('--value', pct);
        progress_percent.textContent = `${pct}%`;
        progress_bar.value = pct;
        progress_totals.textContent = `${totais.ch_cumprida || 0} / ${totais.ch_esperada || 0}h`;

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
            grid.innerHTML = '<div class="col-span-full text-center py-8 text-base-content/50">Nenhum requisito encontrado.</div>';
            return;
        }

        grid.innerHTML = items.map((item) => `
            <div class="card bg-base-100 shadow-md border border-base-300/40">
                <div class="card-body py-4 gap-2">
                    <div class="flex justify-between items-center">
                        <h3 class="font-semibold">${escape_html(item.label)}</h3>
                        <div class="badge ${item.done ? 'badge-success text-white' : 'badge-outline'} badge-sm">
                            ${item.done ? 'Concluído' : `${item.pct}%`}
                        </div>
                    </div>
                    <progress class="progress ${item.done ? 'progress-success' : 'progress-primary'} w-full" value="${item.pct}" max="100"></progress>
                    <div class="flex justify-between text-xs text-base-content/60">
                        <span>Cumprida: ${item.ch_cumprida}h</span>
                        <span>Esperada: ${item.ch_esperada}h</span>
                        <span>Pendente: ${item.ch_pendente}h</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    function render_error(message) {
        progress_percent.textContent = '-';
        progress_totals.textContent = 'Erro ao carregar';
        grid.innerHTML = `<div class="col-span-full text-center py-8 text-error">${escape_html(message)}</div>`;
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
