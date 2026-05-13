# SEQUENCE_DEFS density matrix (B01–B12)

Regenerate the table anytime:

```bash
node scripts/sequence-def-density-audit.mjs
```

Columns: **n** = element count; **cov** = cover-like (`cov`, `bar`, `bench`, `stack`, `crate2`, `cart`); **vert** = vertical (`tall`, `container`, `pipes`, `pil`, `rack`, `ac`, `shelf`); **int** = interact (`console`, `desk`, `forklift`); **haz** / **light** = `haz` / `pend`+`lamp`+`speaker`.

## Targets (spatial AAA rubric)

| Zone   | Target n | Target mix                          |
|--------|----------|-------------------------------------|
| Front  | ≥ 6      | cover + vertical + ≥1 light read  |
| Mid    | ≥ 6      | asymmetry; avoid duplicating B01 pinch blindly |
| Back   | ≥ 5      | framing + grounded cover            |

B01 is the reference bar; B02–B12 are brought up without blocking the **FC east zone-door column (~x≈5)** or **`mid_spine_pinch`** band unless intentionally redesigned.

## Animated props (`dynProps`)

Motion is **not** driven from `SEQUENCE_DEFS` / `ELEMENT_BUILDERS`. `buildLevel` in `src/main.js` pushes entries into `dynProps[]`; `tickDynProps` handles types: `chain`, `chandelier`, `disco`, `fountain`, `fire`, `sculpture`, `fan` (including the neon flicker fan). Do not expect new `SEQUENCE_DEFS` element keys to animate unless `buildLevel` already registers that geometry.

## Snapshot (post-densification pass)

Run the audit script after edits to refresh numbers.
