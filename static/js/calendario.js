(function () {
    const container = document.getElementById('calendario-container');
    const timelineContainer = document.getElementById('timeline-container');
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
            events.push(`Sábado Letivo (Compensa ${sabadoLetivoMap[ds]})`);
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
            <div class="flex items-center justify-between mb-5 px-1">
                <button id="cal-prev" class="btn btn-sm btn-ghost btn-circle border border-base-300/40 hover:bg-base-300 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <h3 class="font-extrabold text-base md:text-lg text-base-content">${MONTH_NAMES[currentMonth]} ${currentYear}</h3>
                <button id="cal-next" class="btn btn-sm btn-ghost btn-circle border border-base-300/40 hover:bg-base-300 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>
        `;

        html += '<div class="grid grid-cols-7 gap-1.5 mb-1.5">';
        DAY_NAMES.forEach((d, i) => {
            const weekend = (i === 0 || i === 6) ? 'text-error/60' : 'text-base-content/40';
            html += `<div class="text-center text-[10px] uppercase font-bold tracking-wider py-1 ${weekend}">${d}</div>`;
        });
        html += '</div>';

        html += '<div class="grid grid-cols-7 gap-1.5">';

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
            const tooltipAttr = tooltip ? `data-tip="${tooltip}" class="${cellCls} tooltip tooltip-top font-bold"` : `class="${cellCls}"`;

            html += `<div ${tooltipAttr}><span class="cal-day-num">${day}</span></div>`;
        }

        html += '</div>';

        container.innerHTML = html;

        // Attach listeners for prev/next month switcher
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

    function escape_html(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function renderUpcomingTimeline() {
        if (!timelineContainer) return;

        const today = new Date();
        const todayStr = dateStr(today.getFullYear(), today.getMonth(), today.getDate());

        const upcoming = [];
        
        // Scan upcoming 45 days chronologically
        for (let i = 0; i <= 45; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() + i);
            const ds = dateStr(d.getFullYear(), d.getMonth(), d.getDate());
            const info = getDayInfo(ds);
            
            if (info.events.length > 0) {
                const dayNum = d.getDate();
                const monthName = MONTH_NAMES[d.getMonth()].slice(0, 3);
                const dayOfWeekName = DAY_NAMES[d.getDay()];
                upcoming.push({
                    date: `${dayNum} ${monthName} (${dayOfWeekName})`,
                    label: info.events.join(' • '),
                    cls: info.cls,
                    isToday: ds === todayStr,
                });
            }
        }

        if (upcoming.length === 0) {
            timelineContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center py-12 text-center text-base-content/40">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 opacity-40 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                    <p class="text-xs font-bold leading-normal">Sem eventos letivos agendados para os próximos 45 dias.</p>
                </div>
            `;
            return;
        }

        // Only the next few: the full calendar is one click away.
        timelineContainer.innerHTML = upcoming.slice(0, 5).map(ev => {
            const todayBadge = ev.isToday ? '<span class="badge badge-primary badge-sm">Hoje</span>' : '';
            const dot = ev.cls ? `<span class="cal-dot ${ev.cls} shrink-0"></span>` : '<span class="cal-dot shrink-0" style="background:rgb(var(--bc)/.3)"></span>';

            return `
                <div class="next-event">
                    <div class="w-20 shrink-0 text-[11px] font-extrabold uppercase tracking-wide text-base-content/50 leading-tight">${ev.date}</div>
                    <div class="flex-1 min-w-0 flex items-center gap-2">
                        ${dot}
                        <span class="text-sm font-semibold leading-snug">${escape_html(ev.label)}</span>
                        ${todayBadge}
                    </div>
                </div>
            `;
        }).join('');
    }

    async function init() {
        try {
            const res = await fetch('/static/data/calendario.json', { cache: 'no-cache' });
            if (!res.ok) throw new Error('Erro ao carregar calendário');
            calData = await res.json();
            buildMaps(calData);
            renderCalendar();
            renderUpcomingTimeline();
        } catch (e) {
            console.error(e);
            container.innerHTML = `<p class="text-sm text-base-content/50 text-center py-4 font-bold">Calendário indisponível.</p>`;
            if (timelineContainer) timelineContainer.innerHTML = '';
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
