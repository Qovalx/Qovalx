#!/usr/bin/env node
/**
 * Builds one page per professional from data/professionals.json.
 *
 *   node scripts/build-profiles.js            write the pages
 *   node scripts/build-profiles.js --check    report what would change, write nothing
 *   node scripts/build-profiles.js --clean    also delete pages whose record is gone
 *
 * Reads professionals/_template.html and writes professionals/<slug>.html for
 * every record whose status is "active". A record that is hidden, or removed
 * from the data file, leaves a stale page behind unless --clean is passed.
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
const OUT_DIR = path.join(ROOT, "professionals");
const I18N = (loc) => path.join(ROOT, "assets", "i18n", "professionals", loc + ".json");
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

function tagList(values) {
  return '<ul class="qx-dir-tags">' +
    values.map((v) => "<li>" + esc(v) + "</li>").join("") + "</ul>";
}

/** One language's column of facts: specialisations, emirates, languages. */
function facts(record, strings, suffix) {
  const blocks = [
    ["specialisations_heading", list(record["specialisations_" + suffix])],
    ["emirates_heading", list(record["emirates_" + suffix])],
    ["languages_heading", list(record["languages_" + suffix])],
  ];
  return blocks
    .filter(([, values]) => values.length)
    .map(([key, values]) =>
      '<div class="qx-dir-facts"><h3 class="qx-dir-facts-h">' + esc(strings[key]) +
      "</h3>" + tagList(values) + "</div>")
    .join("\n        ");
}

function badges(record, en) {
  const out = [];
  // The badge states that QOVALX checked the authorisation. The licence number
  // itself is never published: the page names the authority and nothing more.
  if (record.verified === true) out.push('<span class="badge">' + esc(en.verified) + "</span>");
  if (record.founding_member === true) out.push('<span class="badge">' + esc(en.founding_member) + "</span>");
  return out.join(" ");
}

function metaLine(record, en) {
  const parts = [];
  if (typeof record.experience_years === "number") {
    parts.push(record.experience_years === 1
      ? en.experience_one
      : fill(en.experience_many, { n: record.experience_years }));
  }
  if (record.licence_authority) {
    parts.push(fill(en.licensed_by, { authority: record.licence_authority }));
  }
  if (record.verified === true && record.verified_on) {
    parts.push(fill(en.verified_on, { date: record.verified_on }));
  }
  return parts.join(" · ");
}

function personSchema(record, canonical) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": canonical + "#person",
    name: record.name_en || record.name_ar,
    url: canonical,
  };
  if (record.name_ar && record.name_en && record.name_ar !== record.name_en) {
    schema.alternateName = record.name_ar;
  }
  if (record.title_en || record.title_ar) schema.jobTitle = record.title_en || record.title_ar;
  if (record.photo) schema.image = SITE + record.photo;

  const areas = list(record.emirates_en).length ? list(record.emirates_en) : list(record.emirates_ar);
  if (areas.length) {
    schema.areaServed = areas.map((name) => ({ "@type": "AdministrativeArea", name: name }));
  }
  const languages = list(record.languages_en).length ? list(record.languages_en) : list(record.languages_ar);
  if (languages.length) schema.knowsLanguage = languages;

  if (record.bio_en || record.bio_ar) schema.description = record.bio_en || record.bio_ar;
  // worksFor, not a claim of endorsement: the person is listed on the platform.
  schema.memberOf = { "@type": "Organization", name: "QOVALX", url: SITE + "/" };
  return schema;
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

function main() {
  const template = fs.readFileSync(TEMPLATE, "utf8")
    // The template is reachable at /professionals/_template, so it carries a
    // noindex that must not survive into a real page.
    .split("\n").filter((line) => !line.includes("<!-- template-only -->")).join("\n");

  const en = readJson(I18N("en"));
  const ar = readJson(I18N("ar"));
  const records = readJson(DATA);
  if (!isArray(records)) throw new Error("data/professionals.json is not an array");

  const version = cssVersion();
  const active = records.filter((r) => r && r.status === "active");
  const seen = new Set();
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
    if (!record.name_en && !record.name_ar) {
      skipped.push(slug + ": no name in either language");
      return;
    }
    seen.add(slug);

    const canonical = SITE + "/professionals/" + slug;
    const nameEn = record.name_en || record.name_ar;
    const titleEn = record.title_en || record.title_ar || "";
    const bio = record.bio_en || record.bio_ar || "";

    const values = {
      title: titleEn ? nameEn + " — " + titleEn + " | QOVALX" : nameEn + " | QOVALX",
      description: excerpt(bio, 155) || excerpt(metaLine(record, en), 155),
      canonical: canonical,
      css_version: version,
      og_image: record.photo ? SITE + record.photo : "",
      photo: record.photo || "",
      name_en: nameEn,
      name_ar: record.name_ar || "",
      title_en: record.title_en || "",
      title_ar: record.title_ar || "",
      badges: badges(record, en),
      meta_line: metaLine(record, en),
      bio_en: record.bio_en || "",
      bio_ar: record.bio_ar || "",
      facts_en: facts(record, en, "en"),
      facts_ar: facts(record, ar, "ar"),
      whatsapp: record.contact && record.contact.whatsapp
        ? String(record.contact.whatsapp).replace(/[^0-9]/g, "") : "",
      email: record.contact && record.contact.email ? record.contact.email : "",
      l_bio_en: en.bio_heading, l_bio_ar: ar.bio_heading,
      l_whatsapp_en: en.whatsapp, l_email_en: en.email,
      l_back_en: en.back_to_directory, l_back_ar: ar.back_to_directory,
      jsonld: jsonLd(personSchema(record, canonical)),
    };
    values.has_contact = values.whatsapp || values.email;

    const html = render(template, values);
    const file = path.join(OUT_DIR, slug + ".html");
    const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
    if (existing === html) { unchanged++; return; }
    if (!CHECK) fs.writeFileSync(file, html, "utf8");
    written.push(path.relative(ROOT, file));
  });

  // A page whose record went hidden or was deleted keeps serving until removed.
  const stale = fs.readdirSync(OUT_DIR)
    .filter((f) => f.endsWith(".html") && !f.startsWith("_"))
    .filter((f) => !seen.has(f.slice(0, -5)));
  if (CLEAN && !CHECK) stale.forEach((f) => fs.unlinkSync(path.join(OUT_DIR, f)));

  console.log((CHECK ? "check: " : "") + active.length + " active of " + records.length + " records");
  written.forEach((f) => console.log("  " + (CHECK ? "would write " : "wrote ") + f));
  if (unchanged) console.log("  " + unchanged + " already up to date");
  stale.forEach((f) => console.log("  " + (CLEAN && !CHECK ? "removed " : "stale, pass --clean to remove: ") + "professionals/" + f));
  skipped.forEach((s) => console.log("  skipped " + s));
  if (skipped.length) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error("build-profiles failed: " + error.message);
  process.exit(1);
}
