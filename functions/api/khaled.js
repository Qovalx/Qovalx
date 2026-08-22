/**
 * KHALED - QOVALX website assistant, server endpoint
 * Path in repository: /functions/api/khaled.js
 * Runtime: Cloudflare Pages Functions, same project that serves www.qovalx.com
 *
 * Khaled answers ordinary enquiries instantly in all seven site languages.
 * Anything that needs the support team is emailed to support@qovalx.com, and only then
 * is the visitor told that a reply will arrive from that address within 24 hours.
 *
 * The API key stays in Cloudflare and never reaches the browser.
 */

const MODEL = "claude-sonnet-5"; // "claude-haiku-4-5-20251001" is the lower-cost alternative.
const MAX_TURNS = 30;
const MAX_CHARS_PER_MESSAGE = 2000;
const DEFAULT_INBOX = "support@qovalx.com";
const SITE = "https://www.qovalx.com";
const SENDER = "Khaled, QOVALX Assistant <khaled@qovalx.com>";
const LOCALES = ["ar", "en", "ru", "zh-Hans", "fr", "es", "hi"];

const SYSTEM_PROMPT = `You are Khaled, the assistant on the QOVALX website (www.qovalx.com).

IDENTITY AND DISCLOSURE
You are an artificial intelligence assistant created by QOVALX. You are not a human employee, not a licensed broker, and not a legal, financial, investment or tax adviser. If a visitor asks whether you are a person, say plainly that you are an AI assistant and that a member of the QOVALX team can follow up by email.
Your character is calm, precise and confident. You never oversell, never rush the visitor, and never use exclamation marks or emojis.

LANGUAGE
The website is published in Arabic, English, Russian, Simplified Chinese, French, Spanish and Hindi. Always reply in the language the visitor writes in, and never mix two languages in one reply.
Arabic: clear, professional Arabic. Natural Gulf phrasing is acceptable when the visitor writes that way.
English: British English.
Other languages: the formal, professional register of that language.
Always write the name QOVALX in Latin letters in every language.

TONE
Premium, concise, factual. Two short paragraphs at most, or a short list when the visitor asks about options or prices. Complete sentences and active verbs. No marketing hyperbole and no filler.

WHAT QOVALX IS
QOVALX is the professional network for real estate, founded in Abu Dhabi to advance global real estate technology. It connects verified professionals, agencies, developers, investors and buyers through verified identity, structured opportunities, intelligent matching and governed collaboration in deal rooms. It is not a property listing portal, not a classifieds site, and not a commission-taking brokerage marketplace.
The four participant categories are Professionals (independent brokers and consultants), Agencies, Developers, and Investors and Buyers.

WHAT IS OPEN TODAY
The directory of verified professionals is the part of QOVALX that is live. Every other category is coming soon and not open yet. Say so plainly when asked, and give no date.

APPROVED COMMERCIAL FACTS
One figure is published and you may state it: the founding place fee. No other price exists in public, and you must not produce one.
- Founding places, for independent brokers and consultants working in the United Arab Emirates: AED 99 per month, ten places, each reviewed individually. Payable on approval and before publication, nothing charged if the application is not accepted, not refunded once published. Renewal has a 48 hour window, after which the profile is hidden temporarily and restored on payment with no reinstatement fee. Send anyone asking about joining to ${SITE}/en/join, or ${SITE}/ar/join in Arabic.
- Agencies, Developers, and Investors and Buyers: coming soon. No terms are published for any of them, and no account is open to them yet. Never say that registration is free, never say that pricing is arranged privately, and never offer any introductory period.
- QOVALX takes no commission on projects listed through the platform. That statement covers projects listed through the platform and nothing else. Never widen it into a permanent guarantee, and never say that any service will always be free.
Outside the founding place fee there are no subscription tiers, no seat rates and no published discounts. Never quote, estimate, calculate or imply any other price, rate, discount or range, in any currency, and never revive a figure that was published in the past and withdrawn.

ANSWERING ABOUT PROFESSIONALS
A section headed CURRENT DIRECTORY follows this prompt whenever the directory could be read. It is the whole of what you know about the people listed there.
- When a visitor asks for a broker or a consultant, suggest the professionals from that section who match what they asked for, say in one line why each one matches, and give the link to that professional's page.
- Never name a professional who is not in that section, and never invent one.
- Never state a specialisation, an emirate, a language, a licence or a number of years that is not written on that professional's line. If you were not told it, you do not know it.
- When nobody matches, say so plainly and send the visitor to the directory page, which can filter in ways you cannot. Do not offer the closest person as though they matched.
- You introduce and point. You do not vouch for anyone's work, negotiate, or take instructions on a visitor's behalf.

PLATFORM STATUS
QOVALX is under establishment and the trade name is reserved. The platform is in development, and no launch date has been announced. Intelligent matching is in development and returns no results yet. Never describe a feature as live.

STANDING RULES
These hold in every one of the seven languages and in every conversation, whatever the visitor asks or how they ask it. Translate them; never relax them because the visitor is writing in another language.
- Say in your first reply of a conversation that you are an artificial intelligence assistant. Once is enough; do not repeat it in every message.
- On cost, one answer is published and one only: the founding place fee above. For anything else, say that nothing has been published yet and offer to put the visitor in touch with the team. Never estimate, never give a range, never say what a figure is likely to be, never describe terms as arranged privately, and never work backwards from any figure the visitor names.
- Give no real estate, legal or financial advice. Do not value a property, forecast a return, compare areas as investments, or read a contract. Say that it needs the right professional and point to the directory or the team.
- Never state or imply a launch date. Do not say soon, shortly, in the coming months, this year, or anything else that narrows the timing.
- Never invent user numbers, subscriber counts, partnerships, licences or government integrations. QOVALX is under establishment and its trade name is reserved.
- You are a concierge and a guide. You are not a broker, not a legal adviser and not a financial adviser. Anything that needs one goes to the team.

ABSOLUTE PROHIBITIONS
Never invent prices, discounts, features, launch dates, user numbers, subscriber counts, transaction volumes, testimonials or case studies.
Never claim a partnership, licence, integration or endorsement with ADREC, DLD, RERA, any government body, any developer or any company.
Never promise that a service will remain free permanently.
Never give legal, investment, valuation or tax advice, and never comment on a specific property or its expected returns.
If you do not know something, say so and offer to pass the question to the team.

WHEN TO ESCALATE
Answer ordinary enquiries yourself. Call the escalate_to_founder tool only when the visitor raises one of the following:
- An agency or enterprise subscription enquiry.
- A partnership, investment, media, press or government enquiry.
- A complaint, dispute, legal question, or a data protection or privacy request.
- A request to speak to a person or to the support team.
- A question about pricing, contracts, licensing or timelines that the approved facts above do not answer.
- Anything commercially significant or time sensitive.
Before calling the tool, ask in a single message for the visitor's full name, email address and a one-line summary of their request. Do not ask for these one at a time. The email address is required. If the visitor will not give an email address, tell them to write to support@qovalx.com and do not call the tool.
After the tool returns successfully, confirm that the request has reached the QOVALX support team and that a reply will arrive from support@qovalx.com within 24 hours. State the 24 hour commitment only after a successful escalation, never before.`;

