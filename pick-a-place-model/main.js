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

// "Jump to" places. The alert-marker locations are appended after the map is built
// (see `places` near the bottom), so the list always matches the markers.
const PRESETS = [
  { name: "San Diego", lat: 32.7, lon: -117.2 },
];

// Short explanations for the marked patterns. These describe mechanisms that can
// contribute to a regional pattern; they do not claim that one mechanism explains
// every value in this single-model projection.
const DRYLAND_NOTE = {
  title: "Why can dry land warm more?",
  text: "Land heats faster than the ocean, and dry ground has less water available for evaporative cooling. That leaves more energy to heat the surface and air. Higher evaporative demand and declining soil moisture can strengthen this effect in dry regions, so the high-emissions and low-emissions futures separate more.",
  source: "IPCC: Deserts and semiarid regions",
  url: "https://www.ipcc.ch/report/ar6/wg2/chapter/ccp3/",
};

const SCIENCE_NOTES = {
  "Antarctica": {
    title: "Why can polar warming become amplified?",
    text: "Snow and ice reflect much of the Sun's energy. When they shrink, darker land or ocean absorbs more energy and adds to the warming, which is known as the ice-albedo feedback. Around Antarctica, Southern Ocean heat uptake and circulation also shape where and how quickly that amplification appears.",
    source: "IPCC: Future global climate",
    url: "https://www.ipcc.ch/report/ar6/wg1/chapter/chapter-4/",
  },
  "Canadian Arctic": {
    title: "Why is the Arctic gap so large?",
    text: "The Arctic has several reinforcing feedbacks. Losing reflective snow and sea ice allows more solar energy to be absorbed, while high-latitude atmospheric feedbacks make the extra heat less efficiently released to space. Together these processes help the Arctic warm faster than the global average.",
    source: "IPCC: Future global climate",
    url: "https://www.ipcc.ch/report/ar6/wg1/chapter/chapter-4/",
  },
  "Atlantic Ocean": {
    title: "Why can the North Atlantic show a smaller gap?",
    text: "The Atlantic overturning circulation carries heat northward. In climate-model experiments, a weaker circulation can reduce that heat transport and leave a relative cool patch in the North Atlantic, sometimes called the North Atlantic warming hole. Winds, mixing, and other ocean processes can contribute too, so this pattern should not be attributed to one cause alone.",
    source: "NOAA GFDL: Atlantic circulation and heat transport",
    url: "https://www.gfdl.noaa.gov/research_highlight/on-the-atlantic-extratropical-tropical-teleconnection-in-response-to-external-freshwater-forcing/",
  },
  "Australia": DRYLAND_NOTE,
  "Saudi Arabia": DRYLAND_NOTE,
  "NW Africa": DRYLAND_NOTE,
  "South Africa": DRYLAND_NOTE,
};

const GENERAL_SCIENCE_NOTE = {
  title: "What can shape the gap here?",
  text: "A grid cell's warming gap can reflect several processes, including the contrast between land and ocean, soil moisture, snow or ice, and atmospheric or ocean circulation. This view uses one climate model, so it is better for exploring broad patterns than assigning one exact cause to every selected square. Choose one of the marked locations for an explanation of a well-known regional mechanism.",
};

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

// d3.geoContains is slow (spherical point-in-polygon), and this runs on every mouse move.
// Precompute each country's lat/lon bounding box and only run the exact test on the
// few countries whose box contains the point.
const countryIndex = countries.features.map(feature => ({ feature, bounds: d3.geoBounds(feature) }));

function inBounds([[west, south], [east, north]], lon, lat) {
  if (lat < south || lat > north) return false;
  // west > east means the box crosses the antimeridian (e.g. Russia, Fiji)
  return west <= east ? lon >= west && lon <= east : lon >= west || lon <= east;
}

function countryAt(lat, lon) {
  for (const { feature, bounds } of countryIndex) {
    if (inBounds(bounds, lon, lat) && d3.geoContains(feature, [lon, lat])) return feature.properties.name;
  }
  return null;
}

// Name the ocean (or major enclosed sea) at a point that isn't on land.
// There is no ocean outline data, so this uses simple, approximate boundaries; good for a
// tooltip, not exact near the edges between oceans.
// Enclosed seas come first (rough boxes; only reached for points not on land). The Caspian is
// listed so it isn't mislabeled as an ocean, since it's not inside any country outline.
const SEAS = [
  { name: "Caspian Sea", test: (lat, lon) => lat > 36 && lat < 47.5 && lon > 46 && lon < 55.5 },
  { name: "Black Sea", test: (lat, lon) => lat > 40.5 && lat < 47.5 && lon > 27 && lon < 42 },
  { name: "Mediterranean Sea", test: (lat, lon) => lat >= 30 && lat < 46 && lon > -6 && lon < 37 },
  { name: "Red Sea", test: (lat, lon) => lat > 12.5 && lat < 30 && lon > 32 && lon < 43.5 },
  { name: "Persian Gulf", test: (lat, lon) => lat > 23.5 && lat < 30.5 && lon > 47.5 && lon < 56.5 },
  { name: "Gulf of Mexico", test: (lat, lon) => lat >= 18 && lat < 31 && lon > -98 && lon < -80.5 && !(lat < 21.6 && lon > -90) },
  { name: "Caribbean Sea", test: (lat, lon) => lat > 9 && lat < 22.5 && lon > -89 && lon < -60 && (lon > -84 || lat > 15) },
  { name: "Hudson Bay", test: (lat, lon) => lat > 51 && lat < 64.5 && lon > -95.5 && lon < -77 },
  // Hudson Strait + Ungava Bay: connects Hudson Bay to the Labrador Sea; not open Atlantic
  { name: "Hudson Strait", test: (lat, lon) => lat > 58 && lat < 64.5 && lon >= -77 && lon < -64.5 },
  { name: "Baltic Sea", test: (lat, lon) => lat > 53.5 && lat < 66 && lon > 9.5 && lon < 30.5 && !(lat < 58 && lon < 12) },
];

function waterAt(lat, lon) {
  for (const sea of SEAS) if (sea.test(lat, lon)) return sea.name;
  if (lat >= 66) return "Arctic Ocean";
  if (lat <= -60) return "Southern Ocean";

  // Indian Ocean: east of Africa (20°E south of the Cape), west of Indonesia and Tasmania.
  if (lon >= 20 && lon < 147 && lat < 31) {
    if (lat < -10 || lon < 100) return "Indian Ocean";  // incl. Arabian Sea, Bay of Bengal
    if (lat < -7.5 && lon < 130) return "Indian Ocean";  // south of Java / Lesser Sunda Islands
  }

  // Atlantic vs Pacific: a longitude inside the Americas at this latitude.
  // Water east of it is Atlantic, west of it is Pacific.
  const americas =
    lat < -55 ? -67 :   // Drake Passage: Cape Horn meridian
    lat < -5 ? -70 :
    lat < 8 ? -77 :
    lat < 10 ? -80 :    // Panama
    lat < 14 ? -85 :
    lat < 17 ? -94 :
    -100;
  const atlanticEast = lat < 31 ? 20 : 45;  // Africa's west coast / Europe
  if (lon > americas && lon < atlanticEast) return "Atlantic Ocean";
  if (lon >= 100 || lon <= americas) return "Pacific Ocean";
  return null;
}

