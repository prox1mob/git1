# THE SKETCH LAB — World 08: The Math Playground

An interactive world for learning practical mathematics through sketching, measuring and designing physical products.
Every lesson follows the same order:

**SEE → TOUCH → EXPERIMENT → DISCOVER → UNDERSTAND → CALCULATE → APPLY**

Formulas only appear at the *Calculate* stage, and every symbol is explained in plain words. At any time you can switch the side panel between the **👁 Visual guide** and **🔢 Numbers** (the live arithmetic behind the picture).

## Run it

```bash
cd sketch-lab
npm install
npm run dev        # open the printed URL (add --host to open it from a tablet on the same Wi-Fi)
npm run build      # static site in dist/ — works from any folder (relative paths)
npm test           # unit tests for the maths engines
npm run typecheck
```

Built with React, TypeScript, SVG, Canvas and Three.js. No server is needed. Progress, stars, settings and screen calibration are saved in the browser's local storage.

## What's inside

### Start here (the four priority experiences)
| | Where |
|---|---|
| Interactive angle laboratory (two-scale protractor you can move and rotate, measure-it-yourself mode) | Level 3 |
| Draggable rectangle with live area & perimeter (+ “rectangle of a set area” challenge) | Level 2 |
| Fraction visualiser (bar / circle / triangle / grid, split & merge, compare, number line) | Level 4 |
| Interactive 3D cube (rotate, count faces/edges/vertices, unfold into a net, fill with unit cubes) | Level 9 |

### The 12 levels
1. **Number Sense** — drag-and-drop blocks for adding and taking away, equal groups (multiplication), fair sharing (division with remainders), a 100-square for decimals and percentages. Challenge: pack the parts.
2. **Geometry Playground** — rectangle, points/lines/parallel/perpendicular, triangles & polygons (angle sums, area), circles (roll-the-wheel π discovery, slice-and-rearrange area), symmetry mirror sketching and mirror-line hunting.
3. **Angle Laboratory** — protractor, degrees & radians, angles in products (door, laptop, camera, chair). Challenge: position a mechanical arm, with a sketch-over layer.
4. **Fractions, Ratios & Proportions** — fraction visualiser, “are the parts equal?” (saw kerf), ratios with the diagonal test. Challenge: scale a product sketch in proportion.
5. **Measurement Studio** — mm/cm/m ruler, a movable/rotatable virtual ruler, **screen calibration with a bank card**, scale drawings on A4. Challenge: draw a smartphone to exact dimensions.
6. **Algebra Without Fear** — variables as sliders, patterns → expressions (socket strip), **balance-scale equation solver** with reversible operations. Challenge: balance the mystery.
7. **Coordinate Geometry** — X–Y grid with a target game, distance & midpoint (Pythagoras squares), slope and an interactive grapher (linear, quadratic, sine). Challenge: plot a product outline.
8. **Trigonometry Through Movement** — unit circle drawing sine/cosine waves, right-triangle ratios (similar triangles), heights/ramps/bolt circles. Challenge: measure a tower with a clinometer.
9. **3D Geometry** — cube explorer, solids gallery (cube, cuboid, cylinder, sphere, cone, prism), volume builder, live cross-sections of solids. Challenge: storage container with a set internal volume.
10. **Perspective Mathematics** — a real pin-hole camera model (plan view + picture), horizon and vanishing points. Challenge: construct a box in two-point perspective (with sketch layer).
11. **Curves & Product Forms** — arcs through 3 points, tangents, fillets; Bézier editor with de Casteljau construction, curvature comb and G0/G1/C1/G2 continuity grading. Challenge: match mouse / sneaker / bottle silhouettes.
12. **Applied Product Design Maths** — socket spacing, storage box capacity, camera body at scale, desk-stand angle, gear-pair mechanism, symmetrical enclosure around a circuit board, cardboard prototype material estimate.

### Special modes
- **Sketch-to-Math** — draw a line, triangle, rectangle, circle or polygon. The lab recognises it, measures it (sides, angles, perimeter, area, radius, circumference) and lets you correct it by dragging corners, changing the detected type, squaring it up or making it regular. Every measurement is labelled **approximate**, and the panel says clearly whether a real-world scale is set (grid squares / drawing scale / calibrated screen millimetres).
- **Puzzles** — Fit the Shapes (always-solvable random packings), Build the Bridge (simplified truss simulation with tension/compression colouring), Perfect Perspective (find a box's vanishing points with rulers, then sketch), The Product Engineer (three briefs with live constraint checklists), Curve Master.
- **Toolbox** — links to every working tool.
- **Glossary** — English ↔ Tamil terms; the **தமிழ் terms** switch in the top bar adds Tamil to every maths word in the lessons (tap any dotted word for its meaning).

### Feedback, difficulty, undo
- Mistakes are shown visually (red dimension lines, circled points, hatched areas), then: *what happened → why → one small hint → try again*. The solution is only shown when you ask, with a step-by-step breakdown.
- Easy / Normal / Hard (top bar) changes targets, tolerances and how much help is visible. Drag-and-slide tools have Undo and Reset.
- Touch, mouse and stylus all work (pointer events). The sketch layers use stylus pressure and ignore palm touches once a pen has been used.

### Safety
Electrical (socket board) and load-bearing (bridge, desk stand, phone stand, gears) exercises are labelled as **learning exercises / simplified simulations**, distinct from engineering safety validation.

## Code map
```
src/core/        maths engines (geometry, perspective, Bézier, truss solver, tiling, shape detection) + store, undo history, glossary
src/ui/          lesson flow, feedback & challenges, controls, SVG drag handles, router
src/worlds/      world registry (the Sketch Lab hub)
src/worlds/math/ World 08: registry, map, levels/L01–L12, tools/, puzzles/, sketch/
```
To add another Sketch Lab world, add an entry to `src/worlds/index.ts` and a route in `src/App.tsx`.