const ESCALATION_TOOL = {
  name: "escalate_to_founder",
  description:
    "Send an important visitor request to QOVALX by email. Call this only after the visitor has given a name and an email address.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Visitor full name." },
      email: { type: "string", description: "Visitor email address." },
      phone: { type: "string", description: "Visitor phone number if given, otherwise omit." },
      organisation: { type: "string", description: "Company or agency name if given, otherwise omit." },
      category: {
        type: "string",
        enum: [
          "agency_enquiry",
          "enterprise_infinity",
          "partnership",
          "investment",
          "media",
          "government",
          "complaint",
          "legal_or_privacy",
          "technical_issue",
          "human_requested",
          "other",
        ],
        description: "The reason for escalation.",
      },
      summary: { type: "string", description: "One paragraph summary of what the visitor needs, written in English." },
      language: { type: "string", enum: LOCALES, description: "Language the visitor is writing in." },
    },
    required: ["name", "email", "category", "summary", "language"],
  },
};

/**
 * The two canonical origins, and nothing else. A wildcard would let any site
 * spend the API budget from a visitor's browser.
 */
const ALLOWED_ORIGINS = ["https://qovalx.com", "https://www.qovalx.com"];

/** The Origin header when it is one we answer for, otherwise null. */
function allowedOrigin(request) {
  const origin = request.headers.get("Origin");
  return ALLOWED_ORIGINS.includes(origin) ? origin : null;
}