// Run a handler at most once per animation frame, with the latest event.
// Mouse/pointer events can fire several times per frame; the extra work is wasted.
function rafThrottle(fn) {
  let pending = null;
  let frame = 0;
  const run = () => {
    frame = 0;
    const event = pending;
    pending = null;
    if (event) fn(event);
  };
  const throttled = event => {
    pending = event;
    if (!frame) frame = requestAnimationFrame(run);
  };
  throttled.flush = () => { if (frame) { cancelAnimationFrame(frame); run(); } };
  throttled.cancel = () => { if (frame) cancelAnimationFrame(frame); frame = 0; pending = null; };
  return throttled;
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

function selectPlace({ name, lat, lon, scienceKey = null }) {
  const cell = cellAt(lat, lon);
  if (!cell) return;
  const country = countryAt(lat, lon);
  scienceKey ??= scienceKeyForCell(cell);  // e.g. any square in the Atlantic warming hole
  current = { name, lat, lon, cell, country, water: country ? null : waterAt(lat, lon), scienceKey };
  updateMapSelection();
  updateLegendMarker(gapOf(cell.late), true);  // purple tick on the color legend
  updateReadout();
  updateScienceNote();
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

// The map itself is drawn in 0..MAP_W × 0..MAP_H. The viewBox extends past that on every side
// (negative origin) to make room for the latitude/longitude axes, so all the map and zoom math
// keeps working in the same coordinates. layoutMapAxes() sets the viewBox.
const mapSvg = d3.select("#map")
  .append("svg")
  .attr("viewBox", `0 0 ${MAP_W} ${MAP_H}`)
  .attr("role", "img")
  .attr("tabindex", -1)  // focusable by script (for Esc), but not in the tab order
  .attr("aria-label", "World map of the end-of-century warming gap, with latitude and longitude axes. Drag a box to zoom in; click a square to see that place's warming over time. Press Escape to zoom out.");

// Zoomed content is clipped to the map frame so it never spills over the axes.
mapSvg.append("clipPath").attr("id", "map-clip")
  .append("rect").attr("width", MAP_W).attr("height", MAP_H);

// Everything that zooms lives in this group.
const zoomG = mapSvg.append("g").attr("clip-path", "url(#map-clip)").append("g");

zoomG.append("path")
  .datum({ type: "Sphere" })
  .attr("class", "sphere")
  .attr("d", geoPath);

// Heatmap as ONE image instead of 3,240 <rect>s. The squares form a regular lon/lat grid and
// the equirectangular projection maps that grid to equal rectangles, so a small canvas with
// one block per square, stretched over the map, draws exactly the same picture. Far fewer
// elements makes zooming and panning much smoother, and there are no seams between squares.
(function drawHeatmap() {
  const PX = 8;  // canvas pixels per square; keeps edges sharp even if a browser smooths the image
  const cols = Math.round(360 / cellLon);
  const rows = Math.round(180 / cellLat);
  const canvas = document.createElement("canvas");
  canvas.width = cols * PX;
  canvas.height = rows * PX;
  const ctx = canvas.getContext("2d");
  for (const cell of data.cells) {
    const col = Math.floor((cell.lon + 180) / cellLon);
    const row = Math.floor((90 - cell.lat) / cellLat);
    ctx.fillStyle = mapColor(gapOf(cell.late));
    ctx.fillRect(col * PX, row * PX, PX, PX);
  }
  const [[x0, y0], [x1, y1]] = geoPath.bounds({ type: "Sphere" });
  zoomG.append("image")
    .attr("class", "heatmap")
    .attr("href", canvas.toDataURL())
    .attr("x", x0).attr("y", y0)
    .attr("width", x1 - x0).attr("height", y1 - y0)
    .attr("preserveAspectRatio", "none");
})();

// All country outlines as a single path (one element instead of 177).
zoomG.append("path")
  .datum(countries)
  .attr("class", "country")
  .attr("d", geoPath);

// Ocean names. Positions are hand-picked open-water spots that stay clear of the alert
// marker labels. The Pacific wraps around the map edge, so it's labeled on both sides.
const OCEANS = [
  { name: "North Pacific Ocean", lon: -150, lat: 25 },
  { name: "South Pacific Ocean", lon: -125, lat: -30 },
  { name: "Pacific Ocean", lon: 165, lat: 12 },
  { name: "North Atlantic Ocean", lon: -40, lat: 42 },
  { name: "South Atlantic Ocean", lon: -15, lat: -28 },
  { name: "Indian Ocean", lon: 78, lat: -22 },
  { name: "Southern Ocean", lon: -120, lat: -60 },
  { name: "Arctic Ocean", lon: 0, lat: 84 },
];

// Drawn around (0, 0) at each ocean's position; applyZoom scales by 1/k so the text stays
// the same size on screen when zooming. Labels ignore the pointer, so the map works underneath.
const oceanLayer = zoomG.append("g").attr("class", "ocean-labels");

// Show/hide toggle for the ocean names.
d3.select("#show-oceans").on("change", event => {
  oceanLayer.style("display", event.target.checked ? null : "none");
});

const oceanLabels = oceanLayer
  .selectAll("text")
  .data(OCEANS.map(o => {
    const [x, y] = projection([o.lon, o.lat]);
    return { ...o, x, y };
  }))
  .join("text")
  .attr("class", "ocean-label")
  .attr("text-anchor", "middle")
  .attr("dy", "0.35em")
  .attr("transform", o => `translate(${o.x}, ${o.y})`)
  .text(o => o.name);

const selectedCell = zoomG.append("rect").attr("class", "selected-cell");
const selectedDot = zoomG.append("circle").attr("class", "selected-dot").attr("r", 4);

// Alert markers: a "!" warning sign pointing at the largest-gap square in each area.
//   label:     shown on the map as "label: +gap"
//   countries: the area is the land of these countries (a square counts if its center is inside)
//   water:     ...or open water with this name (see waterAt)
//   test:      ...or any custom (cell) => boolean
//   region:    rough lat/lon pre-filter so the (slow) outline check only runs on nearby squares
//   side:      which side of the badge the label prefers ("right" by default); it still
//              flips if it would run off the edge of the map
//   pick:      "largest" (default) or "lowest" gap
//   noteWhen:  which squares around the marker share its science note: starting from the
//              marked square, every connected square whose gap passes this test (default:
//              a gap of at least NOTE_GAP, i.e. the deep-red patch around the hotspot)
//   noteInRegion: if true, the note's patch also stays inside `region`
//   noteAlso:  extra squares ([lat, lon] of any point inside them) added to the note's patch
const NOTE_GAP = 3.9;

// Canada's Arctic islands: every piece of Canada's outline except the mainland (the piece with
// the most points) and the southern islands (Newfoundland, Vancouver Island, ...).
const canadianArcticIslands = (() => {
  const parts = countries.features.find(f => f.properties.name === "Canada").geometry.coordinates;
  const mainland = d3.greatest(parts, p => p[0].length);
  return {
    type: "MultiPolygon",
    coordinates: parts.filter(p => p !== mainland && d3.max(p[0], ([, lat]) => lat) > 60),
  };
})();

const ALERT_AREAS = [
  { label: "Antarctica", countries: ["Antarctica"], region: cell => cell.lat < -60 },
  {
    label: "Australia", countries: ["Australia"],
    region: cell => cell.lat < -8 && cell.lat > -45 && cell.lon > 110 && cell.lon < 156,
  },
  {
    label: "Saudi Arabia", countries: ["Saudi Arabia"],
    region: cell => cell.lat > 15 && cell.lat < 33 && cell.lon > 34 && cell.lon < 56,
  },
  {
    // The hotspot spans several countries (Mauritania, Mali, Algeria), so it's labeled by region.
    label: "NW Africa",
    countries: ["Morocco", "W. Sahara", "Algeria", "Tunisia", "Mauritania", "Mali",
      "Senegal", "Gambia", "Guinea-Bissau", "Guinea"],
    region: cell => cell.lat > 8 && cell.lat < 38 && cell.lon > -20 && cell.lon < 12,
    side: "left",  // the right side is crowded by the Saudi Arabia marker
  },
  {
    label: "South Africa", countries: ["South Africa"],
    region: cell => cell.lat < -20 && cell.lat > -36 && cell.lon > 15 && cell.lon < 34,
    side: "left",  // over the South Atlantic, clear of the "Indian Ocean" name
    // Two Botswana squares (+3.0 and +3.3) sit inside the patch, surrounded by squares above
    // the threshold; count them too so the patch has no hole in it.
    noteAlso: [[-21, 23.75], [-21, 26.25]],
  },
  {
    // The Canadian Arctic Archipelago: Canada's Arctic islands plus the channels between them
    // (Parry Channel, Queens Channel, Gulf of Boothia, ...). The largest gap is in the channels
    // between Bathurst, Cornwallis and Devon islands. Its badge is drawn below the square
    // automatically, since the square is too close to the top of the map.
    label: "Canadian Arctic",
    test: cell =>
      d3.geoContains(canadianArcticIslands, [cell.lon, cell.lat]) ||
      (!countryAt(cell.lat, cell.lon) &&
        cell.lat >= 70 && cell.lat <= 80 && cell.lon >= -120 && cell.lon <= -80),
    region: cell => cell.lat > 60 && cell.lon > -125 && cell.lon < -60,
    side: "left",  // the right side is crowded by the Atlantic marker
    // The +4 patch reaches across the whole Arctic (Russia, Alaska, ...), so keep the note to
    // the area around the Canadian Arctic.
    noteWhen: gap => gap >= 4, noteInRegion: true,
  },
  {
    // Water areas use `water` (a name from waterAt) instead of `countries`:
    // a square counts if its center is open water with that name.
    // `pick: "lowest"` marks the smallest gap instead of the largest. Here that's the
    // North Atlantic "warming hole", where high emissions end up cooler than low.
    label: "Atlantic Ocean", water: "Atlantic Ocean", pick: "lowest",
    region: cell => cell.lat > -60 && cell.lat < 66 && cell.lon > -100 && cell.lon < 45,
    noteWhen: gap => gap < 0,  // the whole blue patch (high emissions cooler than low)
  },
];

// Every square connected to `start` (through up/down/left/right neighbors) that passes `keep`.
function connectedCells(start, keep) {
  const found = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const c = queue.pop();
    for (const [dLat, dLon] of [[cellLat, 0], [-cellLat, 0], [0, cellLon], [0, -cellLon]]) {
      const next = cellAt(c.lat + dLat, c.lon + dLon);
      if (next && !found.has(next) && keep(next)) {
        found.add(next);
        queue.push(next);
      }
    }
  }
  return found;
}

const alerts = ALERT_AREAS.map(({
  label, countries: names, water, test, region, side = "right", pick = "largest",
  noteWhen = gap => gap >= NOTE_GAP, noteInRegion = false, noteAlso = [],
}) => {
  const shapes = names ? countries.features.filter(f => names.includes(f.properties.name)) : [];
  const inArea =
    test ? test :
    names ? c => shapes.some(shape => d3.geoContains(shape, [c.lon, c.lat])) :
    c => !countryAt(c.lat, c.lon) && waterAt(c.lat, c.lon) === water;
  const choose = pick === "lowest" ? d3.least : d3.greatest;
  const cell = choose(data.cells.filter(c => region(c) && inArea(c)), c => gapOf(c.late));
  const [x, y] = projection([cell.lon, cell.lat]);
  const place = countryAt(cell.lat, cell.lon) || waterAt(cell.lat, cell.lon);
  // Near the top edge there's no room above the square, so draw the badge below it.
  const below = y < 60;
  // The patch of squares around the marker that share its science note.
  const noteCells = connectedCells(cell, c => noteWhen(gapOf(c.late)) && (!noteInRegion || region(c)));
  for (const [lat, lon] of noteAlso) {
    const extra = cellAt(lat, lon);
    if (extra) noteCells.add(extra);
  }
  return { label, cell, x, y, side, pick, place, below, noteCells };
});

// Clicking anywhere in an alert's patch (not just on its marker) shows that alert's science
// note. The patches don't overlap; if they ever did, the earlier alert in the list wins.
const scienceKeyByCell = new Map();
for (const alert of alerts) {
  for (const cell of alert.noteCells) {
    if (!scienceKeyByCell.has(cell)) scienceKeyByCell.set(cell, alert.label);
  }
}

// The science note that goes with a square, for places picked on the map (not from a preset).
const scienceKeyForCell = cell => scienceKeyByCell.get(cell) ?? null;

// Marker geometry, drawn above the square (or mirrored below it when `below`).
const flipY = (a, v) => (a.below ? -v : v);

const alertLayer = zoomG.append("g").attr("class", "alert-layer");

// Each marker is drawn in screen pixels around (0, 0) = the square's center; applyZoom
// scales it by 1/k so it stays the same size on screen at every zoom level.
const alertMarkers = alertLayer.selectAll("g")
  .data(alerts)
  .join("g")
  .attr("class", "alert-marker")
  .classed("is-lowest", a => a.pick === "lowest")  // blue badge: a low spot, not a hotspot
  .attr("transform", a => `translate(${a.x}, ${a.y})`);

alertMarkers.append("path")  // leader line + arrowhead pointing at the square
  .attr("class", "alert-leader")
  .attr("d", a => `M0,${flipY(a, -27)} V${flipY(a, -5)} ` +
    `M-4,${flipY(a, -10)} L0,${flipY(a, -4)} L4,${flipY(a, -10)}`);

// Warning triangle (always point-up, so it reads as a warning sign either way)
alertMarkers.append("path")
  .attr("class", "alert-badge")
  .attr("d", a => a.below ? "M0,27 L14,52 L-14,52 Z" : "M0,-52 L14,-27 L-14,-27 Z");

alertMarkers.append("text")
  .attr("class", "alert-bang")
  .attr("y", a => (a.below ? 48 : -31))
  .attr("text-anchor", "middle")
  .text("!");

const alertLabels = alertMarkers.append("text")
  .attr("class", "alert-label")
  .attr("y", a => (a.below ? 45 : -34))
  .text(a => `${a.label}: ${signed(gapOf(a.cell.late))}`)
  // Measure once now: measuring text forces a layout, too costly to repeat every zoom frame.
  .each(function (a) { a.labelWidth = this.getComputedTextLength(); });

// Put each label on its preferred side of the badge, switching sides if it would run off
// the map edge. Only touches the DOM when a label actually changes side.
function placeAlertLabels(t) {
  alertLabels.each(function (a) {
    const sx = t.applyX(a.x);
    const fitsRight = sx + 18 + a.labelWidth <= MAP_W - 4;
    const fitsLeft = sx - 18 - a.labelWidth >= 4;
    const left = a.side === "left" ? fitsLeft || !fitsRight : !fitsRight;
    if (left === a.onLeft) return;
    a.onLeft = left;
    d3.select(this)
      .attr("x", left ? -18 : 18)
      .attr("text-anchor", left ? "end" : "start");
  });
}
placeAlertLabels(d3.zoomIdentity);

// Show/hide toggle. Hidden markers get no pointer events, so clicks fall through to the map.
d3.select("#show-alerts").on("change", event => {
  alertLayer.style("display", event.target.checked ? null : "none");
  hideTooltip();
});

// The drag-to-zoom box sits above the zoomed group, in screen (viewBox) space.
const zoomBrush = mapSvg.append("rect").attr("class", "zoom-brush").style("display", "none");

// ---------------------------------------------------------------------------
// Map zoom
// ---------------------------------------------------------------------------
const MAX_ZOOM = 12;       // ~12 squares across at the deepest zoom
const CLICK_ZOOM = 4;      // zoom level for the first click on an unzoomed map
const DRAG_THRESHOLD = 5;  // screen pixels before a press counts as a drag

let shownZoom = d3.zoomIdentity;   // transform currently on screen (updates during animation)
let targetZoom = d3.zoomIdentity;  // transform we are animating toward

const resetZoomButton = d3.select("#zoom-reset").on("click", () => zoomTo(d3.zoomIdentity));

// Build a transform from scale k and translation (tx, ty), kept inside the map edges.
function clampedTransform(k, tx, ty) {
  k = Math.max(1, Math.min(MAX_ZOOM, k));
  tx = Math.min(0, Math.max(MAP_W - k * MAP_W, tx));
  ty = Math.min(0, Math.max(MAP_H - k * MAP_H, ty));
  return d3.zoomIdentity.translate(tx, ty).scale(k);
}

// Build a transform at scale k centered on map point (cx, cy).
function centeredTransform(k, cx, cy) {
  k = Math.max(1, Math.min(MAX_ZOOM, k));
  return clampedTransform(k, MAP_W / 2 - k * cx, MAP_H / 2 - k * cy);
}

// d3.interpolateZoom works on [centerX, centerY, width] views.
const toView = t => [(MAP_W / 2 - t.x) / t.k, (MAP_H / 2 - t.y) / t.k, MAP_W / t.k];
const fromView = ([cx, cy, w]) => {
  const k = MAP_W / w;
  return d3.zoomIdentity.translate(MAP_W / 2 - k * cx, MAP_H / 2 - k * cy).scale(k);
};

function applyZoom(t) {
  shownZoom = t;
  zoomG.attr("transform", t.toString());
  selectedDot.attr("r", 4 / t.k);  // keep the dot the same size on screen
  alertMarkers.attr("transform", a => `translate(${a.x}, ${a.y}) scale(${1 / t.k})`);
  oceanLabels.attr("transform", o => `translate(${o.x}, ${o.y}) scale(${1 / t.k})`);
  placeAlertLabels(t);
  updateMapAxes(t);
}

// ---------------------------------------------------------------------------
// Latitude / longitude axes around the map
// ---------------------------------------------------------------------------
// The map SVG scales with its box, which would shrink the axis text along with the map. So
// the axes are drawn in screen pixels: the axis layer is scaled by 1/s (s = screen pixels per
// map unit) and the margins are added to the viewBox in map units (pixels / s).
const AXIS_MARGIN = { top: 8, right: 22, bottom: 38, left: 52 };  // screen pixels
let mapPxScale = 1;  // s: screen pixels per map unit

const lonScale = d3.scaleLinear().domain([-180, 180])
  .range([projection([-180, 0])[0], projection([180, 0])[0]]);
const latScale = d3.scaleLinear().domain([90, -90])
  .range([projection([0, 90])[1], projection([0, -90])[1]]);

const mapAxisLayer = mapSvg.append("g").attr("class", "map-axes").attr("aria-hidden", "true");
const lonAxisG = mapAxisLayer.append("g").attr("class", "axis map-axis");
const latAxisG = mapAxisLayer.append("g").attr("class", "axis map-axis");
const lonTitle = mapAxisLayer.append("text").attr("class", "axis-title").attr("text-anchor", "middle")
  .text("Longitude");
const latTitle = mapAxisLayer.append("text").attr("class", "axis-title").attr("text-anchor", "middle")
  .text("Latitude");

const lonLabel = d => (d === 0 || Math.abs(d) === 180 ? `${Math.abs(d)}°` : `${Math.abs(d)}°${d < 0 ? "W" : "E"}`);
const latLabel = d => (d === 0 ? "0°" : `${Math.abs(d)}°${d < 0 ? "S" : "N"}`);

// Ticks at "round" degree steps (…, 10, 15, 30, 60, 90) instead of d3's 1-2-5 steps, so the
// whole world reads 180°W, 120°W, 60°W, 0°, … rather than 150°W, 100°W, …
const DEGREE_STEPS = [0.5, 1, 2, 2.5, 5, 10, 15, 20, 30, 60, 90];
function degreeTicks([a, b], maxTicks) {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  const step = DEGREE_STEPS.find(s => (hi - lo) / s <= maxTicks) ?? 90;
  const ticks = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) ticks.push(+v.toFixed(2));
  return ticks;
}

