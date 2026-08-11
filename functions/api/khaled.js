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

APPROVED COMMERCIAL FACTS
All prices are pre-launch. Subscriptions open when the platform launches.
- QOVALX takes no commission from property sales and no percentage of consultation fees. A professional keeps what they earn and pays for access to the network instead.
- Broker: AED 99 per month, or AED 772.20 per year. Keeps 100 per cent of commission.
- Consultant: AED 149 per month, or AED 1,162.20 per year. Keeps 100 per cent of advisory fees.
- Annual billing carries a 35 per cent discount.
- Agencies: Foundation up to 25 seats at 15 per cent, Summit 26 to 50 seats at 25 per cent, Legacy 51 to 75 seats at 35 per cent, Infinity 76 or more seats by arrangement. The monthly seat base is the sum of broker seats at AED 99 and consultant seats at AED 149; the tier discount applies to that base, and annual billing then applies the further 35 per cent discount. Infinity is a fixed enterprise package, not a self-serve price, so route Infinity enquiries to the team.
- Developers: free at launch. Investors and Buyers: free at launch.
- Launch incentive: the first 299 professional subscribers receive six months free. The 299 is a combined total across brokers and consultants, not 299 of each.
You may calculate an agency seat base when the visitor gives you the number of broker and consultant seats, and you must show the calculation. Never quote a final Infinity price.

PLATFORM STATUS
QOVALX is under establishment and the trade name is reserved. The platform is in development. Registration opens when the platform launches, and no launch date has been announced. Intelligent matching is in development and returns no results yet. Never describe a feature as live.

ABSOLUTE PROHIBITIONS
Never invent prices, discounts, features, launch dates, user numbers, subscriber counts, transaction volumes, testimonials or case studies.
Never claim a partnership, licence, integration or endorsement with ADREC, DLD, RERA, any government body, any developer or any company.
Never promise that a service will remain free permanently.
Never give legal, investment, valuation or tax advice, and never comment on a specific property or its expected returns.
If you do not know something, say so and offer to pass the question to the team.

WHEN TO ESCALATE
Answer ordinary enquiries yourself. Call the escalate_to_founder tool only when the visitor raises one of the following:
- An agency, Infinity or enterprise subscription enquiry.
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

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_request" }, 400);
  }

  const messages = sanitiseMessages(body.messages);
  if (!messages.length) return json({ error: "invalid_request" }, 400);

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (await isRateLimited(env, ip)) return json({ error: "rate_limited" }, 429);

  try {
    let response = await callClaude(env, messages);
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
      response = await callClaude(env, followUp);
    }

    const reply = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    return json({ reply, escalated });
  } catch (error) {
    console.error("khaled_error", error);
    return json({ error: "unavailable" }, 503);
  }
}

async function callClaude(env, messages) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 700,
      system: SYSTEM_PROMPT,
      tools: [ESCALATION_TOOL],
      messages,
    }),
  });

  if (!res.ok) throw new Error(`anthropic_${res.status}: ${await res.text()}`);
  return res.json();
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

  const emailSent = await sendEmail(env, record, transcript);
  await logEscalation(env, record, transcript, ip, emailSent); // logging never blocks the visitor
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
    return res.ok;
  } catch (error) {
    console.error("email_error", error);
    return false;
  }
}

async function logEscalation(env, record, transcript, ip, emailSent) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    await fetch(`${env.SUPABASE_URL}/rest/v1/concierge_escalations`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        prefer: "return=minimal",
      },
      body: JSON.stringify({ ...record, email_sent: emailSent, status: "open", source_ip: ip, transcript }),
    });
  } catch (error) {
    console.error("supabase_error", error);
  }
}

async function isRateLimited(env, ip) {
  if (!env.QOVALX_KV) return false; // KV binding is optional
  const key = `khaled:${ip}:${Math.floor(Date.now() / 60000)}`;
  const count = Number((await env.QOVALX_KV.get(key)) || 0);
  if (count >= 12) return true;
  await env.QOVALX_KV.put(key, String(count + 1), { expirationTtl: 120 });
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

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