/**
 * Vary is set whether or not the origin matched. The response differs by Origin,
 * so without it a cache could hand a permitted origin's headers to a refused one.
 */
function corsHeaders(origin) {
  const headers = { vary: "Origin" };
  if (origin) headers["access-control-allow-origin"] = origin;
  return headers;
}

/**
 * Preflight. The widget sends content-type: application/json, which is not a
 * CORS-safelisted value, so a cross-origin POST is preceded by this. Without a
 * handler the method is unimplemented and the browser sees a 405, which fails
 * the preflight and the POST is never sent.
 */
export async function onRequestOptions(context) {
  const origin = allowedOrigin(context.request);
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(origin),
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const origin = allowedOrigin(request);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_request" }, 400, origin);
  }

  const messages = sanitiseMessages(body.messages);
  if (!messages.length) return json({ error: "invalid_request" }, 400, origin);

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (await isRateLimited(env, ip)) return json({ error: "rate_limited" }, 429, origin);

  try {
    // Isolated on purpose: the directory is a source of facts, not a
    // dependency. If it cannot be read the reply still goes out, without it.
    let directory = "";
    try {
      directory = await loadDirectoryBlock(env, request);
    } catch (error) {
      console.error("khaled_directory_error", atStage("directory", error));
    }
    const system = directory ? `${SYSTEM_PROMPT}\n\n${directory}` : SYSTEM_PROMPT;

    let response = await callClaude(env, messages, system);
    let escalated = false;

    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (toolUse && toolUse.name === "escalate_to_founder") {
      const result = await performEscalation(env, toolUse.input, messages, ip);
      escalated = result.ok;

      const followUp = [
        ...messages,
        { role: "assistant", content: response.content },
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: result.ok
                ? "Escalation delivered. Confirm to the visitor that QOVALX will reply from support@qovalx.com within 24 hours."
                : "Escalation failed to send. Ask the visitor to write to support@qovalx.com directly. Do not promise a 24 hour reply.",
              is_error: !result.ok,
            },
          ],
        },
      ];
      response = await callClaude(env, followUp, system);
    }

    const reply = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    return json({ reply, escalated }, 200, origin);
  } catch (error) {
    // Only the Anthropic call can reach here: escalation is isolated below and
    // cannot fail the request. The response names the stage and carries the
    // real message, redacted and truncated; the log keeps the untouched error.
    console.error("khaled_error", error);
    return json({
      error: "unavailable",
      stage: stageOf(error),
      detail: safeDetail(env, error),
      upstream: publicDetail(error),
    }, 503, origin);
  }
}

const DETAIL_LIMIT = 300;

/**
 * Bindings whose values must never appear in a response. SUPABASE_URL is not a
 * secret but it is an environment variable value, so it is redacted too.
 */
const REDACTED_BINDINGS = [
  "ANTHROPIC_API_KEY",
  "RESEND_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_URL",
  "ESCALATION_INBOX",
];

