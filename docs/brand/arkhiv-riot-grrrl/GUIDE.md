# Riot Grrrl Zine Archive — Brand guide

Riot Grrrl Zine Archive: A catalog and reader for preserved Riot Grrrl zines, with source and rights notes retained.

Status: Proposed November 12, 2026 from the product's own site identity, replacing the agent-selected November 4 pack. Awaiting the owner's selection; sample social layouts remain unapproved for publication.

## Where this identity comes from

The pack follows the live site, https://riot-grrrl.subcult.tv/, as observed on 2026-11-12 at revision `d54a96d` of `subculture-collective/arkhiv-riot-grrrl` (`web/src/catalog.css`, the "Cut & Paste" block). The site came first; the earlier pack (plum on cream, two tilted rectangles) did not match it and is replaced. `source/site-observation.json` records the values taken from the site.

## Mark

A serif R on tilted cream paper pasted over a sans G on dark paper, held by a strip of yellow tape: two letters from the site's ransom-letter RIOT GRRRL title. No scanned zine artwork is reused. The letters are set from the bundled fonts and converted to paths. `logos/mark.svg` is the colour version, `mark-mono-dark.svg` is one light colour for dark backgrounds and `mark-mono-light.svg` is one dark colour for light backgrounds. `logos/lockup.svg` is the full ransom-letter title with the "Zine Archive" strip.

- Clear space: one quarter of the mark's height on every side.
- Minimum size: 24 pixels wide on screen. The browser icon is the same mark on the pink ground.
- The colour mark needs a ground that is not cream or ink; use it on the pink. Do not straighten the pieces, add outlines or recolour beyond the three files.
- Do not build artwork from scanned zine pages. Rights for the collection are unknown and no reuse licence is asserted, so every layout here uses drawn paper only.

## Palette

| Name | Colour | Use |
| --- | --- | --- |
| Pink | #f5bed4 | Pink ground of every layout and the icon |
| Ink | #231722 | Copy, dark paper and dark strips |
| Plum | #9b1459 | Plum tags, links and buttons |
| Deep plum | #582d49 | Small credit lines on the pink ground |
| Cream | #f0ebd9 | Cut paper, cards and light type on dark paper |
| Yellow | #e9e889 | Cut paper, tape and eyebrow strips |
| Lilac | #c7b3d6 | Cut paper |

| Text pair | Contrast | Minimum |
| --- | --- | --- |
| Ink on pink | 10.84:1 | 4.5:1 |
| Plum on pink | 5.00:1 | 4.5:1 |
| Deep plum on pink | 7.00:1 | 4.5:1 |
| Ink on cream | 14.45:1 | 4.5:1 |
| Ink on yellow | 13.45:1 | 4.5:1 |
| Ink on lilac | 8.91:1 | 4.5:1 |
| Cream on ink | 14.45:1 | 4.5:1 |
| Yellow on ink | 13.45:1 | 4.5:1 |
| Cream on plum | 6.67:1 | 4.5:1 |

The generator fails the build when a pair falls below its minimum. Yellow and lilac paper carry ink text only.

## Typography

The site uses system font stacks: `"Arial Black", Arial` for headings, `"Courier New", monospace` for labels and copy, and Georgia, Arial and Courier New for the cut letters. Those typefaces are licensed with operating systems and cannot be bundled, and the site ships no font files. Artwork in this pack uses open stand-ins:

- Liberation Serif Bold for the serif cut letters (in place of Georgia).
- Archivo Black for the sans cut letters (in place of Arial Black).
- Liberation Mono, regular and bold, for strips, tags and copy (metric-compatible with Courier New).

All three are under the SIL Open Font License 1.1; the licences are in `fonts/`. Spacing steps: 8, 16, 24, 32, 48, 64 and 96 pixels.

## Layout language

Pink ground, pieces tilted between 1 and 8 degrees, a hard offset shadow instead of a blur, yellow tape across the top of pasted sheets, dashed rules, dark strips with yellow typewriter text. Keep copy level and readable; tilt the paper, not the paragraph.

## Files

`logos/` holds the mark variants and the lockup; `product/` the mark copy, browser icons, the 1440×900 hero and the 1200×630 link preview; `social/` the 1500×500 banner, 1080×1080 square and 512×512 avatar. Layouts marked SAMPLE are not approved for publication. Text in every SVG is converted to paths.

Rebuild only this pack with `python3 studio/brand-tools/remaining_site_packs.py --only arkhiv-riot-grrrl` from the repository root. Do not edit the PNG exports by hand.

## Product relationship

The product repository owns its interface and behavior. This pack supplies identity artwork, icons and link previews; it does not replace product controls, source notices, rights records or color semantics. The application keeps its system font stacks.
