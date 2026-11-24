// Chọn nhà cung cấp AI: Gemini là chính (GEMINI_API_KEY); Claude chỉ dùng khi không có khoá Gemini.
// Cả hai đều nhận cùng một "tool" { name, input_schema } và trả về object đã khớp schema.
import { createGemini } from './gemini.js';
import { logError } from './security.js';

function createClaude({ apiKey, model }) {
  return async function askClaude({ parts, tool, maxTokens = 1500 }) {
    const content = parts.map((p) => (p.image
      ? { type: 'image', source: { type: 'base64', media_type: p.image.mediaType, data: p.image.data } }
      : { type: 'text', text: p.text }));
    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: maxTokens, tools: [tool], tool_choice: { type: 'tool', name: tool.name }, messages: [{ role: 'user', content }] }),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (err) { logError('Anthropic request failed:', err.name); throw { code: 'upstream_error' }; }
    if (!res.ok) { logError('Anthropic API error:', res.status, (await res.text()).slice(0, 300)); throw { code: 'upstream_error' }; }
    const block = (await res.json()).content?.find((b) => b.type === 'tool_use');
    if (!block?.input) throw { code: 'invalid_json' };
    return block.input;
  };
}

export function createAI(env) {
  if (env.GEMINI_API_KEY) {
    const model = env.GEMINI_MODEL || 'gemini-3.8-flash';
    // Model dự phòng khi model chính quá tải hoặc lỗi tạm thời (đổi bằng GEMINI_FALLBACK_MODELS, cách nhau dấu phẩy).
    const fallbacks = (env.GEMINI_FALLBACK_MODELS ?? 'gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-flash-lite-latest').split(',').map((s) => s.trim()).filter((m) => m && m !== model);
    const ask = createGemini({ apiKey: env.GEMINI_API_KEY, models: [model, ...fallbacks] });
    return { provider: 'Gemini', model: [model, ...fallbacks].join(' → '), ask: ({ parts, tool }) => ask({ parts, schema: tool.input_schema }) };
  }
  if (env.ANTHROPIC_API_KEY) {
    const model = env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
    const ask = createClaude({ apiKey: env.ANTHROPIC_API_KEY, model });
    return { provider: 'Claude', model, ask: ({ parts, tool }) => ask({ parts, tool }) };
  }
  return null;
}
