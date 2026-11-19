# Two Climate Futures: Mapping the Warming Gap by 2100

DSC 106 final project by Don Le, Raynard Taneka, and Ethan Lam.

## Research question

How much more warming does a high-emissions future produce than a low-emissions future, and where is the difference largest?

## Main takeaway

Our current takeaway is that the warming gap grows as the emissions scenarios separate, with some of the largest differences appearing near the poles by 2100. We will check that this message stays supported by the data as we build the interactive version.

## Dataset

We are continuing with the CMIP6 climate projections from Project 3. The current files come from the NASA GISS-E2-1-G model and contain monthly near-surface air temperature under three scenarios: SSP1-2.6, SSP2-4.5, and SSP5-8.5. The projections cover 2020 through 2100. Because these are model projections, the page will describe possible futures under different emissions assumptions rather than exact forecasts.

## Prototype direction

The main view is a D3 map of the temperature difference between SSP5-8.5 and SSP1-2.6. Readers can choose a marked region or click the map, then use the linked line chart to see how the three scenarios change over time. The marked regions also include short scientific explanations for the patterns shown in the model.

The first prototype will focus on temperature. We may return to precipitation later if it adds a clear part to the story, but we do not want to combine unrelated charts just for variety.

## Current prototype

The main page now includes the project question, an interactive place-based warming comparison, the required prototype reflections, and a short explanation of the data. The visualization lets the reader click a map square or choose a marked location, compare the three emissions scenarios over time, and compare the warming gaps of two selected places.

- `index.html`, `style.css`, and `main.js` contain the main page.
- `pick-a-place-model/` contains the current D3 map, linked line chart, and browser-ready data.
- `FINAL_PROJECT_PROPOSAL_DRAFT.md` contains the proposal.
- `figures/` contains the earlier exploratory charts.

## Next steps

- Decide how the supporting regional chart should fit into the story.
- Test the page on different screen sizes and revise any crowded labels.
- Continue developing the story and final takeaway after receiving prototype feedback.

## Proposed work split

- **Raynard:** page structure, written story, styling, integration, and GitHub Pages checks.
- **Don:** browser-ready data and the main D3 warming-gap map with its year control.
- **Ethan:** supporting D3 chart, annotations, color and label checks, and responsive testing.

We can adjust this split together before implementation begins.
