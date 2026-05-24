---
description: How to add parametrizable variables to config.js
---

# Adding Parametrizable Variables to config.js

All numeric/configurable values in the Nube de Universos project must be centralized in `nube_data/config.js`. This keeps the codebase clean and allows easy tuning without touching logic code.

## Steps

1. **Open `nube_data/config.js`** and find the relevant section. The file is organized by feature:
   - `sun` — Central sun visual properties
   - `nucleus` — Category nucleus (sphere size, glow, light)
   - `planet` — Individual planet/tool nodes
   - `orbit` — Orbital motion parameters
   - `layout` — Universe ring radius and spacing
   - `stars` — Starfield count, size, twinkle
   - `camera` — FOV, near/far, initial position, home position, zoom, orbit controls
   - `follow` — Orbital camera mode (distance, speed, sensitivity, maxRotationSpeed)
   - `ship` — Spaceship mode (maxSpeed, acceleration, drag, turnSpeed, boost, throttle, mouse sensitivity)
   - `selection` — Hover/active visual feedback (emissive, scale)
   - `scene` — Fog, ambient light, tone mapping
   - `connections` — Line opacities, glow color, active line width
   - `categoryColors` — Color per category ID (hex)

2. **Add your variable** inside the appropriate section object. Follow the existing format:
   ```js
   variableName:      value,    // short description of what it controls
   ```
   - Use consistent alignment (pad with spaces to column ~20).
   - Always add a comment explaining the variable.
   - Only numeric values, colors (hex `0xRRGGBB`), or simple objects (`{ x, y, z }`) belong here.

3. **Reference it in `nube_universos.js`** via `CFG.section.variableName`. Example:
   ```js
   const speed = CFG.ship.maxSpeed;
   const home = CFG.camera.homePosition;
   ```

4. **Never hardcode numeric values** in `nube_universos.js`. If you find a magic number, extract it to config.

## Rules

- **All values that end in numbers** (sizes, speeds, opacities, distances, multipliers, durations) **must** live in `config.js`.
- **Strings** like URLs or labels can stay in config too (e.g., `dataUrl`).
- **Boolean flags** (like `showAllConnections`) are runtime state and stay in the JS class, not config.
- **Colors** use Three.js hex format: `0xRRGGBB` (not CSS strings).
- **Positions** use `{ x, y, z }` or `{ x, y }` objects.

## Example: Adding a new particle count variable

1. In `config.js`, find or create a `particles` section:
   ```js
   particles: {
       count:          60,       // number of energy particles per burst
       speed:          40,       // min particle speed
       speedRandom:    80,       // random extra speed
       duration:       1.2,      // particle lifetime in seconds
   },
   ```

2. In `nube_universos.js`, reference it:
   ```js
   this.count = CFG.particles.count;
   ```

3. Done — now the value is tunable from config without touching logic.
