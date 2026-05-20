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
            grid.innerHTML = '<div class="col-span-full text-center py-16 glass-card bg-base-100/20 border border-base-300/40 rounded-2xl text-base-content/50 font-bold">Nenhum requisito encontrado para o curso.</div>';
            return;
        }

        grid.innerHTML = items.map((item) => {
            let progress_color = 'from-primary to-accent';
            let badge_style = 'bg-primary/10 text-primary border-primary/20';

            if (item.done) {
                progress_color = 'from-success to-success';
                badge_style = 'bg-success/10 text-success border-success/20';
            } else if (item.pct < 40) {
                progress_color = 'from-error to-error';
                badge_style = 'bg-error/10 text-error border-error/20';
            } else if (item.pct < 100) {
                progress_color = 'from-warning to-accent';
                badge_style = 'bg-warning/10 text-warning border-warning/20';
            }

            return `
                <div class="card glass-card card-hoverable bg-base-100/25 p-5 border border-base-300/40 flex flex-col justify-between">
                    <div>
                        <div class="flex justify-between items-center gap-2 mb-3">
                            <h3 class="font-extrabold text-sm text-base-content truncate" title="${escape_html(item.label)}">${escape_html(item.label)}</h3>
                            <span class="badge badge-sm font-extrabold text-[9px] uppercase border px-2 py-0.5 rounded-md shrink-0 ${badge_style}">
                                ${item.done ? 'Concluído' : `${item.pct}%`}
                            </span>
                        </div>
                        
                        <!-- Sleek custom glowing horizontal progress bar container -->
                        <div class="w-full bg-base-300/40 rounded-full h-2 overflow-hidden mb-4">
                            <div class="bg-gradient-to-r ${progress_color} h-full rounded-full transition-all duration-1000 ease-out" style="width: ${item.pct}%"></div>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-3 gap-2 text-center text-xs mt-auto pt-1 select-none">
                        <div class="bg-base-200/30 border border-base-300/20 rounded-xl p-2 flex flex-col justify-center">
                            <span class="text-[8px] uppercase font-bold text-base-content/40 mb-0.5">Cumprida</span>
                            <span class="font-black text-xs text-base-content">${item.ch_cumprida}h</span>
                        </div>
                        <div class="bg-base-200/30 border border-base-300/20 rounded-xl p-2 flex flex-col justify-center">
                            <span class="text-[8px] uppercase font-bold text-base-content/40 mb-0.5">Pendente</span>
                            <span class="font-black text-xs ${item.ch_pendente > 0 ? 'text-warning' : 'text-base-content/40'}">${item.ch_pendente}h</span>
                        </div>
                        <div class="bg-base-200/30 border border-base-300/20 rounded-xl p-2 flex flex-col justify-center">
                            <span class="text-[8px] uppercase font-bold text-base-content/40 mb-0.5">Esperada</span>
                            <span class="font-black text-xs text-base-content">${item.ch_esperada}h</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function render_error(message) {
        progress_percent.textContent = '-';
        const fill = document.getElementById('progress-bar-fill');
        if (fill) fill.style.width = '0%';
        grid.innerHTML = `
            <div class="col-span-full text-center py-16 glass-card bg-error/5 border border-error/20 rounded-2xl text-error font-extrabold text-sm max-w-md mx-auto my-6 animate-fade-in">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 mx-auto mb-3 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                ${escape_html(message)}
            </div>
        `;
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