function updateMapAxes(t = shownZoom) {
  const s = mapPxScale;
  const W = MAP_W * s, H = MAP_H * s;
  // Visible part of each scale at this zoom, stretched over the axis in screen pixels.
  const lon = t.rescaleX(lonScale).range(lonScale.range().map(v => v * s));
  const lat = t.rescaleY(latScale).range(latScale.range().map(v => v * s));
  const visibleLon = [lon.invert(0), lon.invert(W)].map(v => Math.max(-180, Math.min(180, v)));
  const visibleLat = [lat.invert(0), lat.invert(H)].map(v => Math.max(-90, Math.min(90, v)));

  lonAxisG.attr("transform", `translate(0, ${H})`)
    .call(d3.axisBottom(lon).tickValues(degreeTicks(visibleLon, Math.max(3, W / 75)))
      .tickFormat(lonLabel).tickSizeOuter(0));
  latAxisG
    .call(d3.axisLeft(lat).tickValues(degreeTicks(visibleLat, Math.max(3, H / 45)))
      .tickFormat(latLabel).tickSizeOuter(0));
  // The axis line spans the map frame, not the (zoomed) world outline.
  lonAxisG.select(".domain").attr("d", `M0,0H${W}`);
  latAxisG.select(".domain").attr("d", `M0,0V${H}`);
}

