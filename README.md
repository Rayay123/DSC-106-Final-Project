# Two Climate Futures: Mapping the Warming Gap by 2100

DSC 106 final project by Don Le, Raynard Taneka, and Ethan Lam.

## Research question

How much more warming does a high-emissions future produce than a low-emissions future, and where is the difference largest?

## Main takeaway

Our current takeaway is that the warming gap grows as the emissions scenarios separate, with some of the largest differences appearing near the poles by 2100. We will check that this message stays supported by the data as we build the interactive version.

## Dataset

We are continuing with the CMIP6 climate projections from Project 3. The current files come from the NASA GISS-E2-1-G model and contain monthly near-surface air temperature under three scenarios: SSP1-2.6, SSP2-4.5, and SSP5-8.5. The projections cover 2020 through 2100. Because these are model projections, the page will describe possible futures under different emissions assumptions rather than exact forecasts.

## Prototype direction

The page will begin with the global temperature trend to show when the scenarios separate. The main planned view is a D3 map of the temperature difference between SSP5-8.5 and SSP1-2.6. A year slider will let the reader see how the gap changes from 2020 to 2100. We also plan to use the regional or latitude comparison to explain why the warming gap is not evenly distributed around the world.

The first prototype will focus on temperature. We may return to precipitation later if it adds a clear part to the story, but we do not want to combine unrelated charts just for variety.

## Current repository contents

Right now, the repository contains our proposal and early static figures. The interactive webpage and D3 visualizations have not been built yet.

- `FINAL_PROJECT_PROPOSAL_DRAFT.md` contains the proposal.
- `figures/` contains the exploratory charts created so far.

## Work for the initial prototype

- Create the HTML and CSS structure for the explorable page.
- Prepare a smaller browser-ready temperature dataset.
- Build one D3 visualization with a working year interaction.
- Add a title, legend, labels, and short explanatory text.
- Write the two required prototype reflections.
- Publish the page with GitHub Pages and test the public link.

## Proposed work split

- **Raynard:** page structure, written story, styling, integration, and GitHub Pages checks.
- **Don:** browser-ready data and the main D3 warming-gap map with its year control.
- **Ethan:** supporting D3 chart, annotations, color and label checks, and responsive testing.

We can adjust this split together before implementation begins.
