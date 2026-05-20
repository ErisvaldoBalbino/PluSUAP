(function () {
    const list_el = document.getElementById('disciplinas-list');
    const modal = document.getElementById('etapas-modal');
    const modal_title = document.getElementById('etapas-modal-title');
    const modal_body = document.getElementById('etapas-modal-body');

    if (!list_el) return;

    function escape_html(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function render_loading() {
        list_el.innerHTML = Array.from({ length: 4 }).map(() => `
            <div class="card glass-card p-6 border border-base-300/40">
                <span class="skeleton h-6 w-3/4 inline-block rounded-md"></span>
                <span class="skeleton h-4 w-1/2 inline-block mt-3 rounded-md"></span>
                <div class="grid grid-cols-3 gap-3 mt-4">
                    <span class="skeleton h-10 w-full inline-block rounded-xl"></span>
                    <span class="skeleton h-10 w-full inline-block rounded-xl"></span>
                    <span class="skeleton h-10 w-full inline-block rounded-xl"></span>
                </div>
            </div>
        `).join('');
    }

    function render_error(message) {
        list_el.innerHTML = `
            <div class="col-span-full text-center py-16 glass-card bg-error/5 border border-error/20 rounded-2xl text-error font-extrabold text-sm max-w-md mx-auto my-6 animate-fade-in">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 mx-auto mb-3 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                ${escape_html(message)}
            </div>
        `;
    }

    function get_situacao_badge(situacao) {
        const rotulo = (situacao && situacao.rotulo) ? situacao.rotulo : String(situacao ?? '');
        const s = rotulo.toLowerCase();
        if (s.includes('aprovado')) return { cls: 'bg-success/10 text-success border-success/20', label: rotulo };
        if (s.includes('reprovado')) return { cls: 'bg-error/10 text-error border-error/20', label: rotulo };
        if (s.includes('cursando')) return { cls: 'bg-info/10 text-info border-info/20', label: rotulo };
        if (s.includes('trancad')) return { cls: 'bg-warning/10 text-warning border-warning/20', label: rotulo };
        return { cls: 'bg-base-200/50 text-base-content/70 border-base-300/40', label: rotulo || 'N/I' };
    }

    function get_media(medias) {
        if (!Array.isArray(medias)) return '-';
        const md = medias.find(m => m.tipo === 'MD');
        return (md && md.nota != null) ? md.nota : '-';
    }

    function render_disciplinas(disciplinas) {
        if (!disciplinas || disciplinas.length === 0) {
            list_el.innerHTML = `
                <div class="col-span-full text-center py-16 glass-card bg-base-100/20 border border-base-300/40 rounded-2xl text-base-content/50 font-bold">
                    Nenhuma disciplina encontrada neste período.
                </div>
            `;
            return;
        }

        list_el.innerHTML = disciplinas.map((d) => {
            const id = d.id || '';
            const nome = escape_html(d.descricao || 'Sem nome');
            const badge = get_situacao_badge(d.situacao);
            const media = get_media(d.medias);
            const faltas = d.qtd_faltas != null ? d.qtd_faltas : '-';
            const ch = d.ch_total_aula != null ? `${d.ch_total_aula}h` : '-';
            const freq = d.frequencia != null ? `${Math.round(d.frequencia)}%` : '-';

            return `
            <div class="card glass-card card-hoverable bg-base-100/25 p-5 border border-base-300/40 flex flex-col justify-between">
                <div>
                    <div class="flex justify-between items-start gap-2 mb-3">
                        <span class="badge ${badge.cls} font-extrabold text-[9px] uppercase border px-2.5 py-0.5 rounded-md">${escape_html(badge.label)}</span>
                        <span class="text-[10px] font-black text-base-content/40 uppercase tracking-widest">${ch}</span>
                    </div>
                    <h2 class="font-extrabold text-base text-base-content leading-snug mb-4 truncate-two-lines" title="${nome}">${nome}</h2>
                    
                    <div class="grid grid-cols-3 gap-3 text-xs mb-4">
                        <div class="bg-base-200/35 border border-base-300/20 rounded-xl p-2.5 text-center flex flex-col justify-center">
                            <span class="text-[9px] uppercase font-bold text-base-content/40 mb-0.5">Média</span>
                            <span class="font-black text-sm text-primary">${media}</span>
                        </div>
                        <div class="bg-base-200/35 border border-base-300/20 rounded-xl p-2.5 text-center flex flex-col justify-center">
                            <span class="text-[9px] uppercase font-bold text-base-content/40 mb-0.5">Faltas</span>
                            <span class="font-black text-sm text-error">${faltas}</span>
                        </div>
                        <div class="bg-base-200/35 border border-base-300/20 rounded-xl p-2.5 text-center flex flex-col justify-center">
                            <span class="text-[9px] uppercase font-bold text-base-content/40 mb-0.5">Freq.</span>
                            <span class="font-black text-sm ${parseFloat(freq) >= 75 || freq === '-' ? 'text-success' : 'text-error'}">${freq}</span>
                        </div>
                    </div>
                </div>
                ${id ? `<div class="card-actions justify-end mt-2">
                    <button class="btn btn-sm btn-outline border-base-300/50 hover:bg-primary hover:text-primary-content hover:border-transparent font-extrabold rounded-xl w-full text-xs shadow-sm" onclick="window._openEtapas(${id}, '${nome.replace(/'/g, "\\'")}')">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        Detalhar Notas da Disciplina
                    </button>
                </div>` : ''}
            </div>
            `;
        }).join('');
    }

    window._openEtapas = async function (disciplina_id, nome) {
        modal_title.textContent = nome;
        modal_body.innerHTML = '<div class="flex justify-center py-8"><span class="loading loading-spinner loading-md text-primary"></span></div>';
        modal.showModal();

        try {
            const res = await fetch(`/api/disciplinas/${disciplina_id}/etapas`, { credentials: 'same-origin' });
            if (!res.ok) throw new Error('Falha ao buscar etapas.');
            const data = await res.json();
            render_etapas(data.etapas || []);
        } catch (e) {
            modal_body.innerHTML = `<p class="text-error text-center py-4 font-bold text-sm">${escape_html(e.message)}</p>`;
        }
    };

    function render_etapas(raw_etapas) {
        const etapas = (raw_etapas || []).filter((etapa) => {
            const avs = etapa.avaliacoes || [];
            if (avs.length === 0) return false;
            return avs.some((a) => (a.nota != null && a.nota !== '') || (a.data != null && a.data !== ''));
        });

        if (etapas.length === 0) {
            modal_body.innerHTML = '<p class="text-center text-base-content/50 py-8 font-bold text-sm">Nenhuma etapa ou avaliação encontrada para esta matéria.</p>';
            return;
        }

        const sections = etapas.map((etapa) => {
            const num = etapa.numero_etapa != null ? etapa.numero_etapa : '?';
            const avaliacoes = etapa.avaliacoes || [];

            if (avaliacoes.length === 0) {
                return `
                    <div class="mb-6 bg-base-200/15 border border-base-300/20 rounded-2xl p-4">
                        <h4 class="font-extrabold text-sm text-base-content mb-3 flex items-center gap-1.5">
                            <span class="w-1.5 h-3.5 bg-primary rounded-full"></span>
                            Etapa ${escape_html(num)}
                        </h4>
                        <p class="text-base-content/50 text-xs font-semibold py-2">Nenhuma avaliação registrada nesta etapa.</p>
                    </div>
                `;
            }

            const rows = avaliacoes.map((a) => {
                let nota_val = a.nota != null ? escape_html(a.nota) : '-';
                let nota_class = 'font-bold text-base-content';
                if (a.nota != null) {
                    const num = parseFloat(String(a.nota).replace(',', '.'));
                    if (!isNaN(num)) {
                        nota_class = num >= 60 ? 'font-black text-success' : 'font-black text-error';
                    }
                }
                return `
                    <tr class="hover:bg-base-200/50">
                        <td class="font-extrabold text-primary text-xs">${escape_html(a.sigla || a.tipo || '-')}</td>
                        <td class="text-xs font-semibold text-base-content/85">${escape_html(a.tipo || '-')}</td>
                        <td class="text-center ${nota_class}">${nota_val}</td>
                        <td class="text-center text-xs text-base-content/60 font-semibold">${a.data ? escape_html(a.data) : '-'}</td>
                    </tr>
                `;
            }).join('');

            return `
                <div class="mb-6 last:mb-0 bg-base-200/15 border border-base-300/20 rounded-2xl p-4">
                    <h4 class="font-extrabold text-sm text-base-content mb-3 flex items-center gap-1.5">
                        <span class="w-1.5 h-3.5 bg-primary rounded-full"></span>
                        Etapa ${escape_html(num)}
                    </h4>
                    <div class="overflow-x-auto">
                        <table class="table w-full">
                            <thead class="text-[10px] uppercase font-bold tracking-wider text-base-content/40 border-b border-base-300/30">
                                <tr>
                                    <th>Sigla</th>
                                    <th>Tipo de Avaliação</th>
                                    <th class="text-center">Nota</th>
                                    <th class="text-center">Data Limite</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </div>
            `;
        }).join('');

        modal_body.innerHTML = sections;
    }

    function get_selected_period() {
        const selected = window.plusuapPeriod || {};
        return {
            ano_letivo: selected.ano_letivo || '',
            periodo_letivo: selected.periodo_letivo || '',
        };
    }

    async function load_disciplinas(ano_letivo = '', periodo_letivo = '') {
        const query = new URLSearchParams();
        if (ano_letivo && periodo_letivo) {
            query.set('ano_letivo', ano_letivo);
            query.set('periodo_letivo', periodo_letivo);
        }
        const endpoint = `/api/disciplinas${query.toString() ? `?${query.toString()}` : ''}`;
        const res = await fetch(endpoint, { credentials: 'same-origin' });
        if (!res.ok) {
            throw new Error(res.status === 401 ? 'Sessão expirou.' : 'Falha ao buscar disciplinas.');
        }
        const data = await res.json();
        render_disciplinas(data.disciplinas || []);
    }

    window.addEventListener('plusuap:period-changed', async (event) => {
        const selected = event.detail || get_selected_period();
        render_loading();
        try {
            await load_disciplinas(selected.ano_letivo, selected.periodo_letivo);
        } catch (e) {
            render_error(e.message);
        }
    });

    window.addEventListener('DOMContentLoaded', async () => {
        if (window.plusuapPeriodReady && typeof window.plusuapPeriodReady.then === 'function') {
            await window.plusuapPeriodReady;
        }
        const selected = get_selected_period();
        render_loading();
        try {
            await load_disciplinas(selected.ano_letivo, selected.periodo_letivo);
        } catch (e) {
            render_error(e.message);
        }
    });
}());
