# QOVALX — qovalx.com

Complete rebuild aligned to the approved Founder Decisions. Static HTML, CSS and JavaScript. No framework, no build step, no dependencies. Commit and Cloudflare Pages serves it.

## Structure

```
/index.html          root, detects language and redirects
/ar/index.html       العربية
/en/index.html       English
/ru/index.html       Русский
/zh-Hans/index.html  简体中文
/fr/index.html       Français
/es/index.html       Español
/hi/index.html       हिन्दी
/assets/styles.css
/assets/site.js
/sitemap.xml
/robots.txt
```

## Deploying

Replace the contents of the repository with these files and commit. Cloudflare Pages needs no build command and no output directory beyond the root.

## Assets you must add to `/assets/`

| File | Notes |
|---|---|
| `emblem.png` | The FD-032 globe. **Transparent background required** — the black field is not a brand colour |
| `favicon.png` | From the Primary Logo Mark, not the emblem |
| `audience-professionals.jpg` | 640×400 or larger, 16:10 |
| `audience-agencies.jpg` | " |
| `audience-developers.jpg` | " |
| `audience-investors-buyers.jpg` | " |
| `abudhabi.jpg` | 1680×720, 21:9 |
| `fonts/*.woff2` | IBM Plex subsets, see below |

Until an image exists its container renders as an empty navy panel. Nothing breaks.

### Fonts

Download the OFL packages and place the WOFF2 files in `/assets/fonts/`:

```
IBMPlexSans-Light.woff2         IBMPlexSans-Regular.woff2
IBMPlexSans-Medium.woff2        IBMPlexSans-SemiBold.woff2
IBMPlexSansArabic-Regular.woff2 IBMPlexSansArabic-SemiBold.woff2
IBMPlexSansSC-Regular.woff2     IBMPlexSansDevanagari-Regular.woff2
```

The site falls back to system fonts until these exist, so it works immediately either way.

### Image rules

No text or logos inside any image. No identifiable person presented as a customer or testimonial. No government, airport, railway or developer branding, and nothing implying a partnership that does not exist. Mark generated concept images as non-production assets requiring licensed replacement before wider publication.

## What is aligned to the decisions

Four approved categories, not three. Seven languages, each at its own crawlable URL with `hreflang`. Navy `#011230` throughout with gold restricted to accents, rules, labels and single emphasis. No heading or paragraph set entirely in gold. No emojis in any language. Company status wording present in the footer. No fabricated counters, testimonials or partner claims. Find Matching labelled Coming Soon with a disabled field that generates nothing. QOVALX wrapped in `<bdi>` everywhere so Arabic punctuation holds. Working navigation drawer with Escape, overlay click, focus trap and scroll lock, opening from the correct side in RTL. Keyboard operable throughout with a skip link and visible focus rings.

## Editing content

All text lives in the seven HTML files. To change a string, edit it in each language file. The source of truth for the translations is `qovalx-code/src/locales/*.json` — keep the two in step.

Translations are implementation drafts. All seven need qualified language review before wider promotion.

## Still outstanding

The five legal pages are not built. They need qualified counsel, not code, and the privacy notice depends on retention periods still pending under FD-020. Until they exist, remove the footer legal links or point them at a holding page.

Social links are deliberately absent. Add Instagram, X, LinkedIn, YouTube and TikTok only when a verified destination exists. Facebook optional. Do not invent handles.

Register and Sign in link to paths that do not yet exist. Point them at the contact address or build holding pages before promoting the site.

## Search indexing

If the site goes live before the translations are reviewed, add `<meta name="robots" content="noindex">` to the seven page heads and remove it once reviewed. This prevents an unreviewed version being indexed for months.
