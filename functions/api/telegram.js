export async function onRequestPost(context) {
 const { request, env } = context;
 const secret = request.headers.get("x-telegram-bot-api-secret-token");
 if (!env.TELEGRAM_WEBHOOK_SECRET || secret !== env.TELEGRAM_WEBHOOK_SECRET) {
   return new Response("forbidden", { status: 403 });
 }
 let update;
 try {
   update = await request.json();
 } catch {
   return new Response("ok");
 }
 const msg = update.message;
 if (!msg) return new Response("ok");
 const chatId = msg.chat.id;
 if (String(chatId) !== String(env.FOUNDER_CHAT_ID)) {
   context.waitUntil(sendMessage(env, chatId, "This bot is private."));
   return new Response("ok");
 }
 context.waitUntil(handle(env, msg, chatId));
 return new Response("ok");
}
async function handle(env, msg, chatId) {
 let taskId = null;
 try {
   const voice = msg.voice || msg.audio;
   let transcript = null;
   if (voice) {
     await sendMessage(env, chatId, "استلمت الصوت، جاري التفريغ…");
     taskId = await createTask(env, {
       telegram_chat_id: chatId,
       telegram_message_id: msg.message_id,
       voice_file_id: voice.file_id,
       status: "received",
     });
     transcript = await transcribe(env, voice.file_id);
     await updateTask(env, taskId, { transcript, status: "transcribed" });
     await sendMessage(env, chatId, "النص:\n\n" + transcript);
   } else if (msg.text) {
     if (msg.text.startsWith("/start")) {
       await sendMessage(
         env,
         chatId,
         "جاهز. أرسل فويس نوت أو نص يوصف المنشور المطلوب."
       );
       return;
     }
     transcript = msg.text;
     taskId = await createTask(env, {
       telegram_chat_id: chatId,
       telegram_message_id: msg.message_id,
       transcript,
       status: "transcribed",
     });
   } else {
     await sendMessage(env, chatId, "أرسل فويس نوت أو نص.");
     return;
   }
   await sendMessage(env, chatId, "جاري تجهيز الخطة…");
   const plan = await plan_from_transcript(env, transcript);
   await updateTask(env, taskId, {
     plan_ar: plan.ar,
     plan_en: plan.en,
     status: "planned",
   });
   await sendMessage(env, chatId, "الخطة بالعربي\n\n" + plan.ar);
   await sendMessage(env, chatId, "English version\n\n" + plan.en);
 } catch (err) {
   const detail = String(err && err.message ? err.message : err).slice(0, 900);
   if (taskId) {
     await updateTask(env, taskId, { status: "failed", error_detail: detail });
   }
   await sendMessage(env, chatId, "صار خطأ:\n" + detail);
 }
}
async function tg(env, method, body) {
 const res = await fetch(
   `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,
   {
     method: "POST",
     headers: { "content-type": "application/json" },
     body: JSON.stringify(body),
   }
 );
 const data = await res.json();
 if (!data.ok) throw new Error(`Telegram ${method}: ${data.description}`);
 return data.result;
}
function sendMessage(env, chatId, text) {
 return tg(env, "sendMessage", { chat_id: chatId, text }).catch(() => {});
}
async function transcribe(env, fileId) {
 const file = await tg(env, "getFile", { file_id: fileId });
 const audioRes = await fetch(
   `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`
 );
 if (!audioRes.ok) throw new Error("تعذر تحميل الملف الصوتي");
 const audio = await audioRes.blob();
 const form = new FormData();
 form.append("file", audio, "voice.ogg");
 form.append("model_id", "scribe_v1");
 form.append("language_code", "ara");
 const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
   method: "POST",
   headers: { "xi-api-key": env.ELEVENLABS_API_KEY },
   body: form,
 });
 if (!res.ok) {
   throw new Error(
     "ElevenLabs " + res.status + ": " + (await res.text()).slice(0, 300)
   );
 }
 const data = await res.json();
 const text = (data.text || "").trim();
 if (!text) throw new Error("التفريغ رجع فاضي");
 return text;
}
const SYSTEM_PROMPT = `أنت مخطط محتوى التواصل الاجتماعي لشركة QOVALX.
عن الشركة:
QOVALX شبكة مهنية للقطاع العقاري، تأسست في أبوظبي وتستهدف الإمارات والأسواق العالمية. الاسم يرمز إلى Quality وOpportunity وValue وExchange. المنصة تخدم أربع فئات: المهنيين (وسطاء ومستشارون)، الوكالات، المطورين العقاريين، والمستثمرين والمشترين. الموقع www.qovalx.com متاح بسبع لغات. المنصة نفسها قيد التطوير.
الوصف المعتمد: The Professional Network for Real Estate
عبارة الأصل: Born in Abu Dhabi. Built for global real estate.
قواعد إلزامية:
- ممنوع اختراع أي إحصائية أو رقم أو نسبة أو عدد مستخدمين.
- ممنوع ادعاء شراكات أو تكاملات حكومية أو تراخيص أو موافقات تنظيمية.
- ممنوع الإيحاء بوجود مكتب فعلي أو فريق قائم.
- ممنوع أسلوب الثراء السريع أو الوعود بعوائد مضمونة.
- ممنوع وصف المنصة كأنها مطلقة وجاهزة؛ الموقع متاح والمنصة قيد التطوير.
- ممنوع الإيموجي نهائياً.
- الإنجليزية بالإملاء البريطاني.
- ممنوع القوائم النقطية داخل نص المنشور؛ جمل مترابطة كاملة بأفعال فعّالة.
- QOVALX تُكتب دائماً بحروف لاتينية كبيرة، ولا تُترجم إلى العربية.
أخرج JSON فقط بدون أي نص قبله أو بعده وبدون علامات كود، بهذا الشكل بالضبط:
{"ar":"...","en":"..."}
كل قيمة تحتوي على خطة منشور مكتوبة كنص عادي تشمل: الفكرة في سطر، نص المنشور، اقتراح المرئي، وسبعة إلى عشرة هاشتاقات. العربية والإنجليزية نسختان متكافئتان لا ترجمة حرفية.`;
async function plan_from_transcript(env, transcript) {
 const res = await fetch("https://api.anthropic.com/v1/messages", {
   method: "POST",
   headers: {
     "content-type": "application/json",
     "x-api-key": env.ANTHROPIC_API_KEY,
     "anthropic-version": "2023-06-01",
   },
   body: JSON.stringify({
     model: "claude-sonnet-5",
     max_tokens: 2000,
     system: SYSTEM_PROMPT,
     messages: [
       {
         role: "user",
         content:
           "طلب المؤسس (مفرّغ من رسالة صوتية، قد يحتوي أخطاء تفريغ):\n\n" +
           transcript,
       },
     ],
   }),
 });
 if (!res.ok) {
   throw new Error(
     "Anthropic " + res.status + ": " + (await res.text()).slice(0, 300)
   );
 }
 const data = await res.json();
 const raw = (data.content || [])
   .filter((b) => b.type === "text")
   .map((b) => b.text)
   .join("")
   .replace(/```json|```/g, "")
   .trim();
 const parsed = JSON.parse(raw);
 if (!parsed.ar || !parsed.en) throw new Error("رد كلود ناقص");
 return parsed;
}
async function createTask(env, row) {
 const res = await fetch(`${env.SUPABASE_URL}/rest/v1/social_tasks`, {
   method: "POST",
   headers: {
     "content-type": "application/json",
     apikey: env.SUPABASE_SERVICE_ROLE_KEY,
     authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
     prefer: "return=representation",
   },
   body: JSON.stringify(row),
 });
 if (!res.ok)
   throw new Error("Supabase insert: " + (await res.text()).slice(0, 300));
 const data = await res.json();
 return data[0].id;
}
async function updateTask(env, id, patch) {
 await fetch(`${env.SUPABASE_URL}/rest/v1/social_tasks?id=eq.${id}`, {
   method: "PATCH",
   headers: {
     "content-type": "application/json",
     apikey: env.SUPABASE_SERVICE_ROLE_KEY,
     authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
   },
   body: JSON.stringify(patch),
 });
}
