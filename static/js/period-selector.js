(function () {
    const period_selector = document.getElementById('period-selector');
    if (!period_selector) {
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

    function set_selected_period(ano_letivo, periodo_letivo) {
        window.plusuapPeriod = {
            ano_letivo: String(ano_letivo || ''),
            periodo_letivo: String(periodo_letivo || ''),
        };
    }

    function notify_period_change() {
        window.dispatchEvent(new CustomEvent('plusuap:period-changed', {
            detail: window.plusuapPeriod || { ano_letivo: '', periodo_letivo: '' },
        }));
    }

    function render_periods(periods, selected_ano, selected_periodo) {
        if (!periods || periods.length === 0) {
            period_selector.innerHTML = '<option selected>Nenhum período encontrado</option>';
            period_selector.disabled = true;
            set_selected_period('', '');
            return;
        }

        period_selector.innerHTML = periods.map((period) => {
            const is_selected = String(period.ano_letivo) === String(selected_ano)
                && String(period.periodo_letivo) === String(selected_periodo);
            return `<option value="${escape_html(period.ano_letivo)}|${escape_html(period.periodo_letivo)}" ${is_selected ? 'selected' : ''}>${escape_html(period.label)}</option>`;
        }).join('');
        period_selector.disabled = false;
    }

    async function load_periods() {
        const response = await fetch('/api/periods', { credentials: 'same-origin' });
        if (!response.ok) {
            throw new Error(response.status === 401 ? 'Sua sessão expirou, faça login novamente.' : 'Falha ao carregar períodos.');
        }

        const data = await response.json();
        render_periods(data.periods, data.selected_ano, data.selected_periodo);
        set_selected_period(data.selected_ano, data.selected_periodo);
    }

    async function persist_period_selection(ano_letivo, periodo_letivo) {
        const query = new URLSearchParams({
            ano_letivo: String(ano_letivo || ''),
            periodo_letivo: String(periodo_letivo || ''),
        });

        const response = await fetch(`/api/periods/select?${query.toString()}`, {
            method: 'POST',
            credentials: 'same-origin',
        });

        if (!response.ok) {
            throw new Error('Falha ao salvar período selecionado.');
        }
    }

    period_selector.addEventListener('change', async (event) => {
        const [ano_letivo, periodo_letivo] = event.target.value.split('|');
        period_selector.disabled = true;
        try {
            await persist_period_selection(ano_letivo, periodo_letivo);
            set_selected_period(ano_letivo, periodo_letivo);
            notify_period_change();
        } catch (_error) {
            await load_periods();
        } finally {
            period_selector.disabled = false;
        }
    });

    window.plusuapPeriodReady = load_periods().catch(() => {
        period_selector.innerHTML = '<option selected>Erro ao carregar períodos</option>';
        period_selector.disabled = true;
        set_selected_period('', '');
    });
}());
