import * as d3 from 'd3';

interface DateType {
    year: number;
    month: number;
    day: number;
}

type EventCategory = string;

interface EventType {
    date: DateType;
    name: string;
    type: EventCategory;
    description: string;
    sources: string[];
    dateValue?: number;
}

const CONFIG = {
    margin: { top: 50, right: 50, bottom: 50, left: 100 },
    width: 1000,
    height: 400,
    dayStart: 0,
    dayEnd: 24 * 60
};

function dateToNumber(date: DateType): number {
    let y = date.year;
    let m = date.month;
    let d = date.day;

    if (m <= 2) {
        y -= 1;
        m += 12;
    }

    const A = Math.floor(y / 100);
    const B = y < 0 ? 0 : 2 - A + Math.floor(A / 4);

    return Math.floor(365.25 * (y + 4716)) +
           Math.floor(30.6001 * (m + 1)) +
           d + B - 1524.5;
}

function numberToDate(jd: number): DateType {
    let J = jd + 0.5;
    let Z = Math.floor(J);
    let F = J - Z;
    let A;

    if (Z < 2299161) {
        A = Z;
    } else {
        let alpha = Math.floor((Z - 1867216.25) / 36524.25);
        A = Z + 1 + alpha - Math.floor(alpha / 4);
    }

    let B = A + 1524;
    let C = Math.floor((B - 122.1) / 365.25);
    let D = Math.floor(365.25 * C);
    let E = Math.floor((B - D) / 30.6001);

    let day = B - D - Math.floor(30.6001 * E) + F;
    let month = (E < 14) ? E - 1 : E - 13;
    let year = (month > 2) ? C - 4716 : C - 4715;

    return {
        year: Math.floor(year),
        month: Math.floor(month),
        day: Math.floor(day)
    };
}

function formatDate(date: DateType): string {
    const { year, month, day } = date;
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthStr = monthNames[month - 1];
    const yearStr = year < 0 ? `${Math.abs(year)} BCE` : `${year} CE`;
    return `${day} ${monthStr} ${yearStr}`;
}

function processEventData(events: EventType[]): EventType[] {
    return events.map(event => ({
        ...event,
        dateValue: dateToNumber(event.date)
    }));
}

function setupScales(
    events: EventType[],
    width: number,
    height: number,
    categories: string[],
    colors: { [key: string]: string }
) {
    const xExtent = d3.extent(events, d => d.dateValue);
    
    if (!xExtent[0] || !xExtent[1]) {
        throw new Error('Invalid data for x-axis extent.');
    }

    const x = d3.scaleLinear<number, number>()
        .domain([xExtent[0], xExtent[1]])
        .range([0, width]);

    const categoryScale = d3.scalePoint<string>()
        .domain(categories)
        .range([50, height - 50]);

    const colorScale = d3.scaleOrdinal<string, string>()
        .domain(categories)
        .range(categories.map(category => colors[category]));

    const xDay = d3.scaleLinear<number, number>()
        .domain([xExtent[0], xExtent[1]])
        .range([CONFIG.dayStart, CONFIG.dayEnd]);

    return { x, categoryScale, colorScale, xDay };
}

function setupSVG() {
    const width = CONFIG.width - CONFIG.margin.left - CONFIG.margin.right;
    const height = CONFIG.height - CONFIG.margin.top - CONFIG.margin.bottom;

    const svg = d3.select("#timeline")
        .append("svg")
        .attr("width", CONFIG.width)
        .attr("height", CONFIG.height)
        .append("g")
        .attr("transform", `translate(${CONFIG.margin.left},${CONFIG.margin.top})`);

    // Add background
    svg.insert("rect", ":first-child")
        .attr("width", CONFIG.width)
        .attr("height", CONFIG.height)
        .attr("transform", `translate(${-CONFIG.margin.left},${-CONFIG.margin.top})`)
        .attr("fill", "white");

    return { svg, width, height };
}

