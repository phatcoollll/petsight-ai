// Gọi Google Gemini (REST generateContent) và ép kết quả theo JSON schema — chỉ chạy ở server.
// Khoá GEMINI_API_KEY nằm trong .env, không bao giờ gửi xuống trình duyệt và không ghi ra log.
import { logError } from './security.js';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

// Schema dạng OpenAPI cũ (responseSchema) dùng kiểu viết hoa; chỉ dùng khi model không nhận responseJsonSchema.
function toLegacySchema(s) {
  if (!s || typeof s !== 'object') return s;
  const out = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === 'type') out.type = String(v).toUpperCase();
    else if (k === 'properties') out.properties = Object.fromEntries(Object.entries(v).map(([p, ps]) => [p, toLegacySchema(ps)]));
    else if (k === 'items') out.items = toLegacySchema(v);
    else if (['description', 'enum', 'required', 'minItems', 'maxItems', 'nullable', 'format'].includes(k)) out[k] = v;
  }
  return out;
}

// Lỗi tạm thời phía Google (quá tải, giới hạn, lỗi máy chủ, quá thời gian): chuyển sang model dự phòng.
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const ATTEMPT_TIMEOUT = 20_000;   // mỗi lần thử tối đa 20 giây (model quá tải thường treo, không trả lỗi)
const TOTAL_BUDGET = 65_000;      // cả yêu cầu tối đa 65 giây, kể cả các lần thử model dự phòng
const COOLDOWN = 60_000;          // model vừa báo quá tải: bỏ qua 60 giây cho các yêu cầu sau

// parts: [{ text }] hoặc [{ image: { mediaType, data(base64) } }]
// models: model chính trước, sau đó các model dự phòng theo thứ tự.
export function createGemini({ apiKey, models }) {
  const busyUntil = new Map();

  function call(model, parts, schema, legacy, maxTokens, timeoutMs) {
    const generationConfig = { responseMimeType: 'application/json', maxOutputTokens: maxTokens, temperature: 0.4 };
    if (legacy) generationConfig.responseSchema = toLegacySchema(schema);
    else generationConfig.responseJsonSchema = schema;
    return fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: parts.map((p) => (p.image ? { inline_data: { mime_type: p.image.mediaType, data: p.image.data } } : { text: p.text })) }],
        generationConfig,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  }

  // Một lần thử với một model. Trả về object kết quả, hoặc ném { code, retry } (retry = nên thử model khác).
  // Lưu ý: lỗi hết giờ của fetch là DOMException có code SỐ (23), nên chỉ coi lỗi có code CHUỖI là lỗi của mình.
  async function attempt(model, parts, schema, maxTokens, timeoutMs) {
    const ours = (e) => e && typeof e.code === 'string';
    try {
      let res = await call(model, parts, schema, false, maxTokens, timeoutMs);
      if (res.status === 400) {
        const body = await res.text();
        // Model cũ chưa hỗ trợ responseJsonSchema → thử lại với responseSchema.
        if (/responseJsonSchema|response_json_schema/i.test(body)) res = await call(model, parts, schema, true, maxTokens, timeoutMs);
        else { logError('Gemini 400 (' + model + '):', body.slice(0, 300)); throw { code: 'upstream_error', retry: false }; }
      }
      if (!res.ok) {
        const body = (await res.text()).slice(0, 200);
        logError('Gemini ' + res.status + ' (' + model + '):', body);
        const busy = res.status === 503 || res.status === 429;
        if (busy) busyUntil.set(model, Date.now() + COOLDOWN);
        // 404: model không tồn tại hoặc đã ngừng → thử model khác. 401/403: khóa sai → dừng luôn.
        throw { code: busy ? 'ai_busy' : 'upstream_error', retry: RETRYABLE.has(res.status) || res.status === 404 };
      }
      const data = await res.json();
      const cand = data.candidates?.[0];
      const text = (cand?.content?.parts || []).filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join('');
      if (!text) { logError('Gemini: no content (' + model + '), finishReason =', cand?.finishReason, data.promptFeedback?.blockReason || ''); throw { code: 'invalid_json', retry: cand?.finishReason !== 'SAFETY' }; }
      try { return JSON.parse(text); } catch { logError('Gemini: JSON parse failed (' + model + '), finishReason =', cand?.finishReason); throw { code: 'invalid_json', retry: true }; }
    } catch (err) {
      if (ours(err)) throw err;
      // Hết giờ (treo) hoặc lỗi mạng: coi như quá tải, nghỉ model này một lúc.
      logError('Gemini request failed (' + model + '):', err?.name || 'error');
      if (err?.name === 'TimeoutError') busyUntil.set(model, Date.now() + COOLDOWN);
      throw { code: err?.name === 'TimeoutError' ? 'ai_busy' : 'upstream_error', retry: true };
    }
  }

  return async function askGemini({ parts, schema, maxTokens = 8192 }) {
    const now = Date.now();
    // Model đang trong thời gian nghỉ được đưa xuống cuối danh sách (vẫn thử nếu các model khác cũng lỗi).
    const order = [...models.filter((m) => !(busyUntil.get(m) > now)), ...models.filter((m) => busyUntil.get(m) > now)];
    const deadline = now + TOTAL_BUDGET;
    let lastErr = { code: 'upstream_error' };
    // Tối đa 2 vòng: nếu cả danh sách đều báo quá tải mà còn thời gian, nghỉ 2 giây rồi thử lại một vòng.
    for (let round = 0; round < 2; round++) {
      if (round > 0) {
        if (lastErr.code !== 'ai_busy' || deadline - Date.now() < 10_000) break;
        await new Promise((r) => setTimeout(r, 2_000));
      }
      for (const [i, model] of order.entries()) {
        const left = deadline - Date.now();
        if (left < 5_000) break; // không còn đủ thời gian cho một lần thử nữa
        try {
          const out = await attempt(model, parts, schema, maxTokens, Math.min(ATTEMPT_TIMEOUT, left));
          if (i > 0 || round > 0) console.log('Gemini: dùng model dự phòng', model, round > 0 ? '(vòng 2)' : '');
          return out;
        } catch (err) {
          lastErr = err;
          if (!err.retry) { round = 2; break; }
          if (i < order.length - 1) await new Promise((r) => setTimeout(r, 300));
        }
      }
    }
    throw { code: lastErr.code };
  };
}