// Fit the axes to the map's current on-screen width (layout changes, window resize).
function layoutMapAxes() {
  const width = mapSvg.node().getBoundingClientRect().width;
  if (!width) return;
  const M = AXIS_MARGIN;
  const s = Math.max(0.05, (width - M.left - M.right) / MAP_W);
  mapPxScale = s;
  mapSvg.attr("viewBox", [
    -M.left / s, -M.top / s,
    MAP_W + (M.left + M.right) / s, MAP_H + (M.top + M.bottom) / s,
  ].join(" "));
  mapAxisLayer.attr("transform", `scale(${1 / s})`);
  lonTitle.attr("x", (MAP_W * s) / 2).attr("y", MAP_H * s + M.bottom - 4);
  latTitle.attr("transform", `translate(${-M.left + 12}, ${(MAP_H * s) / 2}) rotate(-90)`);
  updateMapAxes();
}

let mapAxesWidth = 0;
new ResizeObserver(([entry]) => {
  // Only width matters (the height follows from the viewBox), which also avoids a resize loop.
  if (Math.round(entry.contentRect.width) === mapAxesWidth) return;
  mapAxesWidth = Math.round(entry.contentRect.width);
  layoutMapAxes();
}).observe(document.getElementById("map"));
layoutMapAxes();

// Record the zoom we're heading to and update the zoom-dependent UI (cursor, reset button).
function setTargetZoom(t) {
  targetZoom = t;
  const zoomed = t.k > 1;
  mapSvg.classed("is-zoomed", zoomed);
  resetZoomButton.property("hidden", !zoomed);
  if (!zoomed) setFocused(false);  // back to the whole world: give the map its room back
}

