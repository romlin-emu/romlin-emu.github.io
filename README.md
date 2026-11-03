# Romlin website

Static English-language website for [Romlin](https://github.com/romlin-emu/romlin), published at [romlin-emu.github.io](https://romlin-emu.github.io/).

This repository is derived from the [RomP website](https://github.com/RompEmu/RompEmu.github.io). Romlin is a fork of [RomP](https://github.com/RompEmu/RomP) by [Beshr](https://beshr.com), licensed under GPL-3.0-or-later. Existing third-party attribution, copyrights, and font license files are retained. Screenshots show the original RomP release and are identified as upstream previews on the home page.

Serve this directory with any static HTTP server to preview it. The download buttons read the latest release from `romlin-emu/romlin`; downloads become available once a Romlin release is published. Homebrew is disabled until its first release checksum is verified in the [tap](https://github.com/romlin-emu/homebrew-tap).

The editable branding sources are `img/mark.svg` and `img/banner.svg`, shared with the app. The PNG/WebP icons and JPEG social preview are rendered from those vectors.

## Maintenance

GitHub Pages publishes the root of `main` using native branch publishing (`build_type: legacy`, source `main:/`). The public site enforces HTTPS. GitHub manages the dynamic `pages-build-deployment` workflow; there is no checked-in deployment workflow or bundler. These settings were verified on 2026-11-02.

The independent `Site checks` workflow runs one read-only job on pull requests and pushes to `main`. It does **not** gate branch-based Pages deployment: `main` currently has no branch protection or rulesets requiring CI. No Pages settings are changed by this workflow.

Run the same offline checks locally with Python 3.9+ and Node.js 22+ (no packages to install):

```sh
python3 tests/check_links.py
python3 -m unittest discover -s tests -v
node --test tests/downloads.test.cjs
```

The Python checker validates local HTML file links, fragments, image sources/srcsets, inline style URLs, and CSS assets, including root-relative links and directory indexes. It ignores external URLs and makes no network requests. Its fixtures exercise broken references. Node fixtures execute the actual `script.js` in a small DOM stub with mocked release responses, covering platform selection, missing assets, checksum sidecars, and fetch failures. These checks do not replace browser rendering or verification of published release assets. GitHub Actions updates are checked weekly by Dependabot with a seven-day cooldown for new versions.

Ordinary app releases require no site dispatch or rebuild: `script.js` fetches `romlin-emu/romlin/releases/latest` when a visitor loads the home page. Keep the stable release fallback and separate nightly links intact. Homebrew messaging stays disabled until the first release checksum is verified in the tap.
