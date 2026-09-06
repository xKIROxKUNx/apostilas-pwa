function foldChar(c: string): string {
  const decomposed = c.normalize("NFD");
  return (decomposed[0] ?? c).toLowerCase();
}

export function fold(text: string): string {
  let out = "";
  for (const c of text) out += foldChar(c);
  return out;
}

export interface Match {
  start: number;
  end: number;
}

export function findOccurrences(haystack: string, needle: string): Match[] {
  if (needle.trim().length === 0 || haystack.length === 0) return [];

  const foldedHay = fold(haystack);
  const foldedNeedle = fold(needle);
  if (foldedNeedle.length > foldedHay.length) return [];

  const result: Match[] = [];
  let from = 0;
  while (from <= foldedHay.length - foldedNeedle.length) {
    const at = foldedHay.indexOf(foldedNeedle, from);
    if (at < 0) break;
    result.push({ start: at, end: at + foldedNeedle.length });
    from = at + foldedNeedle.length;
  }
  return result;
}

export interface Snippet {
  text: string;
  matchStart: number;
  matchEnd: number;
}

export function snippetAround(text: string, match: Match, context = 48): Snippet {
  const start = Math.max(match.start - context, 0);
  const end = Math.min(match.end + context, text.length);

  let body = "";
  for (let i = start; i < end; i++) {
    const c = text[i];
    body += /\s/.test(c) ? " " : c;
  }

  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  const matchStart = prefix.length + (match.start - start);

  return {
    text: prefix + body + suffix,
    matchStart,
    matchEnd: matchStart + (match.end - match.start),
  };
}