function zoomTo(t) {
  setTargetZoom(t);
  zoomG.transition().duration(750).ease(d3.easeCubicInOut)
    .tween("zoom", () => {
      const interp = d3.interpolateZoom(toView(shownZoom), toView(t));
      return u => applyZoom(fromView(interp(u)));
    });
}

// Pointer position in viewBox units, clamped to the map frame.
function pointerScreen(event) {
  const [px, py] = d3.pointer(event, mapSvg.node());
  return [Math.max(0, Math.min(MAP_W, px)), Math.max(0, Math.min(MAP_H, py))];
}

function pointerLatLon(event) {
  const [px, py] = d3.pointer(event, mapSvg.node());
  // Over the axes (outside the map frame): no place there, even if the zoomed world extends past it.
  if (px < 0 || px > MAP_W || py < 0 || py > MAP_H) return null;
  const [mx, my] = shownZoom.invert([px, py]);
  const lonLat = projection.invert([mx, my]);
  if (!lonLat || Math.abs(lonLat[0]) > 180 || Math.abs(lonLat[1]) > 90) return null;
  return { lon: lonLat[0], lat: lonLat[1] };
}

// Active press on the map:
// { mode: "pan" | "box", start: [x, y] in viewBox units (clamped), raw: unclamped start,
//   clientX, clientY, moved, alert, panFrom: transform when panning began }
let drag = null;

// Move the zoomed map so it follows the pointer.
function panTo(event) {
  const [px, py] = d3.pointer(event, mapSvg.node());
  const { panFrom, raw } = drag;
  const t = clampedTransform(panFrom.k, panFrom.x + px - raw[0], panFrom.y + py - raw[1]);
  setTargetZoom(t);
  applyZoom(t);
}

// Scroll-wheel zoom, anchored on the cursor so the spot under it stays put.
// Same speed as d3.zoom: trackpad pinch sends ctrlKey wheel events, so speed those up.
// Wheel events can arrive many times per frame (especially from trackpads), so we add up
// the zoom amount (in powers of 2) and apply it once per frame.
let wheelSteps = 0;

function wheelZoom(event) {
  // Always swallow wheel events over the map so the page never scrolls underneath it,
  // even when fully zoomed out (zooming out further then simply does nothing).
  event.preventDefault();
  if (drag) return;
  const speed = event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002;
  wheelSteps += -event.deltaY * speed * (event.ctrlKey ? 10 : 1);
  applyWheel(event);
}

const applyWheel = rafThrottle(event => {
  const from = shownZoom;
  let k = from.k * Math.pow(2, wheelSteps);
  wheelSteps = 0;
  k = Math.max(1, Math.min(MAX_ZOOM, k));
  if (k < 1.02) k = 1;  // snap the last bit back to the whole world
  if (k === from.k) return;

  const [sx, sy] = d3.pointer(event, mapSvg.node());
  const [mx, my] = from.invert([sx, sy]);
  const t = clampedTransform(k, sx - k * mx, sy - k * my);

  zoomG.interrupt();  // wheel zoom takes over from any running animation
  setTargetZoom(t);
  applyZoom(t);
});

// Registered directly (not via d3's .on) so it can be non-passive and call preventDefault.
mapSvg.node().addEventListener("wheel", wheelZoom, { passive: false });

// The alert (if any) whose marker is under the pointer.
const alertAt = event => {
  const marker = event.target.closest?.(".alert-marker");
  return marker ? d3.select(marker).datum() : null;
};

function zoomToBox([x0, y0], [x1, y1]) {
  const [mx0, my0] = shownZoom.invert([x0, y0]);
  const [mx1, my1] = shownZoom.invert([x1, y1]);
  const w = Math.max(Math.abs(mx1 - mx0), 1e-6);
  const h = Math.max(Math.abs(my1 - my0), 1e-6);
  const k = Math.min(MAP_W / w, MAP_H / h);
  zoomTo(centeredTransform(k, (mx0 + mx1) / 2, (my0 + my1) / 2));
}

// Clicking an alert marker selects the square it points at, not the spot under the badge.
// It also shows that marker's entry in the "Jump to" menu.
function handleMapClick(event, alert) {
  const point = alert ? { lat: alert.cell.lat, lon: alert.cell.lon } : pointerLatLon(event);
  if (!point) return;
  if (alert) {
    presetSelect.property("value", String(places.indexOf(alert.preset)));
    selectPlace(alert.preset);
  } else {
    presetSelect.property("value", "");
    selectPlace({ name: null, ...point });
  }
  // First click on an unzoomed map also zooms in on that spot. Later clicks keep the zoom.
  if (targetZoom.k === 1) {
    const [mx, my] = projection([point.lon, point.lat]);
    zoomTo(centeredTransform(CLICK_ZOOM, mx, my));
  }
  setFocused(true);  // smaller map, bigger chart
}

function endDrag() {
  drag = null;
  zoomBrush.style("display", "none");
  mapSvg.classed("is-panning", false);
}

mapSvg
  .on("pointerdown", event => {
    if (event.button !== 0) return;
    event.preventDefault();  // no text selection / native image drag
    // preventDefault also blocks the usual focus change, so focus the map by hand.
    // Otherwise Esc wouldn't reach this page when it is embedded in an iframe.
    mapSvg.node().focus({ preventScroll: true });
    drag = {
      // Zoomed in: drag pans the map (Shift+drag still draws a zoom box to zoom further).
      // Not zoomed: drag draws a zoom box.
      mode: targetZoom.k > 1 && !event.shiftKey ? "pan" : "box",
      start: pointerScreen(event), raw: d3.pointer(event, mapSvg.node()),
      clientX: event.clientX, clientY: event.clientY, moved: false,
      // Pointer capture retargets pointerup to the svg, so remember now whether we pressed the marker.
      alert: alertAt(event),
    };
    mapSvg.node().setPointerCapture(event.pointerId);
  })
  .on("pointermove", event => mapMove(event))
  .on("pointerup", event => {
    mapMove.flush();  // apply any move still waiting for a frame, so drag state is current
    if (!drag) return;
    const { mode, start, moved, alert } = drag;
    endDrag();
    if (!moved) handleMapClick(event, alert);
    else if (mode === "box") zoomToBox(start, pointerScreen(event));
    // a finished pan needs nothing more: the map is already where the pointer left it
  })
  .on("pointercancel", () => { mapMove.cancel(); endDrag(); })
  .on("pointerleave", () => {
    if (drag) return;
    mapMove.cancel();  // don't let a queued move re-open the tooltip after leaving
    hideTooltip();
  });

