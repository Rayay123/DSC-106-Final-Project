import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
const SCENARIOS = [
  { key: "ssp126", label: "SSP1-2.6", name: "low emissions", color: "#2b6cb0" },
  { key: "ssp245", label: "SSP2-4.5", name: "middle", color: "#c08a1e" },
  { key: "ssp585", label: "SSP5-8.5", name: "high emissions", color: "#c53030" },
];
const LOW = 0;   // index of SSP1-2.6 in the `late` arrays
const HIGH = 2;  // index of SSP5-8.5

const PRESETS = [
  { name: "San Diego", lat: 32.7, lon: -117.2 },
  { name: "Svalbard (Arctic)", lat: 78.2, lon: 15.6 },
  { name: "North Atlantic Ocean", lat: 46.0, lon: -35.0 },
  { name: "Mumbai", lat: 19.1, lon: 72.9 },
  { name: "Sydney", lat: -33.9, lon: 151.2 },
  { name: "McMurdo Station (Antarctica)", lat: -77.8, lon: 166.7 },
];

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
const [data, countries] = await Promise.all([
  d3.json("data/place-warming.json"),
  d3.json("data/countries.geojson"),
]);

const years = data.years;
const [cellLon, cellLat] = data.cellSize;
const gapOf = values => values[HIGH] - values[LOW];
const globalGap = gapOf(data.global.late);

// Look up a map square from any latitude/longitude.
const cellKey = (lat, lon) => `${Math.floor((lat + 90) / cellLat)},${Math.floor((lon + 180) / cellLon)}`;
const cellsByKey = new Map(data.cells.map(cell => [cellKey(cell.lat, cell.lon), cell]));

function cellAt(lat, lon) {
  const safeLat = Math.max(-89.999, Math.min(89.999, lat));
  const safeLon = ((((lon + 180) % 360) + 360) % 360) - 180;
  return cellsByKey.get(cellKey(safeLat, safeLon));
}

function countryAt(lat, lon) {
  const feature = countries.features.find(f => d3.geoContains(f, [lon, lat]));
  return feature ? feature.properties.name : null;
}

// Same y-range for every place, so places can be compared fairly.
let allMin = 0;
let allMax = 0;
for (const cell of data.cells) {
  for (const s of SCENARIOS) {
    for (const v of cell[s.key]) {
      if (v < allMin) allMin = v;
      if (v > allMax) allMax = v;
    }
  }
}

