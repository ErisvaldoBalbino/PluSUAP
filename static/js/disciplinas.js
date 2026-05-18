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
            <div class="card card-bordered bg-base-100">
                <div class="card-body">
                    <span class="skeleton h-6 w-3/4 inline-block"></span>
                    <span class="skeleton h-4 w-1/2 inline-block mt-2"></span>
                    <span class="skeleton h-4 w-1/3 inline-block mt-1"></span>
                </div>
            </div>
        `).join('');
    }

    function render_error(message) {
        list_el.innerHTML = `
            <div class="col-span-full text-center py-12 text-error">
                ${escape_html(message)}
            </div>
        `;
    }

    function get_situacao_badge(situacao) {
        const rotulo = (situacao && situacao.rotulo) ? situacao.rotulo : String(situacao ?? '');
        const s = rotulo.toLowerCase();
        if (s.includes('aprovado')) return { cls: 'badge-success text-white', label: rotulo };
        if (s.includes('reprovado')) return { cls: 'badge-error text-white', label: rotulo };
        if (s.includes('cursando')) return { cls: 'badge-info', label: rotulo };
        if (s.includes('trancad')) return { cls: 'badge-warning', label: rotulo };
        return { cls: 'badge-outline', label: rotulo || 'N/I' };
    }

    function get_media(medias) {
        if (!Array.isArray(medias)) return '-';
        const md = medias.find(m => m.tipo === 'MD');
        return (md && md.nota != null) ? md.nota : '-';
    }

    function render_disciplinas(disciplinas) {
        if (!disciplinas || disciplinas.length === 0) {
            list_el.innerHTML = `
                <div class="col-span-full text-center py-12 text-base-content/50">
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
            <div class="card card-bordered bg-base-100 card-hoverable">
                <div class="card-body py-5 gap-3">
                    <div class="flex justify-between items-start gap-2">
                        <h2 class="card-title text-base leading-snug">${nome}</h2>
                        <div class="badge ${badge.cls} badge-sm shrink-0">${escape_html(badge.label)}</div>
                    </div>
                    <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-base-content/70">
                        <span>C.H.: <strong>${ch}</strong></span>
                        <span>Média: <strong>${media}</strong></span>
                        <span>Faltas: <strong>${faltas}</strong></span>
                        <span>Freq.: <strong>${freq}</strong></span>
                    </div>
                    ${id ? `<div class="card-actions justify-end mt-1">
                        <button class="btn btn-sm btn-ghost btn-primary" onclick="window._openEtapas(${id}, '${nome.replace(/'/g, "\\'")}')">Ver Etapas</button>
                    </div>` : ''}
                </div>
            </div>
            `;
        }).join('');
    }

    window._openEtapas = async function (disciplina_id, nome) {
        modal_title.textContent = nome;
        modal_body.innerHTML = '<div class="flex justify-center py-8"><span class="loading loading-spinner loading-md"></span></div>';
        modal.showModal();

        try {
            const res = await fetch(`/api/disciplinas/${disciplina_id}/etapas`, { credentials: 'same-origin' });
            if (!res.ok) throw new Error('Falha ao buscar etapas.');
            const data = await res.json();
            render_etapas(data.etapas || []);
        } catch (e) {
            modal_body.innerHTML = `<p class="text-error text-center py-4">${escape_html(e.message)}</p>`;
        }
    };

    function render_etapas(raw_etapas) {
        const etapas = (raw_etapas || []).filter((etapa) => {
            const avs = etapa.avaliacoes || [];
            if (avs.length === 0) return false;
            return avs.some((a) => (a.nota != null && a.nota !== '') || (a.data != null && a.data !== ''));
        });

        if (etapas.length === 0) {
            modal_body.innerHTML = '<p class="text-center text-base-content/50 py-4">Nenhuma etapa encontrada.</p>';
            return;
        }

        const sections = etapas.map((etapa) => {
            const num = etapa.numero_etapa != null ? etapa.numero_etapa : '?';
            const avaliacoes = etapa.avaliacoes || [];

            if (avaliacoes.length === 0) {
                return `
                    <div class="mb-4">
                        <h4 class="font-semibold text-sm mb-2">Etapa ${escape_html(num)}</h4>
                        <p class="text-base-content/50 text-sm">Nenhuma avaliação registrada.</p>
                    </div>
                `;
            }

            const rows = avaliacoes.map((a) => `
                <tr>
                    <td class="font-medium">${escape_html(a.sigla || a.tipo || '-')}</td>
                    <td>${escape_html(a.tipo || '-')}</td>
                    <td class="text-center">${a.nota != null ? escape_html(a.nota) : '-'}</td>
                    <td class="text-center">${a.data ? escape_html(a.data) : '-'}</td>
                </tr>
            `).join('');

            return `
                <div class="mb-4 last:mb-0">
                    <h4 class="font-semibold text-sm mb-2">Etapa ${escape_html(num)}</h4>
                    <div class="overflow-x-auto">
                        <table class="table table-zebra table-sm w-full">
                            <thead class="bg-base-200">
                                <tr>
                                    <th>Sigla</th>
                                    <th>Tipo</th>
                                    <th class="text-center">Nota</th>
                                    <th class="text-center">Data</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </div>
            `;
        }).join('<div class="divider my-2"></div>');

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
