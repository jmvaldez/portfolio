#!/usr/bin/env python3
"""Subset IBM Plex Mono into the renamed "Valdez Mono" faces the site ships.

Needs `pip install 'fonttools[woff]' brotli` (brotli backs woff2 output). This
script is NOT run in CI: its five outputs (three woff2 + two TTF) plus
`src/assets/fonts/OFL.txt` are committed straight into the repo (D21,
ticket 13) so a fresh checkout never needs Python at build time.

Source: the hinted woff files under the `@ibm/plex-mono` devDependency
(`node_modules/@ibm/plex-mono/fonts/complete/woff/`). Nothing at runtime
imports that package; it exists only so this script has something to read.

Ticket 13 / map Hazards this encodes:
- pyftsubset's defaults drop `smcp`, `c2sc`, `zero`, `case`, `tnum` — they must
  be requested explicitly via `--layout-features+=`.
- "Plex" is an OFL Reserved Font Name. A subset is a Modified Version, so
  every name-table record naming the family is rewritten to "Valdez Mono"
  (never leaving "Plex" anywhere) before the font is written out.
- Satori (Phase 7's OG image generation) rejects woff2, so Regular and Bold
  are also emitted as plain, unsubsetted-flavor TTF.
"""

from __future__ import annotations

import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "node_modules" / "@ibm" / "plex-mono" / "fonts" / "complete" / "woff"
FONT_DIR = ROOT / "src" / "assets" / "fonts"
OG_DIR = FONT_DIR / "og"

# ticket 13 § Styles and files: the unicode ranges the subset covers.
UNICODES = (
    "U+0020-007E,U+00A0-00FF,U+2010-2027,U+2030-203A,U+20AC,U+2122,"
    "U+2500-257F,U+2580-259F"
)

# ticket 13 / map Hazards: these get stripped by pyftsubset's defaults and
# must be kept explicitly.
LAYOUT_FEATURES = ["smcp", "c2sc", "zero", "case", "tnum"]

# Name table IDs that can carry the family name and must never say "Plex"
# after rewriting (OFL Reserved Font Name "Plex").
FAMILY_NAME_IDS = (1, 3, 4, 6, 16, 17)

VARIANTS = {
    "regular": {
        "source": SOURCE_DIR / "IBMPlexMono-Regular.woff",
        "family": "Valdez Mono",
        "subfamily": "Regular",
        "postscript": "ValdezMono-Regular",
        "og_ttf": True,
    },
    "bold": {
        "source": SOURCE_DIR / "IBMPlexMono-Bold.woff",
        "family": "Valdez Mono",
        "subfamily": "Bold",
        "postscript": "ValdezMono-Bold",
        "og_ttf": True,
    },
    "italic": {
        "source": SOURCE_DIR / "IBMPlexMono-Italic.woff",
        "family": "Valdez Mono",
        "subfamily": "Italic",
        "postscript": "ValdezMono-Italic",
        "og_ttf": False,
    },
}


def rename_family(font: TTFont, family: str, subfamily: str, postscript: str) -> None:
    """Rewrite every family-name-bearing record so "Plex" never appears."""
    name_table = font["name"]
    full_name = family if subfamily == "Regular" else f"{family} {subfamily}"
    replacements = {
        1: family,
        2: subfamily,
        3: f"{full_name};Valdez",
        4: full_name,
        6: postscript,
        16: family,
        17: subfamily,
    }
    for name_id in FAMILY_NAME_IDS:
        if name_id not in replacements:
            continue
        value = replacements[name_id]
        for platform_id, plat_enc_id, lang_id in {
            (n.platformID, n.platEncID, n.langID) for n in name_table.names
        }:
            name_table.setName(value, name_id, platform_id, plat_enc_id, lang_id)


def scrub_remaining_plex(font: TTFont) -> None:
    """Catch-all: some name records (e.g. the trademark notice, ID 7) mention
    "IBM Plex" outside the family-name IDs this script otherwise rewrites.
    The ticket-13 invariant is "no record contains 'Plex' anywhere", so
    replace it wherever it survives rather than only in the family fields.
    """
    name_table = font["name"]
    for record in name_table.names:
        value = record.toUnicode()
        if "Plex" not in value:
            continue
        scrubbed = value.replace("IBM Plex Mono", "Valdez Mono").replace(
            "IBM Plex", "Valdez"
        )
        name_table.setName(
            scrubbed, record.nameID, record.platformID, record.platEncID, record.langID
        )


def assert_scrubbed(path: Path) -> None:
    """Re-open a written font and assert the ticket-13 invariants hold."""
    font = TTFont(str(path))

    names = [str(record) for record in font["name"].names]
    if any("Plex" in value for value in names):
        raise SystemExit(f"{path}: 'Plex' survived in the name table: {names}")

    if "GSUB" in font:
        feature_tags = {
            record.FeatureTag
            for record in font["GSUB"].table.FeatureList.FeatureRecord
        }
        if "zero" not in feature_tags:
            raise SystemExit(f"{path}: 'zero' feature missing from GSUB")
    else:
        raise SystemExit(f"{path}: no GSUB table at all (expected 'zero' feature)")

    cmap = font.getBestCmap()
    if 0x2500 not in cmap:
        raise SystemExit(f"{path}: U+2500 missing from cmap")

    font.close()


def build_subsetter_options() -> subset.Options:
    options = subset.Options()
    options.layout_features.extend(LAYOUT_FEATURES)
    options.hinting = True
    options.name_IDs = ["*"]
    options.name_legacy = True
    options.name_languages = ["*"]
    options.notdef_outline = True
    options.recalc_bounds = True
    options.recalc_timestamp = False
    options.canonical_order = True
    return options


def subset_font(source: Path) -> TTFont:
    font = TTFont(str(source))
    options = build_subsetter_options()
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=subset.parse_unicodes(UNICODES))
    subsetter.subset(font)
    return font


def write_woff2(font: TTFont, family: str, subfamily: str, postscript: str, out_path: Path) -> None:
    rename_family(font, family, subfamily, postscript)
    scrub_remaining_plex(font)
    font.flavor = "woff2"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    font.save(str(out_path))
    assert_scrubbed(out_path)


def write_ttf(source: Path, family: str, subfamily: str, postscript: str, out_path: Path) -> None:
    """Emit an unsubsetted-flavor (plain) TTF for Phase 7's Satori renderer."""
    font = subset_font(source)
    rename_family(font, family, subfamily, postscript)
    scrub_remaining_plex(font)
    font.flavor = None
    out_path.parent.mkdir(parents=True, exist_ok=True)
    font.save(str(out_path))
    assert_scrubbed(out_path)


def main() -> None:
    for key, spec in VARIANTS.items():
        source = spec["source"]
        if not source.exists():
            raise SystemExit(f"missing source font: {source}")

        woff2_font = subset_font(source)
        write_woff2(
            woff2_font,
            spec["family"],
            spec["subfamily"],
            spec["postscript"],
            FONT_DIR / f"valdez-mono-{key}.woff2",
        )

        if spec["og_ttf"]:
            write_ttf(
                source,
                spec["family"],
                spec["subfamily"],
                spec["postscript"],
                OG_DIR / f"valdez-mono-{key}.ttf",
            )

    print("Subset fonts written to", FONT_DIR)


if __name__ == "__main__":
    main()
