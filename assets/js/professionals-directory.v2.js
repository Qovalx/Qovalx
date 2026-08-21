/**
 * QOVALX professionals directory
 * Path in repository: /assets/js/professionals-directory.v2.js
 *
 * Two mounts, whichever the page carries:
 *   #qx-directory  the full directory, with search and filters
 *   #qx-latest     the three most recent entries, for the home page
 * Both draw the same card, so a change to one is a change to both.
 *
 * No visible text lives in this file. Every string is loaded from
 * /assets/i18n/professionals/<locale>.json, chosen from the page language, and
 * every record from /data/professionals.json. A record is rendered only when
 * its status is "active".
 *
 * Framework free, and built node by node rather than through innerHTML: the
 * records are edited by hand, so nothing from that file is ever parsed as
 * markup.
 */

(function () {
  "use strict";

  var DATA_PATH = "/data/professionals.json";
  var I18N_PATH = "/assets/i18n/professionals/";
  // The locale files sit under /assets/i18n/, which is served for five minutes
  // and then revalidated, so a wording fix reaches visitors without a rename.
  var I18N_SUFFIX = ".json";
  // Locales this page is published in. A locale absent here falls back to en
  // for the interface strings, never to an untranslated key.
  var LOCALES = ["ar", "en", "ru", "zh-Hans", "fr", "es", "hi"];
  var FALLBACK = "en";

  var strings = {};
  var records = [];
  var locale = detectLocale();
  var root, list, count, searchInput, emirateSelect, specSelect, clearButton;

  // The directory page itself is published in a subset of the locales that carry
  // the home strip, so a link out of a card has to land on a page that exists
  // rather than on a 404 in the reader's own language.
  var DIRECTORY_LOCALES = ["ar", "en", "ru", "zh-Hans", "fr", "es", "hi"];

  function directoryLocale() {
    return DIRECTORY_LOCALES.indexOf(locale) === -1 ? FALLBACK : locale;
  }

  function detectLocale() {
    var lang = String(document.documentElement.getAttribute("lang") || "").toLowerCase();
    for (var i = 0; i < LOCALES.length; i++) {
      if (LOCALES[i].toLowerCase() === lang) return LOCALES[i];
    }
    var base = lang.split("-")[0];
    for (var j = 0; j < LOCALES.length; j++) {
      if (LOCALES[j].toLowerCase().split("-")[0] === base) return LOCALES[j];
    }
    return FALLBACK;
  }

  function t(key, vars) {
    var value = strings[key];
    if (typeof value !== "string") return "";
    if (!vars) return value;
    return value.replace(/\{(\w+)\}/g, function (whole, name) {
      return Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole;
    });
  }

  /** Picks the field written in the page's language, e.g. name_ar or name_en. */
  function field(record, base) {
    var value = record[base + "_" + locale];
    if (value === undefined) value = record[base + "_" + FALLBACK];
    return value;
  }

  function listField(record, base) {
    var value = field(record, base);
    return Object.prototype.toString.call(value) === "[object Array]" ? value : [];
  }

  function el(name, className, text) {
    var node = document.createElement(name);
    if (className) node.className = className;
    if (text !== undefined && text !== null && text !== "") node.textContent = String(text);
    return node;
  }

  function load(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error(url + " " + res.status);
      return res.json();
    });
  }

  // ---------------------------------------------------------------- controls

  function buildControls() {
    var form = el("div", "qx-dir-controls");

    var searchField = el("div", "qx-dir-field");
    var searchLabel = el("label", "qx-dir-label", t("search_label"));
    searchInput = el("input", "field");
    searchInput.type = "search";
    searchInput.id = "qx-dir-search";
    searchInput.placeholder = t("search_placeholder");
    searchLabel.setAttribute("for", searchInput.id);
    searchField.appendChild(searchLabel);
    searchField.appendChild(searchInput);

    var emirateField = el("div", "qx-dir-field");
    var emirateLabel = el("label", "qx-dir-label", t("emirate_label"));
    emirateSelect = el("select", "field");
    emirateSelect.id = "qx-dir-emirate";
    emirateLabel.setAttribute("for", emirateSelect.id);
    emirateField.appendChild(emirateLabel);
    emirateField.appendChild(emirateSelect);

    var specField = el("div", "qx-dir-field");
    var specLabel = el("label", "qx-dir-label", t("specialisation_label"));
    specSelect = el("select", "field");
    specSelect.id = "qx-dir-spec";
    specLabel.setAttribute("for", specSelect.id);
    specField.appendChild(specLabel);
    specField.appendChild(specSelect);

    clearButton = el("button", "btn btn-s qx-dir-clear", t("clear"));
    clearButton.type = "button";

    form.appendChild(searchField);
    form.appendChild(emirateField);
    form.appendChild(specField);
    form.appendChild(clearButton);

    searchInput.addEventListener("input", render);
    emirateSelect.addEventListener("change", render);
    specSelect.addEventListener("change", render);
    clearButton.addEventListener("click", function () {
      searchInput.value = "";
      emirateSelect.selectedIndex = 0;
      specSelect.selectedIndex = 0;
      render();
      searchInput.focus();
    });

    return form;
  }

  /** Every distinct value across the active records, in the page's language. */
  function optionsFor(base) {
    var seen = {};
    var out = [];
    for (var i = 0; i < records.length; i++) {
      var values = listField(records[i], base);
      for (var j = 0; j < values.length; j++) {
        var value = String(values[j]).trim();
        if (value && !Object.prototype.hasOwnProperty.call(seen, value)) {
          seen[value] = true;
          out.push(value);
        }
      }
    }
    return out.sort(function (a, b) { return a.localeCompare(b, locale); });
  }

  function fillSelect(select, allLabel, values) {
    while (select.firstChild) select.removeChild(select.firstChild);
    var all = el("option", null, allLabel);
    all.value = "";
    select.appendChild(all);
    for (var i = 0; i < values.length; i++) {
      var option = el("option", null, values[i]);
      option.value = values[i];
      select.appendChild(option);
    }
  }

  // ------------------------------------------------------------------- cards

  function badges(record) {
    var row = el("div", "qx-dir-badges");
    if (record.verified === true) {
      var verified = el("span", "badge", t("verified"));
      if (record.verified_on) verified.title = t("verified_on", { date: record.verified_on });
      row.appendChild(verified);
    }
    if (record.founding_member === true) row.appendChild(el("span", "badge", t("founding_member")));
    return row.childNodes.length ? row : null;
  }

  function factList(headingKey, values) {
    if (!values.length) return null;
    var block = el("div", "qx-dir-facts");
    block.appendChild(el("h4", "qx-dir-facts-h", t(headingKey)));
    var ul = el("ul", "qx-dir-tags");
    for (var i = 0; i < values.length; i++) ul.appendChild(el("li", null, values[i]));
    block.appendChild(ul);
    return block;
  }

  function actions(record) {
    var row = el("div", "qx-dir-actions");
    var contact = record.contact || {};

    if (contact.whatsapp) {
      var digits = String(contact.whatsapp).replace(/[^0-9]/g, "");
      if (digits) {
        var wa = el("a", "btn btn-s", t("whatsapp"));
        wa.href = "https://wa.me/" + digits;
        wa.rel = "noopener";
        wa.target = "_blank";
        row.appendChild(wa);
      }
    }
    if (contact.email) {
      var mail = el("a", "btn btn-s", t("email"));
      mail.href = "mailto:" + contact.email;
      row.appendChild(mail);
    }
    if (record.slug) {
      var profile = el("a", "btn btn-s", t("profile"));
      profile.href = "/" + directoryLocale() + "/professionals/" + record.slug + ".html";
      row.appendChild(profile);
    }
    return row.childNodes.length ? row : null;
  }

  function card(record) {
    var article = el("article", "card qx-dir-card");

    if (record.photo) {
      var media = el("div", "card-media qx-dir-media");
      var img = el("img");
      img.src = record.photo;
      // The portrait carries no information the card does not already state in
      // text, so it stays out of the accessible name.
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      media.appendChild(img);
      article.appendChild(media);
    }

    var name = field(record, "name");
    if (name) article.appendChild(el("h3", null, name));

    var title = field(record, "title");
    if (title) article.appendChild(el("p", "qx-dir-title", title));

    var badgeRow = badges(record);
    if (badgeRow) article.appendChild(badgeRow);

    var meta = [];
    if (typeof record.experience_years === "number") {
      meta.push(record.experience_years === 1
        ? t("experience_one")
        : t("experience_many", { n: record.experience_years }));
    }
    if (record.licence_authority) meta.push(t("licensed_by", { authority: record.licence_authority }));
    if (meta.length) article.appendChild(el("p", "qx-dir-meta", meta.join(" · ")));

    var specs = factList("specialisations_heading", listField(record, "specialisations"));
    if (specs) article.appendChild(specs);
    var emirates = factList("emirates_heading", listField(record, "emirates"));
    if (emirates) article.appendChild(emirates);
    var languages = factList("languages_heading", listField(record, "languages"));
    if (languages) article.appendChild(languages);

    var actionRow = actions(record);
    if (actionRow) article.appendChild(actionRow);

    return article;
  }

  // ------------------------------------------------------------------ render

  /**
   * Search reads every published language, not just the page's. A visitor on
   * the Arabic page routinely types a name in Latin letters and the record
   * already holds both forms, so matching only the displayed field would return
   * nothing for a person who is plainly in the directory. What is shown stays
   * in the page's language; only what is searched widens.
   */
  function haystack(record) {
    var parts = [];
    for (var i = 0; i < LOCALES.length; i++) {
      parts.push(record["name_" + LOCALES[i]], record["title_" + LOCALES[i]]);
      var specs = record["specialisations_" + LOCALES[i]];
      if (Object.prototype.toString.call(specs) === "[object Array]") parts = parts.concat(specs);
    }
    return parts
      .filter(function (x) { return typeof x === "string"; })
      .join(" ")
      .toLowerCase();
  }

  function matches(record) {
    var query = searchInput.value.trim().toLowerCase();
    if (query && haystack(record).indexOf(query) === -1) return false;
    if (emirateSelect.value && listField(record, "emirates").indexOf(emirateSelect.value) === -1) return false;
    if (specSelect.value && listField(record, "specialisations").indexOf(specSelect.value) === -1) return false;
    return true;
  }

  function note(key) {
    return el("p", "qx-dir-note", t(key));
  }

  function render() {
    while (list.firstChild) list.removeChild(list.firstChild);

    if (!records.length) {
      count.textContent = "";
      list.appendChild(note("empty_directory"));
      return;
    }

    var shown = records.filter(matches);
    count.textContent = shown.length === 1 ? t("count_one") : t("count_many", { n: shown.length });

    if (!shown.length) {
      list.appendChild(note("empty_filtered"));
      return;
    }
    for (var i = 0; i < shown.length; i++) list.appendChild(card(shown[i]));
  }

  /**
   * Newest first. verified_on is the only date a record carries, so it orders
   * the strip; a record without one sorts last rather than jumping to the top,
   * and ties keep their order in the file, where a later entry is the newer.
   */
  function newestFirst(all) {
    return all
      .map(function (record, index) { return { record: record, index: index }; })
      .sort(function (a, b) {
        var da = a.record.verified_on || "";
        var db = b.record.verified_on || "";
        if (da !== db) return da < db ? 1 : -1;
        return b.index - a.index;
      })
      .map(function (x) { return x.record; });
  }

  function startLatest(mount) {
    Promise.all([
      load(I18N_PATH + locale + I18N_SUFFIX).catch(function () {
        return load(I18N_PATH + FALLBACK + I18N_SUFFIX);
      }),
      load(DATA_PATH),
    ]).then(function (results) {
      strings = results[0] || {};
      var all = Object.prototype.toString.call(results[1]) === "[object Array]" ? results[1] : [];
      records = newestFirst(all.filter(function (r) { return r && r.status === "active"; }));

      while (mount.firstChild) mount.removeChild(mount.firstChild);

      var heading = document.querySelector("[data-qx-latest-title]");
      if (heading) heading.textContent = t("home_latest_title");

      if (!records.length) {
        mount.appendChild(note("empty_directory"));
        return;
      }

      var grid = el("div", "qx-dir-list qx-latest-list");
      for (var i = 0; i < Math.min(3, records.length); i++) grid.appendChild(card(records[i]));
      mount.appendChild(grid);

      var more = el("p", "qx-latest-more");
      var link = el("a", "btn btn-s", t("home_latest_all"));
      link.href = "/" + directoryLocale() + "/professionals";
      more.appendChild(link);
      mount.appendChild(more);
    }).catch(function (error) {
      while (mount.firstChild) mount.removeChild(mount.firstChild);
      mount.appendChild(el("p", "qx-dir-note", t("load_error") || mount.getAttribute("data-load-error") || ""));
      if (window.console && console.error) console.error("qx_latest_error", error);
    });
  }

  function start() {
    var latest = document.getElementById("qx-latest");
    if (latest) startLatest(latest);

    root = document.getElementById("qx-directory");
    if (!root) return;

    var status = el("p", "qx-dir-note", t("loading"));
    root.appendChild(status);

    Promise.all([
      load(I18N_PATH + locale + I18N_SUFFIX).catch(function () {
        return load(I18N_PATH + FALLBACK + I18N_SUFFIX);
      }),
      load(DATA_PATH),
    ]).then(function (results) {
      strings = results[0] || {};
      var all = Object.prototype.toString.call(results[1]) === "[object Array]" ? results[1] : [];
      records = all.filter(function (r) { return r && r.status === "active"; });

      while (root.firstChild) root.removeChild(root.firstChild);

      var heading = document.querySelector("[data-qx-dir-title]");
      if (heading) heading.textContent = t("page_title");
      var lede = document.querySelector("[data-qx-dir-lede]");
      if (lede) lede.textContent = t("page_lede");
      if (document.title.indexOf("QOVALX") !== -1) document.title = t("page_title") + " | QOVALX";

      root.appendChild(buildControls());
      fillSelect(emirateSelect, t("emirate_all"), optionsFor("emirates"));
      fillSelect(specSelect, t("specialisation_all"), optionsFor("specialisations"));

      count = el("p", "status qx-dir-count");
      count.setAttribute("role", "status");
      count.setAttribute("aria-live", "polite");
      root.appendChild(count);

      list = el("div", "qx-dir-list");
      root.appendChild(list);

      render();
    }).catch(function (error) {
      while (root.firstChild) root.removeChild(root.firstChild);
      // strings may be empty if the locale file itself was the failure, so this
      // falls back to the one string the page carries in its own markup.
      var fallback = root.getAttribute("data-load-error") || "";
      root.appendChild(el("p", "qx-dir-note", t("load_error") || fallback));
      if (window.console && console.error) console.error("qx_directory_error", error);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
