d3.json('data.json').then(function(events) {
    // Convert date objects to numeric values
    events.forEach(d => {
        d.dateValue = dateToNumber(d.date);
    });

    const colorScale = d3.scaleOrdinal()
        .domain(["event", "technology", "medicine"])
        .range(["#ff7f0e", "#1f77b4", "#2ca02c"]);

    const margin = {top: 50, right: 50, bottom: 50, left: 100};
    const width = 1000 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3.select("#timeline")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Define x scale as linear scale based on dateValue
    const x = d3.scaleLinear()
        .domain(d3.extent(events, d => d.dateValue))
        .range([0, width]);

    const minDateValue = x.domain()[0];
    const maxDateValue = x.domain()[1];

    // Adjust day scale to include padding
    const dayStart = 0; // Start of day in minutes
    const dayEnd = 24 * 60; // End of day in minutes
    const totalMinutes = dayEnd - dayStart;

    // Map dateValues to minutes in the day
    const xDay = d3.scaleLinear()
        .domain([minDateValue, maxDateValue])
        .range([dayStart, dayEnd]);

    const xAxis = d3.axisBottom(x)
        .tickFormat(d => {
            const date = numberToDate(d);
            const year = date.year;
            if (year < 0) return `${Math.abs(year)} BCE`;
            else return `${year} CE`;
        });

    const xAxisDay = d3.axisTop(x)
        .tickFormat(d => {
            const minutesInDay = xDay(d);
            const hours = Math.floor(minutesInDay / 60);
            const minutes = Math.floor(minutesInDay % 60);
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        });

    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height})`)
        .call(xAxis);

    svg.append("g")
        .attr("class", "x-axis-day")
        .call(xAxisDay);

    // Define y positions for each category
    const categories = ["event", "technology", "medicine"];
    const categoryScale = d3.scalePoint()
        .domain(categories)
        .range([50, height - 50]);

    // Add category labels
    svg.selectAll(".category-label")
        .data(categories)
        .enter()
        .append("text")
        .attr("class", "category-label")
        .attr("x", -margin.left + 10)
        .attr("y", d => categoryScale(d))
        .attr("dy", "0.35em")
        .text(d => d.charAt(0).toUpperCase() + d.slice(1));

    // Add clipping path
    svg.append("clipPath")
        .attr("id", "chart-area")
        .append("rect")
        .attr("width", width)
        .attr("height", height);

    // Create a group for the events and apply the clipping path
    const chartArea = svg.append("g")
        .attr("clip-path", "url(#chart-area)");

    let currentZoom = d3.zoomIdentity;

    const zoom = d3.zoom()
        .scaleExtent([1, 1000])
        .translateExtent([[0, 0], [width, height]])
        .extent([[0, 0], [width, height]])
        .on("zoom", zoomed);

    svg.call(zoom);

    function zoomed(event) {
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

        chartArea.selectAll(".event")
            .attr("cx", d => newX(d.dateValue));

        svg.select(".x-axis").call(xAxis.scale(newX));
        svg.select(".x-axis-day").call(xAxisDay.scale(newX));

        updateZoomLevel();
    }

    function updateEvents() {
        chartArea.selectAll(".event")
            .data(events)
            .join("circle")
            .attr("class", "event")
            .attr("cx", d => x(d.dateValue))
            .attr("cy", d => {
                const baseY = categoryScale(d.type);
                // Offset based on month to reduce overlap
                const monthOffset = ((d.date.month - 6.5) / 12) * 50; // Adjust as needed
                return baseY + monthOffset;
            })
            .attr("r", 5)
            .attr("fill", d => colorScale(d.type))
            .on("mouseover", showInfo)
            .on("mouseout", hideInfo);
    }

    const tooltip = d3.select("body").append("div")
        .attr("class", "info-bubble")
        .style("opacity", 0);

    function showInfo(event, d) {
        const timeSinceStart = d.dateValue - minDateValue;
        const totalTimeSpan = maxDateValue - minDateValue;
        const minutesInDay = (timeSinceStart / totalTimeSpan) * totalMinutes;
        const hours = Math.floor(minutesInDay / 60);
        const minutes = Math.floor(minutesInDay % 60);
        const timeInDay = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

        const dateStr = formatDate(d.date);

        tooltip.transition()
            .duration(200)
            .style("opacity", .9);
        tooltip.html(`
            <h3>${d.name}</h3>
            <p>Date: ${dateStr}</p>
            <p>Time in Day: ${timeInDay}</p>
            <p>${d.description}</p>
        `)
            .style("left", (event.pageX + 15) + "px")
            .style("top", (event.pageY - 28) + "px");
    }

    function hideInfo() {
        tooltip.transition()
            .duration(500)
            .style("opacity", 0);
    }

    // Add zoom controls
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

    function zoomBy(factor) {
        svg.transition().duration(300).call(
            zoom.scaleBy,
            factor
        );
    }

    function updateZoomLevel() {
        const zoomPercentage = Math.round(currentZoom.k * 100);
        d3.select(".zoom-level").text(`${zoomPercentage}%`);
    }

    // Add a background rect to ensure the white background covers the entire SVG
    svg.insert("rect", ":first-child")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .attr("transform", `translate(${-margin.left},${-margin.top})`)
        .attr("fill", "white");

    updateEvents();
});

function dateToNumber(date) {
    let y = date.year;
    let m = date.month;
    let d = date.day;

    // Adjust months and years for negative years
    if (m <= 2) {
        y -= 1;
        m += 12;
    }

    // Julian Day Number calculation
    const A = Math.floor(y / 100);
    const B = y < 0 ? 0 : 2 - A + Math.floor(A / 4); // Adjust for Gregorian calendar start

    const jd = Math.floor(365.25 * (y + 4716)) +
               Math.floor(30.6001 * (m + 1)) +
               d + B - 1524.5;

    return jd;
}

function numberToDate(jd) {
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

function formatDate(date) {
    const { year, month, day } = date;
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthStr = monthNames[month - 1];
    const yearStr = year < 0 ? `${Math.abs(year)} BCE` : `${year} CE`;
    return `${day} ${monthStr} ${yearStr}`;
}