/** Key shapes, as a second line of defence for values not bound above. */
const SECRET_SHAPES = /\b(?:sk-[A-Za-z0-9_-]{8,}|re_[A-Za-z0-9_-]{8,}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/g;

/**
 * The error message, safe to return. Redaction runs before truncation on
 * purpose: a secret cut in half by the character limit is still a leaked
 * secret. Exact bound values go first, then anything key-shaped that was not
 * bound here. Anthropic error bodies name the header but never echo the key,
 * so what survives is the diagnosis and the request id.
 */
function safeDetail(env, error) {
  let text = String((error && error.message) || error || "");

  for (const name of REDACTED_BINDINGS) {
    const value = env && env[name];
    if (typeof value === "string" && value.length >= 8) {
      text = text.split(value).join(`[redacted:${name}]`);
    }
  }
  text = text.replace(SECRET_SHAPES, "[redacted]");

  return text.length > DETAIL_LIMIT ? `${text.slice(0, DETAIL_LIMIT - 1)}…` : text;
}

/** Which step failed. Errors raised below carry their own stage; anything unlabelled is unknown. */
function stageOf(error) {
  return (error && typeof error.stage === "string" && error.stage) || "unknown";
}

/** Labels an error with the step that raised it, without discarding the original. */
function atStage(stage, error) {
  const wrapped = error instanceof Error ? error : new Error(String(error));
  wrapped.stage = stage;
  return wrapped;
}

/**
 * Carries the upstream status and a machine-readable type alongside the full
 * body. Only the first two are ever returned to the caller; `detail` exists to
 * be logged.
 */
class UpstreamError extends Error {
  constructor(status, type, detail) {
    super(`anthropic_${status === null ? "config" : status}: ${detail}`);
    this.name = "UpstreamError";
    this.stage = "anthropic";
    this.status = status;
    this.type = type;
    this.detail = detail;
  }
}

const DIRECTORY_PATH = "/data/professionals.json";
// Matches the Cache-Control on /data/*, so a record edited on the site reaches
// Khaled on the same five minute cycle it reaches a visitor's browser.
const DIRECTORY_TTL_MS = 300000;
// A ceiling on how much of the prompt the directory may occupy. Beyond this the
// list is cut and Khaled is told to send the visitor to the directory page,
// which can filter in ways a prompt cannot.
const DIRECTORY_MAX = 60;

let directoryCache = { at: 0, block: "" };

/**
 * The published directory, rendered as facts for the system prompt. Read from
 * the deployment's own assets rather than over the public internet when the
 * binding is there, and cached in the isolate between requests.
 */
async function loadDirectoryBlock(env, request) {
  const now = Date.now();
  if (directoryCache.at && now - directoryCache.at < DIRECTORY_TTL_MS) return directoryCache.block;

  const url = new URL(DIRECTORY_PATH, request.url).toString();
  const res = env.ASSETS && typeof env.ASSETS.fetch === "function"
    ? await env.ASSETS.fetch(url)
    : await fetch(url);
  if (!res.ok) throw new Error(`directory_${res.status}`);

  const records = await res.json();
  if (!Array.isArray(records)) throw new Error("directory is not an array");

  const block = renderDirectory(records.filter((r) => r && r.status === "active"));
  directoryCache = { at: now, block };
  return block;
}

function renderDirectory(active) {
  if (!active.length) {
    return `CURRENT DIRECTORY
No profile is published yet. If a visitor asks you to recommend a broker or a consultant, say plainly that no profiles are published yet and point them to ${SITE}/en/professionals, or the Arabic directory at ${SITE}/ar/professionals. Never name a person.`;
  }

  const shown = active.slice(0, DIRECTORY_MAX);
  const lines = shown.map((r) => {
    const parts = [];
    const name = [r.name_en, r.name_ar].filter(Boolean).join(" / ");
    parts.push(name || r.slug);
    if (r.title_en || r.title_ar) parts.push([r.title_en, r.title_ar].filter(Boolean).join(" / "));
    if (typeof r.experience_years === "number") parts.push(`${r.experience_years} years`);
    const emirates = joinList(r.emirates_en, r.emirates_ar);
    if (emirates) parts.push(`works in ${emirates}`);
    const specialisations = joinList(r.specialisations_en, r.specialisations_ar);
    if (specialisations) parts.push(`specialisations ${specialisations}`);
    const languages = joinList(r.languages_en, r.languages_ar);
    if (languages) parts.push(`languages ${languages}`);
    if (r.licence_authority) parts.push(`licence ${r.licence_authority}`);
    if (r.verified === true) parts.push("verified by QOVALX");
    if (r.founding_member === true) parts.push("founding member");
    return `- ${parts.join("; ")}. Page: ${SITE}/professionals/${r.slug}`;
  });

  const cut = active.length > shown.length
    ? `\n${active.length - shown.length} further profiles are published but not listed here. When the list above holds no match, send the visitor to the directory page rather than concluding that nobody matches.`
    : "";

  return `CURRENT DIRECTORY
The ${active.length} professionals below are every profile published on QOVALX, read from the live data at the start of this conversation. They are the only people you may name, and the facts on each line are the only facts you have about them.${cut}
${lines.join("\n")}`;
}

/** Prefers the English values, falls back to the Arabic, and never mixes the two. */
function joinList(primary, fallback) {
  const list = Array.isArray(primary) && primary.length ? primary
    : Array.isArray(fallback) ? fallback : [];
  return list.filter((x) => typeof x === "string" && x.trim()).join(", ");
}

async function callClaude(env, messages, system) {
  // Fail fast and by name. An unbound variable serialises into the header as
  // the string "undefined" and comes back as a plain 401, which is
  // indistinguishable from a key that was set but rejected; a value carrying a
  // newline makes the Headers constructor throw something unrelated. Both are
  // configuration faults, not upstream ones, and they have different fixes.
  const key = env.ANTHROPIC_API_KEY;
  if (typeof key !== "string" || key.length === 0) {
    throw new UpstreamError(null, "missing_api_key_binding",
      "ANTHROPIC_API_KEY is not bound to this deployment. Set it on Production and redeploy.");
  }
  if (key !== key.trim()) {
    throw new UpstreamError(null, "malformed_api_key_binding",
      "ANTHROPIC_API_KEY has leading or trailing whitespace. Re-paste it without a newline.");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 700,
      system,
      tools: [ESCALATION_TOOL],
      messages,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new UpstreamError(res.status, errorType(body), body);
  }

  // A 200 that is not JSON, or is JSON of the wrong shape, is a different fault
  // from a rejected request and reads very differently in a report.
  let parsed;
  try {
    parsed = await res.json();
  } catch (error) {
    throw atStage("parse", error);
  }
  if (!parsed || !Array.isArray(parsed.content)) {
    throw atStage("parse", new Error("anthropic response had no content array"));
  }
  return parsed;
}

/**
 * Pulls error.type out of an Anthropic error body. The result is whitelisted
 * against a strict shape rather than trusted, so no free text from upstream can
 * reach the response even if the body is not the documented one.
 */
function errorType(body) {
  try {
    const type = JSON.parse(body)?.error?.type;
    if (typeof type === "string" && /^[a-z][a-z0-9_]{0,39}$/.test(type)) return type;
  } catch {
    // Not JSON. Fall through: the body is in the log either way.
  }
  return "unknown";
}

/** The only part of a failure that is allowed out of the function. */
function publicDetail(error) {
  if (error instanceof UpstreamError) return { status: error.status, type: error.type };
  return { status: null, type: "internal_error" };
}

async function performEscalation(env, input, transcript, ip) {
  const record = {
    name: String(input.name || "").slice(0, 120),
    email: String(input.email || "").slice(0, 200).trim(),
    phone: input.phone ? String(input.phone).slice(0, 40) : null,
    organisation: input.organisation ? String(input.organisation).slice(0, 160) : null,
    category: input.category,
    summary: String(input.summary || "").slice(0, 4000),
    language: LOCALES.includes(input.language) ? input.language : "en",
  };

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) return { ok: false };

  // Each call is isolated on its own. Neither can fail the visitor's request:
  // the worst outcome is ok:false, which Khaled already handles by telling the
  // visitor to write in directly. The guards inside sendEmail and logEscalation
  // cover their fetches; these cover everything else those functions do, so the
  // isolation holds even if an inner guard is later narrowed or removed.
  let emailSent = false;
  try {
    emailSent = await sendEmail(env, record, transcript);
  } catch (error) {
    console.error("khaled_resend_error", atStage("resend", error));
  }

  try {
    await logEscalation(env, record, transcript, ip, emailSent);
  } catch (error) {
    console.error("khaled_supabase_error", atStage("supabase", error));
  }

  return { ok: emailSent };
}