// Hover tooltip, drag-to-pan and the zoom box, run at most once per frame.
const mapMove = rafThrottle(event => {
  if (drag) {
    if (!drag.moved &&
        Math.hypot(event.clientX - drag.clientX, event.clientY - drag.clientY) < DRAG_THRESHOLD) return;
    if (!drag.moved && drag.mode === "pan") {
      zoomG.interrupt();          // stop any zoom animation and pan from what's on screen
      drag.panFrom = shownZoom;
      mapSvg.classed("is-panning", true);
    }
    drag.moved = true;
    hideTooltip();
    if (drag.mode === "pan") return panTo(event);
    const [x0, y0] = drag.start;
    const [x1, y1] = pointerScreen(event);
    zoomBrush
      .style("display", null)
      .attr("x", Math.min(x0, x1)).attr("y", Math.min(y0, y1))
      .attr("width", Math.abs(x1 - x0)).attr("height", Math.abs(y1 - y0));
    return;
  }
  const alert = alertAt(event);
  if (alert) {
    showTooltip(event,
      `<strong>${alert.pick === "lowest" ? "Lowest" : "Largest"} gap in ${alert.label}</strong><br>` +
      // For multi-country areas, also say which country the square is in
      `${alert.place !== alert.label ? `${alert.place} · ` : ""}${coords(alert.cell.lat, alert.cell.lon)}<br>` +
      `Gap by 2091–2100: <strong>${signed(gapOf(alert.cell.late))}</strong> ` +
      `(global average ${signed(globalGap)})<br>` +
      `<span style="color:#5c6670">Click to explore this square</span>`);
    return;
  }
  const point = pointerLatLon(event);
  const cell = point && cellAt(point.lat, point.lon);
  if (!cell) return hideTooltip();
  const place = countryAt(point.lat, point.lon) || waterAt(point.lat, point.lon) || "Ocean";
  const hint = targetZoom.k === 1
    ? "Click to zoom in · scroll or drag a box to zoom"
    : "Click to explore · drag to move · scroll to zoom · Esc to zoom out";
  showTooltip(event,
    `<strong>${place}</strong><br>${coords(point.lat, point.lon)}<br>` +
    `Gap by 2091–2100: <strong>${signed(gapOf(cell.late))}</strong><br>` +
    `<span style="color:#5c6670">${hint}</span>`);
});

d3.select(window).on("keydown.mapzoom", event => {
  if (event.key === "Escape") {
    if (drag) endDrag();
    else if (targetZoom.k > 1) zoomTo(d3.zoomIdentity);
  }
});

function updateMapSelection() {
  const box = cellBox(current.cell);
  const [px, py] = projection([current.lon, current.lat]);
  selectedCell.attr("x", box.x).attr("y", box.y).attr("width", box.width).attr("height", box.height);
  selectedDot.attr("cx", px).attr("cy", py);
}

// Map legend: color ramp with two ticks: black for the global-average gap (fixed) and
// purple for the selected place (moves on every selection), plus a small key with both values.
const SELECTED_TICK_COLOR = "#7b3fbf";  // purple: distinct from black and from the red–blue ramp
let updateLegendMarker = () => {};       // set by drawMapLegend; called from selectPlace

(function drawMapLegend() {
  const W = 360;
  const H = 72;
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
    .attr("x", W / 2).attr("y", 9)
    .attr("text-anchor", "middle")
    .attr("fill", "#5c6670").attr("font-size", 11)
    .text("Gap by 2091–2100 (°C), SSP5-8.5 minus SSP1-2.6");

  svg.append("rect")
    .attr("x", 12).attr("y", 20)
    .attr("width", W - 24).attr("height", 10)
    .attr("fill", "url(#gap-gradient)");

  svg.append("g")
    .attr("class", "axis")
    .attr("transform", "translate(0, 30)")
    .call(d3.axisBottom(scale).ticks(7).tickSize(4))
    .call(g => g.select(".domain").remove());

  // Global average: fixed black tick
  svg.append("line")
    .attr("x1", scale(globalGap)).attr("x2", scale(globalGap))
    .attr("y1", 17).attr("y2", 33)
    .attr("stroke", "#1c2128").attr("stroke-width", 1.5);

  // Selected place: purple tick with a small pointer on top, moved by updateLegendMarker
  const selectedTick = svg.append("g").attr("class", "legend-selected");
  selectedTick.append("line")
    .attr("y1", 17).attr("y2", 34)
    .attr("stroke", "#fff").attr("stroke-width", 4.5);   // white halo so it reads on any color
  selectedTick.append("line")
    .attr("y1", 17).attr("y2", 34)
    .attr("stroke", SELECTED_TICK_COLOR).attr("stroke-width", 2.5);
  selectedTick.append("path")
    .attr("d", "M-4.5,12 L4.5,12 L0,17.5 Z")  // pointer, just below the title
    .attr("fill", SELECTED_TICK_COLOR);

  // Key: what each tick means, with its value
  const key = svg.append("g").attr("class", "legend-key").attr("transform", `translate(${W / 2}, ${H - 8})`);
  const globalItem = key.append("g");
  globalItem.append("line").attr("x1", 0).attr("x2", 0).attr("y1", -9).attr("y2", 1)
    .attr("stroke", "#1c2128").attr("stroke-width", 1.5);
  globalItem.append("text").attr("x", 5).attr("font-size", 10.5).attr("fill", "#5c6670")
    .text(`Global average ${signed(globalGap)}`);
  const selectedItem = key.append("g");
  selectedItem.append("line").attr("x1", 0).attr("x2", 0).attr("y1", -9).attr("y2", 1)
    .attr("stroke", SELECTED_TICK_COLOR).attr("stroke-width", 2.5);
  const selectedText = selectedItem.append("text").attr("x", 6).attr("font-size", 10.5)
    .attr("fill", SELECTED_TICK_COLOR).attr("font-weight", 600);

  // Lay out the two key items side by side, centered under the ramp.
  function layoutKey() {
    const gw = globalItem.node().getBBox().width;
    const sw = selectedItem.node().getBBox().width;
    const gapBetween = 16;
    const start = -(gw + gapBetween + sw) / 2;
    globalItem.attr("transform", `translate(${start}, 0)`);
    selectedItem.attr("transform", `translate(${start + gw + gapBetween}, 0)`);
  }

  updateLegendMarker = (gap, animate) => {
    // Keep the tick on the ramp even for values beyond its ends.
    const x = scale(Math.max(-gapLimit, Math.min(gapLimit, gap)));
    selectedTick.transition().duration(animate ? 500 : 0).ease(d3.easeCubicOut)
      .attr("transform", `translate(${x}, 0)`);
    selectedText.text(`Selected place ${signed(gap)}`);
    layoutKey();
  };
})();

// ---------------------------------------------------------------------------
// Readout
// ---------------------------------------------------------------------------
function updateReadout() {
  const { name, lat, lon, cell, country, water } = current;
  // Round first so the numbers in the sentence add up (e.g. 3.4 − 1.5 = 1.9)
  const round1 = v => Math.round(v * 10) / 10;
  const low = round1(cell.late[LOW]);
  const high = round1(cell.late[HIGH]);
  const gap = round1(high - low);
  const title = name || country || water || "Open ocean";
  // Named places only add their country. Coastal cities can fall just offshore in the coarse
  // outlines (San Diego would read "Pacific Ocean"), so don't fall back to the water name.
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

  // Card title bar with the place name.
  d3.select("#chart-title").html(
    `<strong class="place-title">${title}</strong> <span class="place-meta">${meta}</span>`);

  // Full sentence under the title.
  d3.select("#readout").html(
    `By 2091–2100 this square ${verb(high)}${amount(high, SCENARIOS[HIGH])} under high emissions ` +
    `and ${sameDirection ? "" : verb(low)}${amount(low, SCENARIOS[LOW])} under low emissions. ${comparison}`
  );
}

// When the note changes, its text collapses closed, swaps, and opens back up.
// If the new place has the same note (e.g. Australia → Saudi Arabia share the dry-land
// note), it stays open untouched.
//
// The outer box is an invisible placeholder with a fixed height (that of the longest note),
// so the page never gets shorter and longer as notes change; the visible card inside it
// (background, gold edge and text) is what closes and reopens.
const scienceNote = d3.select("#science-note");
const NOTE_CLOSE_MS = 240;  // matches the CSS transition on .science-note-anim
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let shownNote = null;       // the note on screen (or about to be, once it reopens)
let noteSwapTimer = null;