function setupAxes(svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>, 
                  x: d3.ScaleLinear<number, number>, 
                  xDay: d3.ScaleLinear<number, number>, 
                  height: number) {
    const xAxis = d3.axisBottom(x)
        .tickFormat((d: d3.NumberValue) => {
            const date = numberToDate(d.valueOf());
            const year = date.year;
            return year < 0 ? `${Math.abs(year)} BCE` : `${year} CE`;
        });

    const xAxisDay = d3.axisTop(x)
        .tickFormat((d: d3.NumberValue) => {
            const minutesInDay = xDay(d.valueOf());
            const hours = Math.floor(minutesInDay / 60);
            const minutes = Math.floor(minutesInDay % 60);
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        });

    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height})`)
        .call(xAxis as any);

    svg.append("g")
        .attr("class", "x-axis-day")
        .call(xAxisDay as any);

    return { xAxis, xAxisDay };
}

function setupCategories(svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
                        categoryScale: d3.ScalePoint<EventCategory>,
                        categories: string[]) {
    svg.selectAll<SVGTextElement, EventCategory>(".category-label")
        .data(categories)
        .enter()
        .append("text")
        .attr("class", "category-label")
        .attr("x", -CONFIG.margin.left + 10)
        .attr("y", d => categoryScale(d)!)
        .attr("dy", "0.35em")
        .text(d => d.charAt(0).toUpperCase() + d.slice(1));
}

function createTooltip() {
    return d3.select("body").append("div")
        .attr("class", "info-bubble")
        .style("opacity", "0");
}

function createEventHandlers(tooltip: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>,
                           minDateValue: number,
                           maxDateValue: number) {
    return {
        showInfo: (event: MouseEvent, d: EventType) => {
            const timeSinceStart = d.dateValue! - minDateValue;
            const totalTimeSpan = maxDateValue - minDateValue;
            const minutesInDay = (timeSinceStart / totalTimeSpan) * (CONFIG.dayEnd - CONFIG.dayStart);
            const hours = Math.floor(minutesInDay / 60);
            const minutes = Math.floor(minutesInDay % 60);
            const timeInDay = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

            const sourcesList = d.sources.map(source => `<li><a href="${source}" target="_blank">${source}</a></li>`).join('');

            tooltip.transition()
                .duration(200)
                .style("opacity", "0.9");
            tooltip.html(`
                <h3>${d.name}</h3>
                <p>Date: ${formatDate(d.date)}</p>
                <p>Time in Day: ${timeInDay}</p>
                <p>${d.description}</p>
                <ul>${sourcesList}</ul>
            `)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 28) + "px");
        },
        hideInfo: () => {
            tooltip.transition()
                .duration(500)
                .style("opacity", "0");
        }
    };
}

function createZoomControls(svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>, 
                          zoom: d3.ZoomBehavior<SVGSVGElement, unknown>) {
    const zoomControls = d3.select("#timeline")
        .append("div")
        .attr("class", "zoom-controls");

    zoomControls.append("button")
        .attr("class", "zoom-btn")
        .text("-")
        .on("click", () => zoomBy(0.5));

    zoomControls.append("span")
        .attr("class", "zoom-level")
        .text("100%");

    zoomControls.append("button")
        .attr("class", "zoom-btn")
        .text("+")
        .on("click", () => zoomBy(2));

    function zoomBy(factor: number) {
        svg.transition().duration(300).call(
            (zoom as any).scaleBy,
            factor
        );
    }

    return zoomControls;
}

// Main initialization
d3.json<{ category: string; color: string; file: string }[]>('data/categories.json').then(categoriesConfig => {
    if (!categoriesConfig) {
        console.error('Failed to load categories configuration.');
        return;
    }

    const categories = categoriesConfig.map(c => c.category);
    const colors = categoriesConfig.reduce((acc, c) => ({ ...acc, [c.category]: c.color }), {});

    const loadEvents = categoriesConfig.map(config => 
        d3.json<EventType[] | null>(config.file).then(events => 
            events ? events.map(e => ({ ...e, type: config.category })) : []  // If events is null, return an empty array
        )
    );


    // Once all events are loaded, process and set up the timeline
    Promise.all(loadEvents).then(eventsArrays => {
        const allEvents = eventsArrays.flat();
        const processedEvents = processEventData(allEvents);

        const { svg, width, height } = setupSVG();
        const { x, categoryScale, colorScale, xDay } = setupScales(processedEvents, width, height, categories, colors);
        
        const minDateValue = x.domain()[0];
        const maxDateValue = x.domain()[1];
        const { xAxis, xAxisDay } = setupAxes(svg, x, xDay, height);

        setupCategories(svg, categoryScale, categories);

        const tooltip = createTooltip();
        const eventHandlers = createEventHandlers(tooltip, minDateValue, maxDateValue);

        svg.append("clipPath")
            .attr("id", "chart-area")
            .append("rect")
            .attr("width", width)
            .attr("height", height);

        const chartArea = svg.append("g")
            .attr("clip-path", "url(#chart-area)");

        // Setup zoom behavior
        let currentZoom = d3.zoomIdentity;

        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([1, 1000])
            .translateExtent([[0, 0], [width, height]])
            .extent([[0, 0], [width, height]])
            .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
                currentZoom = event.transform;
                let newX = event.transform.rescaleX(x);

                // Constrain the domain
                let newDomain = newX.domain();
                if (newDomain[0] < minDateValue) {
                    const shift = minDateValue - newDomain[0];
                    newDomain[0] = minDateValue;
                    newDomain[1] += shift;
                }
                if (newDomain[1] > maxDateValue) {
                    const shift = newDomain[1] - maxDateValue;
                    newDomain[1] = maxDateValue;
                    newDomain[0] -= shift;
                }
                newX.domain(newDomain);

                chartArea.selectAll<SVGCircleElement, EventType>(".event")
                    .attr("cx", d => newX(d.dateValue!));

                svg.select<SVGGElement>(".x-axis").call(xAxis.scale(newX) as any);
                svg.select<SVGGElement>(".x-axis-day").call(xAxisDay.scale(newX) as any);

                // Update zoom level display
                const zoomPercentage = Math.round(currentZoom.k * 100);
                d3.select(".zoom-level").text(`${zoomPercentage}%`);
            });

        svg.call(zoom as any);

        createZoomControls(svg, zoom);

        function updateEvents() {
            chartArea.selectAll<SVGCircleElement, EventType>(".event")
                .data(processedEvents)
                .join("circle")
                .attr("class", "event")
                .attr("cx", d => x(d.dateValue!))
                .attr("cy", d => {
                    const baseY = categoryScale(d.type)!;
                    const monthOffset = ((d.date.month - 6.5) / 12) * 50;
                    return baseY + monthOffset;
                })
                .attr("r", 5)
                .attr("fill", d => colorScale(d.type))
                .on("mouseover", eventHandlers.showInfo)
                .on("mouseout", eventHandlers.hideInfo);
        }

        updateEvents();
    });
});
