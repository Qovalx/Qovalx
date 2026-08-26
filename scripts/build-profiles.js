#!/usr/bin/env node
/**
 * Builds one page per professional from data/professionals.json.
 *
 *   node scripts/build-profiles.js            write the pages
 *   node scripts/build-profiles.js --check    report what would change, write nothing
 *   node scripts/build-profiles.js --clean    also delete pages whose record is gone
 *
 * Reads professionals/_template.html and writes <locale>/professionals/<slug>.html
 * for every record whose status is "active", once per language that record
 * actually carries. Arabic and English are required so they are always written;
 * the other five appear only where the record has a title or a biography in
 * them, so no page exists that is a silent copy of the English one.
 *
 * A record that is hidden, or removed from the data file, leaves stale pages
 * behind unless --clean is passed.
 *
 * No dependencies: Node's own modules only, in keeping with a repository that
 * has no build step and no package manifest. Every visible label comes from
 * assets/i18n/professionals/<locale>.json, the same files the directory reads,
 * so a wording change lands in both places at once.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data", "professionals.json");
const TEMPLATE = path.join(ROOT, "professionals", "_template.html");
const LOCALES = ["ar", "en", "ru", "zh-Hans", "fr", "es", "hi"];
// The record's field suffix is not always the locale code: the site says
// zh-Hans where the record says zh. Every other pair agrees, which is why the
// one that does not is written down rather than derived.
const FIELD_SUFFIX = { "ar": "ar", "en": "en", "ru": "ru", "zh-Hans": "zh", "fr": "fr", "es": "es", "hi": "hi" };
const ALWAYS = ["ar", "en"];
const RTL = ["ar"];
const FALLBACK = "en";
const outDir = (loc) => path.join(ROOT, loc, "professionals");
const I18N = (loc) => path.join(ROOT, "assets", "i18n", "professionals", loc + ".json");
const REQUIRED = ["name", "title", "bio", "specialisations", "emirates", "languages"];
const SITE = "https://www.qovalx.com";

const args = new Set(process.argv.slice(2));
const CHECK = args.has("--check");
const CLEAN = args.has("--clean");

// ---------------------------------------------------------------- utilities

/**
 * Escapes for HTML text and double-quoted attributes. The data file is edited
 * by hand, so a stray & or < is a matter of when, not if, and an unescaped
 * quote in a name would end an attribute early.
 */
function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

/**
 * JSON-LD sits inside a <script> element, where the HTML parser looks for the
 * literal "</script" before it looks at JSON syntax. Escaping the slash keeps a
 * biography that mentions one from ending the block early.
 */
function jsonLd(object) {
  return JSON.stringify(object, null, 2).replace(/<\/(script)/gi, "<\\/$1");
}

/** Collapses whitespace and cuts on a word boundary, for the meta description. */
function excerpt(text, limit) {
  const flat = String(text || "").replace(/\s+/g, " ").trim();
  if (flat.length <= limit) return flat;
  const cut = flat.slice(0, limit - 1);
  const space = cut.lastIndexOf(" ");
  return (space > limit * 0.6 ? cut.slice(0, space) : cut).replace(/[،,;:.\s]+$/, "") + "…";
}

function isArray(value) {
  return Object.prototype.toString.call(value) === "[object Array]";
}

function list(value) {
  return isArray(value) ? value.filter((x) => typeof x === "string" && x.trim()) : [];
}