// Built once and kept: .science-note-anim is what collapses (it must persist across note
// changes for its CSS transition to run); .science-note-inner clips the text while it
// shrinks; the padding sits on .science-note-body, since padding itself can't shrink.
scienceNote.html(
  `<div class="science-note-anim"><div class="science-note-inner">` +
  `<div class="science-note-body"></div></div></div>`
);
const scienceNoteBody = scienceNote.select(".science-note-body");

function noteHtml(note) {
  const source = note.url
    ? `<a href="${note.url}" target="_blank" rel="noreferrer">${note.source}</a>`
    : "";
  return `<h3>${note.title}</h3><p>${note.text}</p>${source}`;
}

function renderScienceNote(note) {
  scienceNoteBody.html(noteHtml(note));
}

// Reserve the height of the longest note at the box's current width, by rendering each
// note into an invisible copy of the box and measuring it.
const ALL_NOTES = [...new Set([...Object.values(SCIENCE_NOTES), GENERAL_SCIENCE_NOTE])];
let reservedForWidth = 0;

function reserveNoteHeight() {
  const box = scienceNote.node();
  const width = box.getBoundingClientRect().width;
  if (!width || width === reservedForWidth) return;
  reservedForWidth = width;
  const probe = box.cloneNode(true);
  probe.removeAttribute("id");
  probe.removeAttribute("aria-live");
  probe.classList.remove("is-closed");
  Object.assign(probe.style, {
    position: "absolute", visibility: "hidden", pointerEvents: "none",
    width: `${width}px`, minHeight: "0", left: "0", top: "0",
  });
  box.parentNode.appendChild(probe);
  const probeBody = probe.querySelector(".science-note-body");
  let tallest = 0;
  for (const note of ALL_NOTES) {
    probeBody.innerHTML = noteHtml(note);
    tallest = Math.max(tallest, probe.getBoundingClientRect().height);
  }
  probe.remove();
  scienceNote.style("min-height", `${Math.ceil(tallest)}px`);
}

// Re-measure when the box's width changes (window resize): text wraps differently.
new ResizeObserver(reserveNoteHeight).observe(scienceNote.node());

function updateScienceNote() {
  const note = SCIENCE_NOTES[current.scienceKey] || GENERAL_SCIENCE_NOTE;
  if (note === shownNote) return;  // same explanation: leave it as is
  const firstNote = shownNote === null;
  shownNote = note;

  // First note on page load, or reader prefers reduced motion: just show it.
  if (firstNote || reducedMotion.matches) {
    renderScienceNote(note);
    return;
  }
  // Already closing from a click moments ago: it will reopen with the latest note.
  if (noteSwapTimer) return;

  scienceNote.classed("is-closed", true);
  noteSwapTimer = setTimeout(() => {
    noteSwapTimer = null;
    renderScienceNote(shownNote);
    scienceNote.classed("is-closed", false);
  }, NOTE_CLOSE_MS);
}

// ---------------------------------------------------------------------------
// Line chart
// ---------------------------------------------------------------------------
// The chart lives in a panel beside the map whose width can be changed by dragging the divider. Rather than scaling one fixed drawing (which would shrink the text to
// nothing in the small card), it is laid out at its real pixel size by layoutChart(),
// which re-runs whenever the card changes size.
let CH_W = 960;
let CH_H = 400;
let M = { top: 20, right: 92, bottom: 34, left: 52 };
let compactChart = false;  // small card: tighter margins, fewer ticks, smaller text

// Note: d3.scaleLinear(arr) with ONE argument sets the range, so set the domain explicitly.
// The ranges are set by layoutChart(); y's domain is fitted to each place in updateChart().
const x = d3.scaleLinear().domain([years[0], years[years.length - 1]]);
const y = d3.scaleLinear();

const line = d3.line().x((_, i) => x(years[i])).y(v => y(v));
const band = d3.area().x((_, i) => x(years[i])).y0(d => y(d[0])).y1(d => y(d[1]));

const chartSvg = d3.select("#chart")
  .append("svg")
  .attr("role", "img")
  .attr("aria-label", "Line chart of warming over time at the selected place under three emissions scenarios.");

const gridG = chartSvg.append("g").attr("class", "grid");
const xAxisG = chartSvg.append("g").attr("class", "axis");
const yAxisG = chartSvg.append("g").attr("class", "axis");
const zeroLine = chartSvg.append("line").attr("class", "zero-line");

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
  .attr("dy", "0.35em")
  .attr("fill", s => s.color)
  .text(s => s.label);

const axisTitle = chartSvg.append("text")
  .attr("class", "axis-title")
  .text("Warming since 2015–2024 (°C)");

// Hover layer
const hoverRule = chartSvg.append("line").attr("class", "hover-rule").style("display", "none");
const hoverDots = chartSvg.append("g").selectAll("circle")
  .data(SCENARIOS).join("circle")
  .attr("class", "hover-dot").attr("r", 4).attr("fill", s => s.color)
  .style("display", "none");

const chartHitArea = chartSvg.append("rect")
  .attr("fill", "transparent")
  .on("pointermove", event => chartMove(event))
  .on("pointerleave", () => {
    chartMove.cancel();
    hoverRule.style("display", "none");
    hoverDots.style("display", "none");
    hideTooltip();
  });

// Chart hover, at most once per frame. The handler runs after the event has finished
// dispatching, so pass the chart svg explicitly (event.currentTarget is null by then).
const chartMove = rafThrottle(event => {
  if (!current) return;
  const [px] = d3.pointer(event, chartSvg.node());
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
});

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

// Fit the chart to a w × h pixel box: margins, scale ranges and every positioned element.
function layoutChart(w, h) {
  CH_W = w;
  CH_H = h;
  compactChart = w < 520;
  M = compactChart
    ? { top: 18, right: 66, bottom: 22, left: 34 }
    : { top: 22, right: 92, bottom: 30, left: 48 };

  chartSvg
    .attr("viewBox", `0 0 ${w} ${h}`)
    .attr("width", w)
    .attr("height", h)
    .classed("is-compact", compactChart);

  x.range([M.left, w - M.right]);
  y.range([h - M.bottom, M.top]);

  xAxisG.attr("transform", `translate(0, ${h - M.bottom})`);
  yAxisG.attr("transform", `translate(${M.left}, 0)`);
  gridG.attr("transform", `translate(${M.left}, 0)`);
  zeroLine.attr("x1", M.left).attr("x2", w - M.right);
  endLabels.attr("x", w - M.right + 6);
  axisTitle.attr("x", M.left).attr("y", M.top - 8);
  hoverRule.attr("y1", M.top).attr("y2", h - M.bottom);
  chartHitArea
    .attr("x", M.left).attr("y", M.top)
    .attr("width", Math.max(0, w - M.left - M.right))
    .attr("height", Math.max(0, h - M.top - M.bottom));

  if (current) updateChart(false);
}

// Re-lay out whenever the chart's box changes size (divider drag, window resize).
const chartBox = document.getElementById("chart");
new ResizeObserver(([entry]) => {
  const { width, height } = entry.contentRect;
  if (width > 0 && height > 0 && (Math.round(width) !== CH_W || Math.round(height) !== CH_H)) {
    layoutChart(Math.round(width), Math.round(height));
  }
}).observe(chartBox);
{
  // First layout right away, so the initial place is drawn at the right size.
  const { width, height } = chartBox.getBoundingClientRect();
  if (width > 0 && height > 0) layoutChart(Math.round(width), Math.round(height));
}