// ---------------------------------------------------------------------------
// Formatting + tooltip
// ---------------------------------------------------------------------------
const signed = v => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}°C`;
const coords = (lat, lon) =>
  `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? "E" : "W"}`;

const tooltip = d3.select("#tooltip");

function showTooltip(event, html) {
  tooltip.html(html).style("opacity", 1);
  const pad = 14;
  const box = tooltip.node().getBoundingClientRect();
  let left = event.clientX + pad;
  let top = event.clientY + pad;
  if (left + box.width > window.innerWidth) left = event.clientX - box.width - pad;
  if (top + box.height > window.innerHeight) top = event.clientY - box.height - pad;
  tooltip.style("left", `${left}px`).style("top", `${top}px`);
}

function hideTooltip() {
  tooltip.style("opacity", 0);
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let current = null;   // { name, lat, lon, cell, country }

function selectPlace({ name, lat, lon }) {
  const cell = cellAt(lat, lon);
  if (!cell) return;
  current = { name, lat, lon, cell, country: countryAt(lat, lon) };
  updateMapSelection();
  updateReadout();
  updateChart(true);
}

// ---------------------------------------------------------------------------
// Map
// ---------------------------------------------------------------------------
const MAP_W = 960;
const MAP_H = 480;

const projection = d3.geoEquirectangular().fitExtent([[1, 1], [MAP_W - 1, MAP_H - 1]], { type: "Sphere" });
const geoPath = d3.geoPath(projection);

const gapLimit = Math.ceil(d3.max(data.cells, cell => Math.abs(gapOf(cell.late))));
const mapColor = d3.scaleDiverging([-gapLimit, 0, gapLimit], t => d3.interpolateRdBu(1 - t));

function cellBox(cell) {
  const [x0, y0] = projection([cell.lon - cellLon / 2, cell.lat + cellLat / 2]);
  const [x1, y1] = projection([cell.lon + cellLon / 2, cell.lat - cellLat / 2]);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

const mapSvg = d3.select("#map")
  .append("svg")
  .attr("viewBox", `0 0 ${MAP_W} ${MAP_H}`)
  .attr("role", "img")
  .attr("aria-label", "World map of the end-of-century warming gap. Click a square to see that place's warming over time.");

mapSvg.append("path")
  .datum({ type: "Sphere" })
  .attr("class", "sphere")
  .attr("d", geoPath);

mapSvg.append("g")
  .selectAll("rect")
  .data(data.cells)
  .join("rect")
  .each(function (cell) {
    const box = cellBox(cell);
    // +0.5 px overlap hides hairline seams between squares
    d3.select(this)
      .attr("x", box.x)
      .attr("y", box.y)
      .attr("width", box.width + 0.5)
      .attr("height", box.height + 0.5);
  })
  .attr("fill", cell => mapColor(gapOf(cell.late)));

mapSvg.append("g")
  .selectAll("path")
  .data(countries.features)
  .join("path")
  .attr("class", "country")
  .attr("d", geoPath);

const selectedCell = mapSvg.append("rect").attr("class", "selected-cell");
const selectedDot = mapSvg.append("circle").attr("class", "selected-dot").attr("r", 4);

function pointerLatLon(event) {
  const [px, py] = d3.pointer(event);
  const lonLat = projection.invert([px, py]);
  if (!lonLat || Math.abs(lonLat[0]) > 180 || Math.abs(lonLat[1]) > 90) return null;
  return { lon: lonLat[0], lat: lonLat[1] };
}

mapSvg
  .on("pointermove", event => {
    const point = pointerLatLon(event);
    const cell = point && cellAt(point.lat, point.lon);
    if (!cell) return hideTooltip();
    const place = countryAt(point.lat, point.lon) || "Ocean";
    showTooltip(event,
      `<strong>${place}</strong><br>${coords(point.lat, point.lon)}<br>` +
      `Gap by 2091–2100: <strong>${signed(gapOf(cell.late))}</strong><br>` +
      `<span style="color:#5c6670">Click to explore</span>`);
  })
  .on("pointerleave", hideTooltip)
  .on("click", event => {
    const point = pointerLatLon(event);
    if (!point) return;
    presetSelect.property("value", "");
    selectPlace({ name: null, ...point });
  });

function updateMapSelection() {
  const box = cellBox(current.cell);
  const [px, py] = projection([current.lon, current.lat]);
  selectedCell.attr("x", box.x).attr("y", box.y).attr("width", box.width).attr("height", box.height);
  selectedDot.attr("cx", px).attr("cy", py);
}

// Map legend: color ramp with a marker for the global-average gap
(function drawMapLegend() {
  const W = 360;
  const H = 52;
  const scale = d3.scaleLinear([-gapLimit, gapLimit], [12, W - 12]);
  const svg = d3.select("#map-legend").append("svg")
    .attr("viewBox", `0 0 ${W} ${H}`)
    .attr("width", W)
    .style("max-width", "100%");

  const gradient = svg.append("defs").append("linearGradient").attr("id", "gap-gradient");
  gradient.selectAll("stop")
    .data(d3.range(0, 1.0001, 0.1))
    .join("stop")
    .attr("offset", t => `${t * 100}%`)
    .attr("stop-color", t => mapColor(-gapLimit + t * 2 * gapLimit));

  svg.append("text")
    .attr("x", W / 2).attr("y", 11)
    .attr("text-anchor", "middle")
    .attr("fill", "#5c6670").attr("font-size", 11)
    .text("Gap by 2091–2100 (°C), SSP5-8.5 minus SSP1-2.6");

  svg.append("rect")
    .attr("x", 12).attr("y", 17)
    .attr("width", W - 24).attr("height", 10)
    .attr("fill", "url(#gap-gradient)");

  svg.append("g")
    .attr("class", "axis")
    .attr("transform", "translate(0, 27)")
    .call(d3.axisBottom(scale).ticks(7).tickSize(4))
    .call(g => g.select(".domain").remove());

  svg.append("line")
    .attr("x1", scale(globalGap)).attr("x2", scale(globalGap))
    .attr("y1", 14).attr("y2", 30)
    .attr("stroke", "#1c2128").attr("stroke-width", 1.5);
})();

// ---------------------------------------------------------------------------
// Readout
// ---------------------------------------------------------------------------
function updateReadout() {
  const { name, lat, lon, cell, country } = current;
  // Round first so the numbers in the sentence add up (e.g. 3.4 − 1.5 = 1.9)
  const round1 = v => Math.round(v * 10) / 10;
  const low = round1(cell.late[LOW]);
  const high = round1(cell.late[HIGH]);
  const gap = round1(high - low);
  const title = name || country || "Open ocean";
  const meta = [coords(lat, lon), name ? country : null].filter(Boolean).join(" · ");

  let comparison;
  if (gap < 0) {
    comparison = `Unusually, the high-emissions future ends up <strong>${Math.abs(gap).toFixed(1)}°C cooler</strong> here than the low-emissions one. Globally, it is ${globalGap.toFixed(1)}°C warmer.`;
  } else {
    const ratio = gap / globalGap;
    const relation = ratio >= 1.15 ? "larger than" : ratio <= 0.85 ? "smaller than" : "close to";
    comparison = `That gap of <strong>${gap.toFixed(1)}°C</strong> is ${relation} the global average gap of ${globalGap.toFixed(1)}°C.`;
  }

  // "warms +3.4°C" / "cools 0.3°C"; skip the second verb when both go the same way
  const verb = v => (v >= 0 ? "warms " : "cools ");
  const amount = (v, s) =>
    `<strong style="color:${s.color}">${v >= 0 ? signed(v) : `${Math.abs(v).toFixed(1)}°C`}</strong>`;
  const sameDirection = (high >= 0) === (low >= 0);

  d3.select("#readout").html(
    `<strong class="place-title">${title}</strong> <span class="place-meta">${meta}</span><br>` +
    `By 2091–2100 this square ${verb(high)}${amount(high, SCENARIOS[HIGH])} under high emissions ` +
    `and ${sameDirection ? "" : verb(low)}${amount(low, SCENARIOS[LOW])} under low emissions. ${comparison}`
  );
}

// ---------------------------------------------------------------------------
// Line chart
// ---------------------------------------------------------------------------
const CH_W = 960;
const CH_H = 400;
const M = { top: 16, right: 92, bottom: 34, left: 52 };

const x = d3.scaleLinear([years[0], years[years.length - 1]], [M.left, CH_W - M.right]);
const y = d3.scaleLinear([allMin, allMax], [CH_H - M.bottom, M.top]).nice();
const fixedDomain = y.domain();

const line = d3.line().x((_, i) => x(years[i])).y(v => y(v));
const band = d3.area().x((_, i) => x(years[i])).y0(d => y(d[0])).y1(d => y(d[1]));

const chartSvg = d3.select("#chart")
  .append("svg")
  .attr("viewBox", `0 0 ${CH_W} ${CH_H}`)
  .attr("role", "img")
  .attr("aria-label", "Line chart of warming over time at the selected place under three emissions scenarios.");

const gridG = chartSvg.append("g").attr("class", "grid");
const xAxisG = chartSvg.append("g").attr("class", "axis").attr("transform", `translate(0, ${CH_H - M.bottom})`);
const yAxisG = chartSvg.append("g").attr("class", "axis").attr("transform", `translate(${M.left}, 0)`);
const zeroLine = chartSvg.append("line").attr("class", "zero-line").attr("x1", M.left).attr("x2", CH_W - M.right);

const bandPath = chartSvg.append("path").attr("class", "gap-band").attr("fill", SCENARIOS[HIGH].color);

const globalPaths = chartSvg.append("g")
  .selectAll("path")
  .data([SCENARIOS[LOW], SCENARIOS[HIGH]])
  .join("path")
  .attr("class", "series-global")
  .attr("stroke", s => s.color);

const seriesPaths = chartSvg.append("g")
  .selectAll("path")
  .data(SCENARIOS)
  .join("path")
  .attr("class", "series")
  .attr("stroke", s => s.color);

const endLabels = chartSvg.append("g")
  .selectAll("text")
  .data(SCENARIOS)
  .join("text")
  .attr("class", "end-label")
  .attr("x", CH_W - M.right + 8)
  .attr("dy", "0.35em")
  .attr("fill", s => s.color)
  .text(s => s.label);

chartSvg.append("text")
  .attr("x", M.left).attr("y", M.top - 4)
  .attr("fill", "#5c6670").attr("font-size", 12)
  .text("Warming since 2015–2024 (°C)");

// Hover layer
const hoverRule = chartSvg.append("line").attr("class", "hover-rule")
  .attr("y1", M.top).attr("y2", CH_H - M.bottom).style("display", "none");
const hoverDots = chartSvg.append("g").selectAll("circle")
  .data(SCENARIOS).join("circle")
  .attr("class", "hover-dot").attr("r", 4).attr("fill", s => s.color)
  .style("display", "none");

chartSvg.append("rect")
  .attr("x", M.left).attr("y", M.top)
  .attr("width", CH_W - M.left - M.right).attr("height", CH_H - M.top - M.bottom)
  .attr("fill", "transparent")
  .on("pointermove", event => {
    if (!current) return;
    const [px] = d3.pointer(event);
    const year = Math.max(years[0], Math.min(years[years.length - 1], Math.round(x.invert(px))));
    const i = year - years[0];
    const cell = current.cell;

    hoverRule.attr("x1", x(year)).attr("x2", x(year)).style("display", null);
    hoverDots.attr("cx", x(year)).attr("cy", s => y(cell[s.key][i])).style("display", null);

    const rows = SCENARIOS.map(s =>
      `<div class="tt-row"><span style="color:${s.color}">${s.label}</span><strong>${signed(cell[s.key][i])}</strong></div>`).join("");
    const gap = cell.ssp585[i] - cell.ssp126[i];
    const gGap = data.global.ssp585[i] - data.global.ssp126[i];
    showTooltip(event,
      `<strong>${year}</strong> <span style="color:#5c6670">(10-yr mean)</span>${rows}` +
      `<div class="tt-row"><span>Gap here</span><strong>${gap.toFixed(1)}°C</strong></div>` +
      `<div class="tt-row"><span style="color:#5c6670">Global gap</span><span>${gGap.toFixed(1)}°C</span></div>`);
  })
  .on("pointerleave", () => {
    hoverRule.style("display", "none");
    hoverDots.style("display", "none");
    hideTooltip();
  });

const fitToggle = d3.select("#fit-y").on("change", () => updateChart(true));

function placeExtent(cell) {
  const values = SCENARIOS.flatMap(s => cell[s.key]).concat(data.global.ssp126, data.global.ssp585, [0]);
  return d3.extent(values);
}

function spreadLabels(items, minGap) {
  // Push end labels apart so they don't overlap.
  const sorted = [...items].sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].y - sorted[i - 1].y < minGap) sorted[i].y = sorted[i - 1].y + minGap;
  }
  return items;
}

function updateChart(animate) {
  const cell = current.cell;
  y.domain(fitToggle.property("checked") ? placeExtent(cell) : fixedDomain).nice();

  const t = chartSvg.transition().duration(animate ? 600 : 0);

  xAxisG.call(d3.axisBottom(x).tickFormat(d3.format("d")).ticks(9));
  yAxisG.transition(t).call(d3.axisLeft(y).ticks(6).tickFormat(v => `${v}°`));
  gridG.transition(t).call(
    d3.axisLeft(y).ticks(6).tickSize(-(CH_W - M.left - M.right)).tickFormat("")
  ).attr("transform", `translate(${M.left}, 0)`);
  gridG.select(".domain").remove();
  zeroLine.transition(t).attr("y1", y(0)).attr("y2", y(0));

  bandPath.transition(t).attr("d", band(cell.ssp126.map((v, i) => [v, cell.ssp585[i]])));
  globalPaths.transition(t).attr("d", s => line(data.global[s.key]));
  seriesPaths.transition(t).attr("d", s => line(cell[s.key]));

  const labels = spreadLabels(
    SCENARIOS.map(s => ({ s, y: y(cell[s.key][cell[s.key].length - 1]) })), 15);
  endLabels.data(labels.map(l => l.y)).transition(t).attr("y", d => d);
}

// Chart legend (HTML)
d3.select("#chart-legend").html(
  SCENARIOS.map(s =>
    `<span style="color:${s.color}"><i class="swatch-line"></i><span style="color:var(--text)">${s.label} · ${s.name}</span></span>`
  ).join("") +
  `<span><i class="swatch-line swatch-dashed"></i>Global average (low &amp; high)</span>` +
  `<span><i class="swatch-band"></i>Gap between low and high</span>`
);

// ---------------------------------------------------------------------------
// Preset picker + initial state
// ---------------------------------------------------------------------------
const presetSelect = d3.select("#preset");

presetSelect.selectAll("option")
  .data([{ name: "Map selection", value: "" }, ...PRESETS.map((p, i) => ({ ...p, value: String(i) }))])
  .join("option")
  .attr("value", d => d.value)
  .property("disabled", d => d.value === "")
  .text(d => d.name);

presetSelect.on("change", event => {
  const preset = PRESETS[+event.target.value];
  if (preset) selectPlace(preset);
});

presetSelect.property("value", "0");
selectPlace(PRESETS[0]);