/** The i18n placeholder syntax, e.g. "Licensed by {authority}". */
function fill(template, vars) {
  return String(template || "").replace(/\{(\w+)\}/g, (whole, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole);
}

// ------------------------------------------------------------ tiny renderer

/**
 * Three forms, and deliberately no more:
 *   {{#key}}...{{/key}}  keep the block when the value is truthy, else drop it
 *   {{{key}}}            insert already-built HTML
 *   {{key}}              insert an escaped value
 * Sections run first so a dropped block never leaves its placeholders behind.
 */
function render(template, values) {
  // Sections nest: a contact block holds a whatsapp block, a title holds its
  // translation. One pass consumes the outer section and re-emits its body
  // without rescanning it, which leaves the inner markers on the page, so the
  // pass repeats until the text stops changing.
  let out = template;
  for (let pass = 0; pass < 12; pass++) {
    const next = out.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
      (whole, key, body) => (values[key] ? body : ""));
    if (next === out) break;
    out = next;
  }
  out = out.replace(/\{\{\{(\w+)\}\}\}/g, (whole, key) =>
    values[key] == null ? "" : String(values[key]));
  out = out.replace(/\{\{(\w+)\}\}/g, (whole, key) =>
    values[key] == null ? "" : esc(values[key]));

  // Nothing may reach a published page as an unresolved placeholder.
  const leftover = out.match(/\{\{[#/{]?\w+\}?\}\}/);
  if (leftover) throw new Error("unresolved placeholder " + leftover[0]);
  return out;
}

// ------------------------------------------------------------------ content

/** The record's value for one locale, falling back to English in silence. */
function pick(record, base, loc) {
  const value = record[base + "_" + FIELD_SUFFIX[loc]];
  if (value === undefined || value === null || value === "") return record[base + "_" + FALLBACK];
  if (isArray(value) && !value.length) return record[base + "_" + FALLBACK];
  return value;
}

/** True when the record carries this field in this locale's own language. */
function own(record, base, loc) {
  const value = record[base + "_" + FIELD_SUFFIX[loc]];
  if (value === undefined || value === null || value === "") return false;
  return isArray(value) ? value.length > 0 : true;
}

/**
 * A lang attribute, but only when the text shown is not the page's language.
 * Marking the fallback keeps a screen reader and a translator from reading an
 * English sentence as though it were Russian.
 */
function langMark(record, base, loc) {
  return own(record, base, loc) ? "" : ' lang="' + FALLBACK + '" dir="ltr"';
}

function tagList(values) {
  return '<ul class="qx-dir-tags">' +
    values.map((v) => "<li>" + esc(v) + "</li>").join("") + "</ul>";
}

function facts(record, strings, loc) {
  return ["specialisations", "emirates", "languages"]
    .map((base) => [base, list(pick(record, base, loc)), langMark(record, base, loc)])
    .filter(([, values]) => values.length)
    .map(([base, values, mark]) =>
      '<div class="qx-dir-facts"><h3 class="qx-dir-facts-h">' + esc(strings[base + "_heading"]) +
      "</h3><div" + mark + ">" + tagList(values) + "</div></div>")
    .join("\n        ");
}

function badges(record, strings) {
  const out = [];
  // The badge states that QOVALX checked the authorisation. The licence number
  // itself is never published: the page names the authority and nothing more.
  if (record.verified === true) out.push('<span class="badge">' + esc(strings.verified) + "</span>");
  if (record.founding_member === true) out.push('<span class="badge">' + esc(strings.founding_member) + "</span>");
  return out.join(" ");
}

function metaLine(record, strings) {
  const parts = [];
  if (typeof record.experience_years === "number") {
    parts.push(record.experience_years === 1
      ? strings.experience_one
      : fill(strings.experience_many, { n: record.experience_years }));
  }
  if (record.licence_authority) parts.push(fill(strings.licensed_by, { authority: record.licence_authority }));
  if (record.verified === true && record.verified_on) {
    parts.push(fill(strings.verified_on, { date: record.verified_on }));
  }
  return parts.join(" · ");
}

/** Person, in the language of the page it sits on. */
function personSchema(record, loc, canonical) {
  const name = pick(record, "name", loc);
  const schema = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": canonical + "#person",
    name: name,
    url: canonical,
    inLanguage: loc,
  };
  const other = loc === "ar" ? record.name_en : record.name_ar;
  if (other && other !== name) schema.alternateName = other;

  const title = pick(record, "title", loc);
  if (title) schema.jobTitle = title;
  if (record.photo) schema.image = SITE + record.photo;

  const areas = list(pick(record, "emirates", loc));
  if (areas.length) schema.areaServed = areas.map((n) => ({ "@type": "AdministrativeArea", name: n }));
  const languages = list(pick(record, "languages", loc));
  if (languages.length) schema.knowsLanguage = languages;

  const bio = pick(record, "bio", loc);
  if (bio) schema.description = bio;
  schema.memberOf = { "@type": "Organization", name: "QOVALX", url: SITE + "/" };
  return schema;
}

/** Which languages this record is actually published in. */
function localesFor(record) {
  return LOCALES.filter((loc) =>
    ALWAYS.indexOf(loc) !== -1 || own(record, "title", loc) || own(record, "bio", loc));
}

function pageUrl(loc, slug) {
  return SITE + "/" + loc + "/professionals/" + slug;
}

/** Every language version points at every other, and at itself. */
function alternates(slug, locales) {
  const rows = locales.map((loc) =>
    '  <link rel="alternate" hreflang="' + loc + '" href="' + pageUrl(loc, slug) + '">');
  rows.push('  <link rel="alternate" hreflang="x-default" href="' + pageUrl(FALLBACK, slug) + '">');
  return rows.join("\n");
}

// --------------------------------------------------------------------- main

function cssVersion() {
  // The stylesheet is cached for a year, so every page has to carry the same
  // query token as the rest of the site or a profile renders against a stale copy.
  const sample = fs.readFileSync(path.join(ROOT, "en", "professionals.html"), "utf8");
  const match = sample.match(/styles\.css\?v=([A-Za-z0-9._-]+)/);
  if (!match) throw new Error("could not read the styles.css version token from en/professionals.html");
  return match[1];
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error("could not read " + path.relative(ROOT, file) + ": " + error.message);
  }
}

function missingRequired(record) {
  const gaps = [];
  REQUIRED.forEach((base) => ALWAYS.forEach((loc) => {
    if (!own(record, base, loc)) gaps.push(base + "_" + FIELD_SUFFIX[loc]);
  }));
  return gaps;
}

function main() {
  const template = fs.readFileSync(TEMPLATE, "utf8")
    // The template is reachable at /professionals/_template, so it carries a
    // noindex that must not survive into a real page.
    .split("\n").filter((line) => !line.includes("<!-- template-only -->")).join("\n");

  const strings = {};
  LOCALES.forEach((loc) => { strings[loc] = readJson(I18N(loc)); });

  const records = readJson(DATA);
  if (!isArray(records)) throw new Error("data/professionals.json is not an array");

  const version = cssVersion();
  const active = records.filter((r) => r && r.status === "active");
  const seen = new Set();
  const wanted = new Set();
  const written = [];
  const skipped = [];
  let unchanged = 0;

  active.forEach((record, index) => {
    const slug = String(record.slug || "").trim();
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      skipped.push("record " + index + ": slug " + JSON.stringify(record.slug) + " is not a valid url segment");
      return;
    }
    if (seen.has(slug)) {
      skipped.push("record " + index + ": duplicate slug " + slug);
      return;
    }
    const gaps = missingRequired(record);
    if (gaps.length) {
      skipped.push(slug + ": missing required " + gaps.join(", "));
      return;
    }
    seen.add(slug);

    const locales = localesFor(record);
    locales.forEach((loc) => {
      const t = strings[loc];
      const canonical = pageUrl(loc, slug);
      const name = pick(record, "name", loc);
      const title = pick(record, "title", loc);
      const bio = pick(record, "bio", loc);

      const values = {
        lang: loc,
        dir: RTL.indexOf(loc) === -1 ? "ltr" : "rtl",
        // Two different things, and they were one key until a profile rendered
        // its whole document title inside the job title paragraph.
        head_title: title ? name + " — " + title + " | QOVALX" : name + " | QOVALX",
        title: title || "",
        description: excerpt(bio, 155) || excerpt(metaLine(record, t), 155),
        canonical: canonical,
        alternates: alternates(slug, locales),
        css_version: version,
        og_image: record.photo ? SITE + record.photo : "",
        photo: record.photo || "",
        name: name,
        name_lang: langMark(record, "name", loc),
        title_lang: langMark(record, "title", loc),
        bio_lang: langMark(record, "bio", loc),
        badges: badges(record, t),
        meta_line: metaLine(record, t),
        bio: bio || "",
        facts: facts(record, t, loc),
        whatsapp: record.contact && record.contact.whatsapp
          ? String(record.contact.whatsapp).replace(/[^0-9]/g, "") : "",
        email: record.contact && record.contact.email ? record.contact.email : "",
        l_bio: t.bio_heading, l_whatsapp: t.whatsapp, l_email: t.email,
        l_back: t.back_to_directory, l_skip: t.skip_to_main, l_legal: t.legal_line,
        jsonld: jsonLd(personSchema(record, loc, canonical)),
      };
      values.has_contact = values.whatsapp || values.email;

      const html = render(template, values);
      const file = path.join(outDir(loc), slug + ".html");
      wanted.add(path.relative(ROOT, file));
      const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
      if (existing === html) { unchanged++; return; }
      if (!CHECK) {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, html, "utf8");
      }
      written.push(path.relative(ROOT, file));
    });
  });

  // A page whose record went hidden, lost that language, or was deleted keeps
  // serving until it is removed.
  const stale = [];
  LOCALES.forEach((loc) => {
    const dir = outDir(loc);
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir)
      .filter((f) => f.endsWith(".html") && f !== "index.html" && !f.startsWith("_"))
      .map((f) => path.join(dir, f))
      .filter((f) => !wanted.has(path.relative(ROOT, f)))
      .forEach((f) => stale.push(f));
  });
  if (CLEAN && !CHECK) stale.forEach((f) => fs.unlinkSync(f));

  console.log((CHECK ? "check: " : "") + active.length + " active of " + records.length +
    " records, " + wanted.size + " pages across " + LOCALES.length + " locales");
  written.forEach((f) => console.log("  " + (CHECK ? "would write " : "wrote ") + f));
  if (unchanged) console.log("  " + unchanged + " already up to date");
  stale.forEach((f) => console.log("  " + (CLEAN && !CHECK ? "removed " : "stale, pass --clean to remove: ") +
    path.relative(ROOT, f)));
  skipped.forEach((x) => console.log("  skipped " + x));
  if (skipped.length) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error("build-profiles failed: " + error.message);
  process.exit(1);
}
