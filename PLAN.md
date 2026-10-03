# Personal site: plan

## 1. Constraints that shape everything

GitHub Pages serves static files only. That means:

- No server code, no secrets at runtime, no cron. Anything dynamic (Flickr, gig expiry) happens **at build time** in GitHub Actions, or in the browser using public data.
- Free Pages needs a **public repo**. Nothing secret can live in it. API keys go in Actions secrets and are used only during the build.
- Limits: ~1 GB site size, ~100 GB/month soft bandwidth. Not a concern if photos stay on Flickr's CDN.
- No custom headers, no server-side redirects. Use a `404.html` and client-side tricks only.
- Custom domain: a `CNAME` file plus DNS records pointing at GitHub. Use real DNS records (apex `A`/`ALIAS` plus `www` `CNAME`), **not** the registrar's "URL forwarding" product. Forwarding breaks HTTPS and either shows the `github.io` URL or hides the site in an iframe.

Fresh data without a server: a scheduled GitHub Actions workflow (e.g. daily) rebuilds and redeploys the site. Flickr photos and "gigs that have already happened" update on their own.

## 2. Language and stack

**TypeScript + [Astro](https://astro.build)**, deployed with the official `withastro/action` to GitHub Pages.

Why Astro:

- Ships **zero JavaScript by default**. Fast on phones and no framework bloat. The site is mostly content.
- Build-time data fetching in plain TypeScript. This is how the Flickr integration works, with the API key kept out of the browser.
- **Content collections**: albums, gigs and blog posts are typed Markdown/YAML files in the repo, validated by a schema. Adding an album of the week means adding one small file and pushing.
- Islands: interactive pieces (photo filtering) ship a small amount of JS only where needed.
- Markdown/MDX and RSS for the blog are first-class.

Alternatives considered:

| Option | Why not |
|---|---|
| Jekyll | Native to Pages, but Ruby and templating feel dated. Hard to do the Flickr and filtering work nicely. |
| Hugo | Very fast, but Go templates are painful for the interactive and data-driven parts. |
| Next.js static export | Works, but heavier than the content needs. More JS shipped. |
| Plain HTML/JS | No build step, but no content typing and a lot of repeated markup. |

Interactive bits: start with **vanilla TypeScript** (small, no dependency). Move to Preact only if the photo grid state gets unwieldy.

Styling: plain CSS with custom properties (design tokens), CSS Grid, container queries. No Tailwind needed. Light and dark themes via `prefers-color-scheme`.

## 3. Design direction

Taken from the three references:

- **Obscure Sound**: clean cover-art grid, generous whitespace, editorial feel.
- **Pitchfork**: strong typography, large type hierarchy, rating/label metadata, tight card system.
- **Stereofox**: cover art as the hero, colour blocks, easy browsing.

Proposed system:

- **Cover art and photos lead.** The UI stays out of the way.
- Big grotesque or serif headings, a readable sans for body, and a **monospace face for metadata**. The mono face ties in with the git/commit theme and with the developer side of the site.
- One accent colour, mostly neutral surfaces, and a dark mode.
- Mobile-first: single column, big tap targets, sticky bottom or top nav, no hover-only interactions.
- Accessible by default: semantic HTML, contrast, focus states, `alt` text, reduced-motion respect.

## 4. Site map

```
/                     Home: latest album of the week, next gig, favourite photo strip
/music/               Album of the week (commit-history view) + link to gigs
/music/albums/<slug>  Single album page (optional, good for sharing/linking)
/music/gigs/          Gigs I'd love to attend (London)
/photos/              Grid with month + tag filters
/photos/favourites/   The six photos I'm proudest of (also shown on /photos/)
/blog/                Developer blog, in the nav, "coming soon" until posts exist (section 5.4)
/blog/<slug>          Post pages (scaffolded, no posts yet)
/404.html
```

## 5. Sections in detail

### 5.1 Music: album of the week

**Data:** one file per album in `src/content/albums/`, e.g. `2026-09-28-<slug>.md`, with title, artist, week, optional cover image, colour, tags, highlight tracks and Bandcamp/Spotify/Apple Music links. The body is a short blurb.

**Display:** a vertically scrolling grid of square album covers, one per week, newest first.

- Each month is a row, with the latest month at the top and the latest week at its top-left. Up to five weeks sit across a row on wider screens. On phones a row wraps to three covers across.
- The grid runs from the oldest album's week to the newest, so there are no empty rows before the first or after the last album. Weeks with no album in between show as faint empty squares, so gaps in the rhythm are visible.
- Tapping a cover opens the album page: large cover, blurb, standout tracks, streaming links, and previous/next album.
- On desktop, hovering a cover shows the title and artist.
- An album without a cover image gets a generated cover from its colour and the artist's initials.

(An earlier version used a GitHub-style heatmap and commit log. It was replaced by this grid, and the git naming was dropped.)

**Cover art:** fetch from the iTunes Search API or MusicBrainz Cover Art Archive with a small helper script (`npm run add-album`) that creates the file and downloads the image. Images are committed and optimised by Astro at build time, so there is no hotlinking and no runtime API calls.

**Optional later:** a "currently listening" line from Last.fm recent tracks. Last.fm's API accepts a public key, so it can be fetched at build time or client-side. Skipped for v1 so the album of the week stays the focus.

### 5.2 Music: gigs (London focus)

**Reality check:** there is no good free API for this. Dice has no public API for individuals. Songkick closed its API to new users. Ticketmaster and Bandsintown skew mainstream. Scraping would break and may breach terms of service.

**Approach: hand-curated YAML**, because the list is personal anyway:

```yaml
- artist: ...
  venue: Cafe OTO
  area: Dalston
  date: 2026-11-14
  doors: "19:30"
  ticketUrl: https://dice.fm/...
  note: why I want to go
  tags: [jazz, experimental]
```

- Build-time filter drops gigs whose date has passed. The daily rebuild keeps the list fresh.
- Sorted by date, grouped by month. Filter by genre tag and by area. Cards show the venue, date, a "Tickets on Dice" button (and a Bandcamp/artist link).
- - Optional: if Dice offers an affiliate/partner link programme, use it later. Disclose it if so.

### 5.3 Photos (Flickr)

**Integration:** build-time fetch in GitHub Actions using the Flickr REST API (`flickr.people.getPublicPhotos`, with `extras=tags,date_taken,url_m,url_l,description`). The API key is an Actions secret. The output is a typed `photos.json` consumed by Astro. A daily scheduled rebuild picks up new uploads.

- Photos are **hotlinked from Flickr's CDN** with `srcset` (several sizes), `loading="lazy"`, fixed aspect-ratio boxes to avoid layout shift, and an LQIP/dominant-colour placeholder.
- Each photo links back to its Flickr page. The Flickr API terms require this.
- Fallback: if the API call fails, the build reuses the last committed `photos.json` and never publishes an empty gallery.

**UI:**

- Responsive masonry/justified grid. Photos keep their true aspect ratio.
- **Month filter**: a horizontal scrollable "timeline" strip (month chips with counts), grouped headings by month in the grid.
- **Tag filter**: multi-select chips, with counts and a search box. State lives in the URL (`?month=2026-08&tag=street`) so views are shareable. This works fine on a static site.
- Lightbox viewer with swipe, keyboard arrows, and EXIF details (camera/lens/settings, if exposed by the API).
- **Favourites pane: six photos.** The source of truth is a Flickr album named e.g. "Favourites", so curation happens on Flickr (`flickr.photosets.getPhotos`). Shown as a featured 6-up mosaic at the top of `/photos/` and as a strip on the home page.

### 5.4 Developer blog (scaffold only)

The blog is a **visible section of the site** (it has its own nav item) but ships with **no published posts** while the employer check is pending:

- `/blog/` is live in the nav with a "coming soon" state that says what the blog will cover (design patterns I find interesting).
- Astro content collection `blog` with a typed schema (title, date, tags, `draft`, summary). `draft: true` posts are excluded from production builds, so writing a post locally never publishes it by accident.
- Post layout, code highlighting (Shiki), tag pages and RSS feed are scaffolded so the first post is just a Markdown file. Only the blog index page is built out visually now.
- No real posts are written or committed. The first one waits for your go-ahead.
- A single config flag, `blog.published`, controls whether the post list, RSS feed and tag pages are generated. While it is `false`, the `/blog/` page shows only the "coming soon" state.
- Reminder: check the employer's policy on outside writing and IP, and keep posts to general patterns (no proprietary code or internal details).

## 6. Repository layout

```
.github/workflows/deploy.yml     build + deploy to Pages (push, daily cron, manual)
public/CNAME                     custom domain, added once the domain is bought
public/favicon.*
scripts/fetch-flickr.ts          build-time Flickr fetch -> src/data/photos.json
scripts/add-album.ts             helper: create album entry + download cover
src/content/albums|gigs|blog/    typed content collections
src/components/                  Heatmap, CommitEntry, GigCard, PhotoGrid, Lightbox ...
src/layouts/                     Base layout, nav, footer
src/pages/                       routes from section 4
src/styles/                      tokens.css, global.css
```

Repo name: ideally `<username>.github.io` so the site is served from the root. For a project repo the Astro `base` option must be set, otherwise asset paths break. With a custom domain it is served from the root anyway.

## 7. Implementation phases

**Phase 0: Foundations**
Create the GitHub repo, scaffold Astro + TypeScript, set up the deploy workflow, and confirm a "hello world" is live at the `github.io` URL. Add Prettier, ESLint and `astro check`.

**Phase 1: Design system and shell**
Tokens (colour, type scale, spacing), base layout, responsive nav, footer, dark mode, home page skeleton. Review on a phone-width viewport before building more.

**Phase 2: Music, album of the week** (done, with 10 sample albums)
Content schema, `add-album` script, cover grid, album page. Sample entries are lorem-ipsum placeholders to be replaced with real albums.

**Phase 3: Music, gigs** (done)
Schema, month-grouped list, tag/area filters, past-gig pruning, real gigs with ticket links.

**Phase 4: Photos** (done, using Flickr's public feeds because API keys now need Flickr Pro)
Flickr fetch script with fallback, grid, month/tag filtering with URL state, lightbox, favourites album and mosaic.

**Phase 5: Developer blog** (done, unpublished)
Nav item and `/blog/` page with the "coming soon" state, content collection and schema, post layout, Shiki code highlighting, tag pages and RSS behind the `blog.published` flag. No real posts.

**Phase 6: Polish and launch**
- Lighthouse pass (target 95+ on mobile), accessibility audit, real-device testing (iOS Safari + Android Chrome).
- SEO: titles, meta, Open Graph images, sitemap, `robots.txt`.
- Privacy-friendly analytics (GoatCounter or Plausible), optional.
- Buy the domain and set DNS. Add `public/CNAME`. Set the custom domain in repo settings and tick "Enforce HTTPS".

The domain can wait until Phase 6. Everything works on the `github.io` URL meanwhile.

## 8. Inputs

Received:

1. GitHub username `0maks`. Repo `0maks/0maks.github.io`, served from the root.
2. Flickr user `189507686@N05`. Favourites album `72177720335971884`. Both are in `src/site.config.ts`.
3. Site name "Max Exposure".
4. Eight gigs, seeded in `src/data/gigs.json`. Venue and ticket link are still missing for each.
5. No About page. It was removed, and the home page has no intro text.

Still needed:

- Flickr API keys now need a Pro account, so the site uses Flickr's public feeds. They return only the latest ~20 photos, so each fetch is merged into the saved `src/data/photos.json`. Run `npm run photos` now and then and commit the file to keep older photos. Albums listed in `extraAlbumIds` in `src/data/flickr.json` are included too. If you ever get a key, set `FLICKR_API_KEY` and the full API is used.
- A list of 5–10 past albums of the week for Phase 2.
- Venue and Dice link for each gig.

## 9. Risks and open questions

- **Flickr API key**: if it's unavailable, fall back to the public JSON feed (limited to the latest ~20 photos), or paste a one-off export.
- **Gig data is manual.** Fine for a personal list, but it needs some regular upkeep.
- **Flickr hotlinking** relies on their CDN URL formats staying stable, which they have for years.
- **Cover art rights**: covers shown with credit and links to the release are the normal editorial practice, but they remain the labels' images.
- **Blog and employer**: the section is visible but empty on purpose. Publishing the first post waits for the employer check.
