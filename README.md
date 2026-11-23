# slevinskygra.github.io

Personal research website of Sergi G. Leyva, served by GitHub Pages at <https://slevinskygra.github.io>.

Plain HTML and CSS, no build step: edit a file, commit, push, and GitHub Pages publishes it.

## Pages

| File | Content |
| --- | --- |
| `index.html` | Home: short bio, interactive Fig. 1, research themes, latest news, selected papers |
| `research.html` | Research areas and projects, with figures from the papers |
| `publications.html` | Peer-reviewed articles, with filters by research area |
| `news.html` | News items, newest first |
| `about.html` | Bio, positions, funding, honours, talks, teaching, outreach, contact |
| `404.html` | Page shown for broken links |

Shared files live in `assets/`:

- `assets/css/style.css` for all styles (colours and fonts are set at the top)
- `assets/js/channel.js` for the interactive nanochannel on the home page
- `assets/js/site.js` for the publication filters
- `assets/img/research/` for full-size figures, `assets/img/thumbs/` for small versions
- `assets/Sergi_Granados_CV.pdf` for the downloadable CV
- `assets/fonts/` and `assets/css/fonts.css` for the self-hosted typefaces (STIX Two Text and Instrument Sans, SIL Open Font License), so the site makes no requests to Google Fonts

## Common edits

**Add a news item.** In `news.html`, copy one `<article class="news-item">` block, paste it at the top of the list, and change the `id`, the date (both the visible text and `datetime`), the title and the text. Then update the three items under "News" in `index.html`.

**Add a publication.** In `publications.html`, copy one `<li class="pub">` block into the right year (or add a new `<h2 class="pub-year">` and `<ol class="pubs">` for a new year). Set `data-area` to `nano`, `colloids` or `capillary` so the filters work, update the count in the page header, and add a thumbnail to `assets/img/thumbs/` (about 520 px wide, WebP or PNG).

**Add a page** (for example a future `team.html` or `join.html`): copy `about.html`, replace the content inside `<main>`, and add the link to the `<nav>` list in every page.

**Update the CV.** Replace `assets/Sergi_Granados_CV.pdf`, keeping the same file name.

## Figures

Figures in `research.html` and `publications.html` are adapted from the published papers and credited in their captions.