function updateChart(animate) {
  const cell = current.cell;
  // The y-axis always fits this place (plus 0 and the global lines, so both stay in view).
  y.domain(placeExtent(cell)).nice();

  const t = chartSvg.transition().duration(animate ? 600 : 0);
  // Fewer ticks when there's less room.
  const xTicks = Math.max(3, Math.min(9, Math.floor((CH_W - M.left - M.right) / 70)));
  const yTicks = Math.max(3, Math.min(6, Math.floor((CH_H - M.top - M.bottom) / 40)));

  xAxisG.call(d3.axisBottom(x).tickFormat(d3.format("d")).ticks(xTicks).tickSizeOuter(0));
  yAxisG.transition(t).call(d3.axisLeft(y).ticks(yTicks).tickFormat(v => `${v}°`));
  gridG.transition(t).call(
    d3.axisLeft(y).ticks(yTicks).tickSize(-(CH_W - M.left - M.right)).tickFormat("")
  );
  gridG.select(".domain").remove();
  zeroLine.transition(t).attr("y1", y(0)).attr("y2", y(0));

  bandPath.transition(t).attr("d", band(cell.ssp126.map((v, i) => [v, cell.ssp585[i]])));
  globalPaths.transition(t).attr("d", s => line(data.global[s.key]));
  seriesPaths.transition(t).attr("d", s => line(cell[s.key]));

  const labels = spreadLabels(
    SCENARIOS.map(s => ({ s, y: y(cell[s.key][cell[s.key].length - 1]) })), compactChart ? 12 : 15);
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
// Chart panel: beside the map, resizable by dragging the divider
// ---------------------------------------------------------------------------
const mapLayout = d3.select("#map-layout");
const chartDivider = d3.select("#chart-resize");

// Width of the chart panel, changed by dragging the divider. The map takes the rest.
const CHART_MIN_W = 260;
const MAP_MIN_SHARE = 0.4;  // the map always keeps at least 40% of the row
// The chart's height grows with its width (like resizing a picture), so dragging the
// divider makes the chart bigger in both directions. The panel may then be taller than
// the map; the map column stays at the top.
// The ratio is high enough that the width-based height always wins over "fill the space beside
// the map" (which shrinks as the map narrows), so every widening also makes the chart taller.
const CHART_ASPECT = 0.88;  // chart height ÷ panel width
const CHART_MIN_H = 180;
const CHART_MAX_H = 300;
let chartWidth = 360;
let chartMaxH = CHART_MAX_H;  // height cap; raised while a place is in focus (see setFocused)
// Narrow screens stack the chart below the map (see CSS), so there's nothing to resize.
const stacked = window.matchMedia("(max-width: 820px)");

const clamp = (v, lo, hi) => Math.max(lo, Math.min(Math.max(lo, hi), v));

function setChartWidth(w, maxH = chartMaxH) {
  const total = mapLayout.node().getBoundingClientRect().width;
  chartWidth = Math.round(clamp(w, CHART_MIN_W, total * (1 - MAP_MIN_SHARE)));
  chartMaxH = maxH;
  mapLayout
    .style("--chart-w", `${chartWidth}px`)
    .style("--chart-min-h", `${Math.round(clamp(chartWidth * CHART_ASPECT, CHART_MIN_H, chartMaxH))}px`);
}

// Focus layout: once a place is selected (and the map zooms in), the map shrinks and the
// chart grows. It stays that way while the map is zoomed in, so clicking other places keeps
// the big chart; zooming back out to the whole world (reset button, Esc, scroll) restores the
// big map. The divider still works in either layout, and each layout remembers its own width.
const FOCUS_CHART_SHARE = 0.55;   // chart's share of the row while focused
const CHART_FOCUS_MAX_H = 420;    // let the chart get taller too, not just wider
const LAYOUT_MS = 750;            // same as the zoom animation, so both move together
let focused = false;
let normalChartWidth = chartWidth;  // chart width to return to when focus ends
let focusChartWidth = null;         // chart width while focused (null: use the default share)

function animateChartLayout(w, maxH) {
  const w0 = chartWidth, h0 = chartMaxH;
  const step = u => setChartWidth(w0 + (w - w0) * u, h0 + (maxH - h0) * u);
  mapLayout.interrupt("layout");
  if (reducedMotion.matches) return step(1);
  mapLayout.transition("layout").duration(LAYOUT_MS).ease(d3.easeCubicInOut)
    .tween("layout", () => step);
}

function setFocused(on) {
  if (on === focused) return;
  focused = on;
  mapLayout.classed("is-focused", on);
  if (on) {
    normalChartWidth = chartWidth;
    const total = mapLayout.node().getBoundingClientRect().width;
    animateChartLayout(focusChartWidth ?? Math.max(chartWidth, total * FOCUS_CHART_SHARE), CHART_FOCUS_MAX_H);
  } else {
    focusChartWidth = chartWidth;
    animateChartLayout(normalChartWidth, CHART_MAX_H);
  }
}

// Drag the divider: moving it left widens the chart, moving it right narrows it.
let divDrag = null;  // { x, startW }

chartDivider
  .on("pointerdown", event => {
    if (event.button !== 0 || stacked.matches) return;
    event.preventDefault();  // no text selection while dragging
    mapLayout.interrupt("layout");  // the drag takes over from a running focus animation
    divDrag = { x: event.clientX, startW: chartWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
    mapLayout.classed("is-resizing", true);
    hideTooltip();
  })
  .on("pointermove", event => moveDivider(event))
  .on("pointerup pointercancel", () => {
    moveDivider.flush();
    divDrag = null;
    mapLayout.classed("is-resizing", false);
  })
  // Keyboard: focus the divider and use the arrow keys.
  .attr("tabindex", 0)
  .on("keydown", event => {
    const step = event.shiftKey ? 60 : 20;
    if (event.key === "ArrowLeft") setChartWidth(chartWidth + step);
    else if (event.key === "ArrowRight") setChartWidth(chartWidth - step);
    else return;
    event.preventDefault();
  });

const moveDivider = rafThrottle(event => {
  if (divDrag) setChartWidth(divDrag.startW - (event.clientX - divDrag.x));
});

// Keep the chart width valid when the page is resized.
new ResizeObserver(() => setChartWidth(chartWidth)).observe(mapLayout.node());

setChartWidth(chartWidth);

// ---------------------------------------------------------------------------
// Preset picker + initial state
// ---------------------------------------------------------------------------
const presetSelect = d3.select("#preset");

// San Diego, then one entry per alert marker (each jumps to the square its marker points at).
for (const alert of alerts) {
  alert.preset = {
    name: `${alert.label} (${alert.pick} gap)`,
    lat: alert.cell.lat,
    lon: alert.cell.lon,
    scienceKey: alert.label,
  };
}
const places = [...PRESETS, ...alerts.map(a => a.preset)];

presetSelect.selectAll("option")
  .data([{ name: "Map selection", value: "" }, ...places.map((p, i) => ({ ...p, value: String(i) }))])
  .join("option")
  .attr("value", d => d.value)
  .property("disabled", d => d.value === "")
  .text(d => d.name);

presetSelect.on("change", event => {
  const preset = places[+event.target.value];
  if (!preset) return;
  selectPlace(preset);
  // Like clicking the map: zoom in on the preset (or, if already zoomed in, pan to it at the
  // same zoom) and switch to the focus layout with the big chart.
  const [mx, my] = projection([preset.lon, preset.lat]);
  zoomTo(centeredTransform(targetZoom.k > 1 ? targetZoom.k : CLICK_ZOOM, mx, my));
  setFocused(true);
});

presetSelect.property("value", "0");
selectPlace(places[0]);
