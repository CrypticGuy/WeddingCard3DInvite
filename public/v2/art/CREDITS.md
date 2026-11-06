# V2 art credits

Everything here was made for this invitation. No stock images and no real people.

## Generated with Codex

Paintings were generated with the `image_gen` tool of OpenAI Codex CLI 0.160.0 through `codex exec`, with the owner's approval, in November 2026.
Each prompt is the text in `scripts/v2-art/prompts.json` followed by the shared style block in `scripts/v2-art/style.txt`. Prompts describe scenes only. `concept0` and the three `concept-*` paintings served as style references and are not shipped.

Each source was checked to decode as a PNG, looked at by eye, then cut out by `scripts/v2-art/matte.py` (colour un-mixing from white paper, no AI) and written as WebP.

| Source image | Size | Reference | Used for |
|---|---|---|---|
| concept0 | 1774x887 | none | reference only |
| concept-mehendi | 1774x887 | concept0 | reference only |
| concept-haldi | 1774x887 | concept0 | reference only |
| concept-sangeet | 1774x887 | concept0 | reference only |
| wedding-sky | 1774x887 | concept0 | wedding/sky.webp |
| wedding-hills | 1774x887 | concept0 | wedding/hills.webp |
| wedding-subject | 1254x1254 | concept0 | wedding/subject.webp |
| wedding-fg | 2172x724 | concept0 | wedding/fg.webp |
| wedding-flame | 1086x1448 | concept0 | wedding/flame.webp |
| wedding-clouds | 1254x1254 | concept0 | wedding/cloud*.webp |
| petals | 1254x1254 | concept0 | petals/p*.webp |
| mehendi-sky | 1774x887 | concept-mehendi | mehendi/sky.webp |
| haldi-sky | 1774x887 | concept-haldi | haldi/sky.webp |
| sangeet-sky | 1774x887 | concept-sangeet | sangeet/sky.webp |
| mehendi-hills | 1774x887 | concept-mehendi | mehendi/hills.webp |
| haldi-hills | 1774x887 | concept-haldi | haldi/hills.webp |
| sangeet-hills | 1774x887 | concept-sangeet | sangeet/hills.webp |
| mehendi-subject | 1254x1254 | concept-mehendi | mehendi/subject.webp |
| mehendi-swing | 1086x1448 | concept-mehendi | mehendi/swing.webp |
| haldi-subject | 1254x1254 | concept-haldi | haldi/subject.webp |
| haldi-strands | 1254x1254 | concept-haldi | haldi/strand*.webp |
| sangeet-subject | 1254x1254 | concept-sangeet | sangeet/subject.webp |
| sangeet-lanterns | 1254x1254 | concept-sangeet | sangeet/lantern*.webp |
| mehendi-fg | 2172x724 | concept-mehendi | mehendi/fg.webp |
| haldi-fg | 2172x724 | concept-haldi | haldi/fg.webp |
| sangeet-fg | 2172x724 | concept-sangeet | sangeet/fg.webp |
| mehendi-clouds | 1254x1254 | concept-mehendi | mehendi/cloud*.webp |
| haldi-clouds | 1254x1254 | concept-haldi | haldi/cloud*.webp |
| sangeet-clouds | 1254x1254 | concept-sangeet | sangeet/cloud*.webp |
| mehendi-sprig | 1254x1254 | concept-mehendi | mehendi/sprig.webp |
| haldi-sprig | 1254x1254 | concept-haldi | haldi/sprig.webp |
| sangeet-sprig | 1254x1254 | concept-sangeet | sangeet/sprig.webp |
| wedding-sprig | 1254x1254 | concept0 | wedding/sprig.webp |
| paper | 1254x1254 | concept0 | paper.webp |

Directories named `lite/` hold smaller copies of the same paintings for weak devices.

One test, a native-alpha mandap, was rejected for dirty transparency. That is why every layer is painted on white and cut out instead.

## Made in code

- `dog.webp`, `dog-lite.webp`: frames of the 3D beagle in `src/world/beagle.js`, rendered by `scripts/v2-art/bake-dog.mjs` and painted by `scripts/v2-art/paint-dog.py`.
- `noise.webp`, `wipe.webp`: `scripts/v2-art/textures.py`.
