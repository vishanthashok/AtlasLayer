/**
 * Pull a single JSON object from LLM text that may include markdown fences or preamble.
 */
export function stripMarkdownCodeFence(text: string): string {
  const s = text.trim();
  const m = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (m?.[1]) return m[1].trim();
  return s;
}

/**
 * Walk from first `{` and balance braces while respecting JSON strings (basic escapes).
 */
export function extractBalancedJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const c = text[i]!;

    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }

    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{') depth++;
    if (c === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return null;
}

export function parseJsonFromModelOutput(raw: string): Record<string, unknown> | null {
  const candidates = [raw.trim(), stripMarkdownCodeFence(raw)];

  for (const candidate of candidates) {
    const balanced = extractBalancedJsonObject(candidate);
    const jsonStr = balanced;
    if (!jsonStr) continue;
    try {
      const v = JSON.parse(jsonStr);
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        return v as Record<string, unknown>;
      }
    } catch {
      continue;
    }
  }

  return null;
}
