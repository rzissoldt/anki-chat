const HAN = /\p{Script=Han}/u;
const LETTER = /\p{L}/u;

export function hasHan(text: string): boolean {
  return HAN.test(text);
}

function letterAt(text: string, index: number): boolean {
  if (index < 0 || index >= text.length) return false;
  return LETTER.test(String.fromCodePoint(text.codePointAt(index)!));
}

/** Chinese surfaces match by prefix; Latin surfaces need word boundaries. */
export function surfaceMatchesAt(text: string, surface: string, cursor: number): boolean {
  if (!surface || !text.startsWith(surface, cursor)) return false;
  if (hasHan(surface)) return true;
  if (letterAt(text, cursor - 1)) return false;
  return !letterAt(text, cursor + surface.length);
}
