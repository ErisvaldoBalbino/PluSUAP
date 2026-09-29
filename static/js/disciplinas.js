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
            <div class="subject-row" data-state="NEUTRO">
                <div class="subject-main"><span class="skeleton h-5 w-2/3"></span></div>
                <div class="cell"><span class="skeleton h-6 w-10"></span></div>
                <div class="cell"><span class="skeleton h-4 w-8"></span></div>
                <div class="cell"><span class="skeleton h-4 w-10"></span></div>
                <div class="cell"><span class="skeleton h-7 w-full"></span></div>
            </div>
        `).join('');
    }

    function render_error(message) {
        list_el.innerHTML = `<div class="p-10 text-center text-error font-bold text-sm">${escape_html(message)}</div>`;
    }

    function state_of(situacao) {
        const rotulo = (situacao && situacao.rotulo) ? situacao.rotulo : String(situacao ?? '');
        const s = rotulo.toLowerCase();
        if (s.includes('aprovado')) return 'SUCESSO';
        if (s.includes('reprovado')) return 'FALHA';
        if (s.includes('trancad')) return 'PERIGO';
        return 'NEUTRO';
    }

    function score_tone(value) {
        const num = parseFloat(String(value).replace(',', '.'));
        if (isNaN(num)) return 'text-base-content/30';
        if (num >= 70) return 'text-success';
        if (num >= 40) return 'text-warning';
        return 'text-error';
    }

    function get_situacao_badge(situacao) {
        const rotulo = (situacao && situacao.rotulo) ? situacao.rotulo : String(situacao ?? '');
        const s = rotulo.toLowerCase();
        if (s.includes('aprovado')) return { cls: 'bg-success/15 text-success', label: rotulo };
        if (s.includes('reprovado')) return { cls: 'bg-error/12 text-error', label: rotulo };
        if (s.includes('cursando')) return { cls: 'bg-info/12 text-info', label: rotulo };
        if (s.includes('trancad')) return { cls: 'bg-warning/15 text-warning', label: rotulo };
        return { cls: 'bg-base-content/8 text-base-content/60', label: rotulo || 'N/I' };
    }

    function get_media(medias) {
        if (!Array.isArray(medias)) return '-';
        const md = medias.find(m => m.tipo === 'MD');
        return (md && md.nota != null) ? md.nota : '-';
    }

    function render_disciplinas(disciplinas) {
        if (!disciplinas || disciplinas.length === 0) {
            list_el.innerHTML = '<div class="p-10 text-center text-base-content/50 font-semibold">Nenhuma disciplina encontrada neste período.</div>';
            return;
        }

        list_el.innerHTML = disciplinas.map((d) => {
            const id = d.id || '';
            const raw_nome = d.descricao || 'Sem nome';
            const badge = get_situacao_badge(d.situacao);
            const state = state_of(d.situacao);
            const media = get_media(d.medias);
            const faltas = d.qtd_faltas != null ? d.qtd_faltas : '–';
            const ch = d.ch_total_aula != null ? `${d.ch_total_aula}h` : '';
            const freq_num = d.frequencia != null ? Math.round(d.frequencia) : null;
            const media_txt = media === '-' ? '–' : escape_html(media);
            const code_match = raw_nome.match(/^([A-Z]{2,}[A-Z0-9.]*\d[A-Z0-9.]*)\s*-\s*(.+)$/);
            const code = code_match ? code_match[1] : '';
            const title = code_match ? code_match[2] : raw_nome;
            const meta = [code, state === 'NEUTRO' ? badge.label : '', ch].filter(Boolean).join(' · ');

            return `
            <div class="subject-row" data-state="${state}">
                <div class="subject-main">
                    <div class="flex items-center gap-2 flex-wrap">
                        <h3 class="subject-name" title="${escape_html(raw_nome)}">${escape_html(title)}</h3>
                        ${state === 'NEUTRO' ? '' : `<span class="badge shrink-0 uppercase tracking-wider text-[10px] font-extrabold ${badge.cls}">${escape_html(badge.label)}</span>`}
                    </div>
                    ${meta ? `<div class="subject-meta">${escape_html(meta)}</div>` : ''}
                </div>
                <div class="cell">
                    <span class="cell-label">Média</span>
                    <span class="cell-media ${score_tone(media)}">${media_txt}</span>
                </div>
                <div class="cell">
                    <span class="cell-label">Faltas</span>
                    <span class="cell-n">${faltas}</span>
                </div>
                <div class="cell">
                    <span class="cell-label">Freq.</span>
                    <span class="cell-n ${freq_num === null || freq_num >= 75 ? 'text-success' : 'text-error'}">${freq_num === null ? '–' : `${freq_num}%`}</span>
                </div>
                <div class="cell">
                    ${id ? `<button type="button" class="btn btn-outline btn-sm w-full" data-etapas-id="${id}" data-etapas-nome="${escape_html(raw_nome)}">Ver notas</button>` : ''}
                </div>
            </div>
            `;
        }).join('');
    }

    // Delegated click instead of inline onclick, so names with quotes cannot break the markup.
    list_el.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-etapas-id]');
        if (btn) window._openEtapas(btn.dataset.etapasId, btn.dataset.etapasNome);
    });

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
