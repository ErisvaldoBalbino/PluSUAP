(function () {
    const container = document.getElementById('calendario-container');
    if (!container) return;

    const MONTH_NAMES = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    let calData = null;
    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();

    let holidayMap = {};
    let provasMap = {};
    let sabadoLetivoMap = {};
    let encontroMap = {};
    let inicioAulasMap = {};
    let feriasRanges = [];

    function dateStr(y, m, d) {
        return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }

    function parseDateStr(s) {
        const [y, m, d] = s.split('-').map(Number);
        return { year: y, month: m - 1, day: d };
    }

    function isInRange(ds, ranges) {
        return ranges.some(r => ds >= r.inicio && ds <= r.fim);
    }

    function buildMaps(data) {
        holidayMap = {};
        provasMap = {};
        sabadoLetivoMap = {};
        encontroMap = {};
        inicioAulasMap = {};
        feriasRanges = [];

        (data.feriados_e_recessos || []).forEach(f => {
            holidayMap[f.data] = f;
        });

        (data.ferias_docentes || []).forEach(f => {
            feriasRanges.push({ inicio: f.inicio, fim: f.fim });
        });

        Object.values(data.semestres || {}).forEach(sem => {
            (sem.provas_finais || []).forEach(d => {
                provasMap[d] = true;
            });
            (sem.sabados_letivos || []).forEach(s => {
                sabadoLetivoMap[s.data] = s.compensa;
            });
            (sem.encontro_pedagogico || []).forEach(d => {
                encontroMap[d] = true;
            });
            if (sem.inicio_aulas) {
                inicioAulasMap[sem.inicio_aulas] = true;
            }
        });
    }

    function getDayInfo(ds) {
        const events = [];
        let cls = '';
        let priority = 0;

        if (provasMap[ds]) {
            events.push('Prova Final');
            cls = 'cal-prova';
            priority = 6;
        }
        if (inicioAulasMap[ds]) {
            events.push('Início das Aulas');
            cls = 'cal-inicio';
            priority = 5;
        }
        if (encontroMap[ds]) {
            events.push('Encontro Pedagógico');
            cls = 'cal-encontro';
            priority = 4;
        }
        if (holidayMap[ds]) {
            const h = holidayMap[ds];
            events.push(h.nome);
            cls = h.tipo.includes('feriado') ? 'cal-feriado' : 'cal-facultativo';
            priority = h.tipo.includes('feriado') ? 3 : 2;
        }
        if (sabadoLetivoMap[ds]) {
            events.push(`Sábado Letivo (${sabadoLetivoMap[ds]})`);
            cls = 'cal-sabado-letivo';
            priority = Math.max(priority, 1);
        }
        if (isInRange(ds, feriasRanges) && priority === 0) {
            events.push('Férias Docentes');
            cls = 'cal-ferias';
        }

        return { events, cls };
    }

    function renderCalendar() {
        const today = new Date();
        const todayStr = dateStr(today.getFullYear(), today.getMonth(), today.getDate());

        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

        let html = `
            <div class="flex items-center justify-between mb-4">
                <button id="cal-prev" class="btn btn-sm btn-ghost btn-circle">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <h3 class="font-bold text-lg">${MONTH_NAMES[currentMonth]} ${currentYear}</h3>
                <button id="cal-next" class="btn btn-sm btn-ghost btn-circle">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>
        `;

        html += '<div class="grid grid-cols-7 gap-1 mb-1">';
        DAY_NAMES.forEach((d, i) => {
            const weekend = (i === 0 || i === 6) ? 'text-base-content/40' : '';
            html += `<div class="text-center text-xs font-semibold py-1 ${weekend}">${d}</div>`;
        });
        html += '</div>';

        html += '<div class="grid grid-cols-7 gap-1">';

        for (let i = 0; i < firstDay; i++) {
            html += '<div class="cal-cell cal-empty"></div>';
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const ds = dateStr(currentYear, currentMonth, day);
            const dayOfWeek = new Date(currentYear, currentMonth, day).getDay();
            const isToday = ds === todayStr;
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const info = getDayInfo(ds);

            let cellCls = 'cal-cell';
            if (isToday) cellCls += ' cal-today';
            if (info.cls) cellCls += ` ${info.cls}`;
            else if (isWeekend) cellCls += ' cal-weekend';

            const tooltip = info.events.length > 0 ? info.events.join(' • ') : '';
            const tooltipAttr = tooltip ? `data-tip="${tooltip}" class="${cellCls} tooltip tooltip-bottom"` : `class="${cellCls}"`;

            html += `<div ${tooltipAttr}><span class="cal-day-num">${day}</span></div>`;
        }

        html += '</div>';

        html += renderUpcoming();

        container.innerHTML = html;

        document.getElementById('cal-prev').addEventListener('click', () => {
            currentMonth--;
            if (currentMonth < 0) { currentMonth = 11; currentYear--; }
            renderCalendar();
        });
        document.getElementById('cal-next').addEventListener('click', () => {
            currentMonth++;
            if (currentMonth > 11) { currentMonth = 0; currentYear++; }
            renderCalendar();
        });
    }

    function renderUpcoming() {
        const today = new Date();
        const todayStr = dateStr(today.getFullYear(), today.getMonth(), today.getDate());

        const upcoming = [];
        for (let i = 0; i <= 30; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() + i);
            const ds = dateStr(d.getFullYear(), d.getMonth(), d.getDate());
            const info = getDayInfo(ds);
            if (info.events.length > 0) {
                const dayNum = d.getDate();
                const monthName = MONTH_NAMES[d.getMonth()].slice(0, 3);
                upcoming.push({
                    date: `${dayNum} ${monthName}`,
                    label: info.events.join(', '),
                    cls: info.cls,
                    isToday: ds === todayStr,
                });
            }
        }

        if (upcoming.length === 0) return '';

        let html = `
            <div class="divider text-xs text-base-content/50 mt-4 mb-2">Próximos 30 dias</div>
            <div class="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
        `;
        upcoming.forEach(ev => {
            const todayBadge = ev.isToday ? '<span class="badge badge-xs badge-primary ml-1">Hoje</span>' : '';
            html += `
                <div class="flex items-center gap-2 text-sm">
                    <span class="cal-dot ${ev.cls}"></span>
                    <span class="font-medium min-w-[3.5rem] text-base-content/60">${ev.date}</span>
                    <span class="truncate">${ev.label}${todayBadge}</span>
                </div>
            `;
        });
        html += '</div>';
        return html;
    }

    async function init() {
        try {
            const res = await fetch('/static/data/calendario.json');
            if (!res.ok) throw new Error('Erro ao carregar calendário');
            calData = await res.json();
            buildMaps(calData);
            renderCalendar();
        } catch (e) {
            container.innerHTML = `<p class="text-sm text-base-content/50 text-center py-4">Calendário indisponível.</p>`;
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
