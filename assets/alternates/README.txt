FUNKO PAU — ALTERNATE ARTWORK SPEC

Preferred source file:
- WebP
- 800 x 800 px
- Transparent canvas (alpha)
- sRGB

STANDARDIZED COMPOSITION
Single-figure alternates:
- Subject alpha bounds target: 660 px tall.
- Shared visual baseline: y = 754 on the 800 px canvas.
- Center horizontally.
- Preserve the subject's natural aspect ratio.
- This is the template used by doctor-strange-651.webp and wild-card-570.webp.

Multipacks / wide compositions:
- Center horizontally.
- Shared visual baseline: y = 754.
- Maximum combined subject width target: 700 px.
- Preserve the natural aspect ratio of the full composition.
- Do not artificially stretch figures to reach the single-figure height.
- This is the template used by rocket-megaman.webp.

GENERAL RULES
- One figure/product subject or intentional multipack composition per file.
- Do not include an opaque/white background.
- Do not include the retail box unless the boxed product itself is intentionally the subject.
- Avoid baked-in drop shadows; the app supplies its own presentation shadow.
- Remove white/light matte contamination around cutout edges when converting non-transparent sources.

WHY 800 x 800
Most official Funko artwork entries in this catalog request an 800 x 800 square image.
The app uses object-fit: contain, so a normalized square transparent canvas gives the
most predictable result across collection cards, details and the Universes carousel.

NAMING CONVENTION
  assets/alternates/<catalog-id>.webp
Examples:
  assets/alternates/doctor-strange-651.webp
  assets/alternates/wild-card-570.webp
  assets/alternates/rocket-megaman.webp

LOADING BEHAVIOR
- Alternate artwork is configured through each catalog entry's alternateImageUrl field.
- If a local alternate is configured, the app loads it first.
- If that local file is missing or fails to load, the app falls back to the remote imageUrl.
