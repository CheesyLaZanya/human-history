/* script.js */

d3.json('data.json').then(function(events) {
    const colorScale = d3.scaleOrdinal()
        .domain(["event", "invention"])
        .range(["#ff7f0e", "#1f77b4"]);

    const margin = {top: 50, right: 50, bottom: 50, left: 50};
    const width = 1000 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3.select("#timeline")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
        .domain([d3.min(events, d => d.date), d3.max(events, d => d.date)])
        .range([0, width]);

    const dayStart = new Date(2024, 0, 1, 0, 0);
    const dayEnd = new Date(2024, 0, 1, 23, 59);
    const totalMinutes = (dayEnd - dayStart) / (1000 * 60);

    const xDay = d3.scaleTime()
        .domain([dayStart, dayEnd])
        .range([0, width]);

    const xAxis = d3.axisBottom(x)
        .tickFormat(d => d < 0 ? Math.abs(d) + " BCE" : d + " CE");

    const xAxisDay = d3.axisTop(xDay)
        .tickFormat(d3.timeFormat("%H:%M"));

    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height})`)
        .call(xAxis);

    svg.append("g")
        .attr("class", "x-axis-day")
        .call(xAxisDay);

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
        .on("zoom", zoomed);

    svg.call(zoom);

    function zoomed(event) {
        currentZoom = event.transform;
        const newX = currentZoom.rescaleX(x);
        const newXDay = currentZoom.rescaleX(xDay);

        chartArea.selectAll(".event")
            .attr("cx", d => newX(d.date));

        svg.select(".x-axis").call(xAxis.scale(newX));
        svg.select(".x-axis-day").call(xAxisDay.scale(newXDay));

        updateZoomLevel();
    }

    function updateEvents() {
        chartArea.selectAll(".event")
            .data(events)
            .join("circle")
            .attr("class", "event")
            .attr("cx", d => x(d.date))
            .attr("cy", height / 2)
            .attr("r", 5)
            .attr("fill", d => colorScale(d.type))
            .on("mouseover", showInfo)
            .on("mouseout", hideInfo);
    }

    const tooltip = d3.select("body").append("div")
        .attr("class", "info-bubble")
        .style("opacity", 0);

    function showInfo(event, d) {
        const timeSinceStart = d.date - d3.min(events, e => e.date);
        const totalTimeSpan = d3.max(events, e => e.date) - d3.min(events, e => e.date);
        const minutesInDay = (timeSinceStart / totalTimeSpan) * totalMinutes;
        const timeInDay = new Date(dayStart.getTime() + minutesInDay * 60000);

        tooltip.transition()
            .duration(200)
            .style("opacity", .9);
        tooltip.html(`
            <h3>${d.name}</h3>
            <p>Date: ${d.date < 0 ? Math.abs(d.date) + " BCE" : d.date + " CE"}</p>
            <p>Time in Day: ${d3.timeFormat("%H:%M")(timeInDay)}</p>
            <p>${d.description}</p>
        `)
            .style("left", (event.pageX) + "px")
            .style("top", (event.pageY - 28 - 100) + "px");
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