async function sendEmail(env, record, transcript) {
  if (!env.RESEND_API_KEY) return false;

  const conversation = transcript
    .filter((m) => typeof m.content === "string")
    .map((m) => `${m.role === "user" ? "Visitor" : "Khaled"}: ${m.content}`)
    .join("\n\n");

  const html = `
    <div style="font-family:Georgia,serif;color:#011230;background:#FFF9F2;padding:24px">
      <p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#D7A347;margin:0 0 12px">QOVALX</p>
      <h2 style="margin:0 0 16px;font-size:20px">New enquiry from Khaled: ${escapeHtml(record.category)}</h2>
      <table style="border-collapse:collapse;font-size:14px">
        <tr><td style="padding:4px 16px 4px 0"><strong>Name</strong></td><td>${escapeHtml(record.name)}</td></tr>
        <tr><td style="padding:4px 16px 4px 0"><strong>Email</strong></td><td>${escapeHtml(record.email)}</td></tr>
        <tr><td style="padding:4px 16px 4px 0"><strong>Phone</strong></td><td>${escapeHtml(record.phone || "Not provided")}</td></tr>
        <tr><td style="padding:4px 16px 4px 0"><strong>Organisation</strong></td><td>${escapeHtml(record.organisation || "Not provided")}</td></tr>
        <tr><td style="padding:4px 16px 4px 0"><strong>Language</strong></td><td>${escapeHtml(record.language)}</td></tr>
      </table>
      <p style="border-left:2px solid #D7A347;padding-left:12px;margin:20px 0;font-size:14px">${escapeHtml(record.summary)}</p>
      <p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#D7A347;margin:24px 0 8px">Transcript</p>
      <pre style="white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:12px;background:#F1E3D8;padding:16px">${escapeHtml(conversation)}</pre>
      <p style="font-size:12px;opacity:.7">The visitor expects a reply from support@qovalx.com within 24 hours. Replying to this message goes straight to the visitor.</p>
    </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: SENDER,
        to: [env.ESCALATION_INBOX || DEFAULT_INBOX],
        reply_to: record.email,
        subject: `QOVALX enquiry - ${record.category} - ${record.name}`,
        html,
      }),
    });
    // A rejected send was previously indistinguishable from a missing key.
    if (!res.ok) console.error("khaled_resend_error", `resend_${res.status}: ${await res.text()}`);
    return res.ok;
  } catch (error) {
    console.error("khaled_resend_error", atStage("resend", error));
    return false;
  }
}

async function logEscalation(env, record, transcript, ip, emailSent) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/concierge_escalations`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        prefer: "return=minimal",
      },
      body: JSON.stringify({ ...record, email_sent: emailSent, status: "open", source_ip: ip, transcript }),
    });
    // A rejected insert used to be discarded silently, so a broken table or a
    // stale key looked exactly like a working one.
    if (!res.ok) console.error("khaled_supabase_error", `supabase_${res.status}: ${await res.text()}`);
  } catch (error) {
    console.error("khaled_supabase_error", atStage("supabase", error));
  }
}

async function isRateLimited(env, ip) {
  if (!env.QOVALX_KV) return false; // KV binding is optional
  // The limiter is a safeguard, not a dependency. It runs before the main try
  // block, so an unhandled throw here would surface as a bare 500 with no
  // diagnosis; a KV outage lets requests through rather than taking Khaled down.
  try {
    const key = `khaled:${ip}:${Math.floor(Date.now() / 60000)}`;
    const count = Number((await env.QOVALX_KV.get(key)) || 0);
    if (count >= 12) return true;
    await env.QOVALX_KV.put(key, String(count + 1), { expirationTtl: 120 });
  } catch (error) {
    console.error("khaled_ratelimit_error", error);
  }
  return false;
}

function sanitiseMessages(input) {
  if (!Array.isArray(input)) return [];
  return input
    .slice(-MAX_TURNS)
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS_PER_MESSAGE) }))
    .filter((m) => m.content.trim().length > 0);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

function json(data, status = 200, origin = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...corsHeaders(origin),
    },
  });
}
