// shapes.js — the SHAPE of what a page prints, in any script. No English word lists: letters are \p{L}, digits are \p{Nd} (so ٣٤٥ and ३४५
// count), currency is \p{Sc}. A shape is evidence about what a string is (an amount, a date, a name); it never says what it means.
//
//   amount   digits in groups with any group separator a locale uses (1,234,567 · 1.234.567,89 · 1 234 567 · 1'234'567 · ١٬٢٣٤),
//            maybe signed or in parentheses, maybe with a currency sign
//   date     day/month/year in any order with - / . separators, or ISO, or digits around a month WORD (any script)
//   id       digit groups joined by - or / (62-0550979, 12/345/67890)
//   phone    a leading + or parenthesised area code, then digit groups
//   email · url
//   name     two to five words that each begin with a capital (scripts with case), or two or more words in a caseless script
//   choice   a single mark: ✓ ✔ ☑ ☒ ✗ X
//   text     anything else
const D = '\\p{Nd}';
export const AMOUNT = new RegExp(`^[\\p{Sc}~\\-−(+]?\\s?\\p{Sc}?\\s?${D}{1,3}([,.\\u00A0\\u202F' ٬]${D}{3})+([.,]${D}+)?\\)?\\s?\\p{Sc}?$|^[\\p{Sc}~\\-−]?${D}+([.,]${D}{1,2})?\\s?\\p{Sc}?$`, 'u');
const DATE = new RegExp(`^${D}{1,4}[-/.]${D}{1,2}[-/.]${D}{1,4}$|^${D}{4}-${D}{2}-${D}{2}$|^${D}{1,2}\\.?\\s+\\p{L}{3,12}\\.?\\s+${D}{2,4}$|^\\p{L}{3,12}\\.?\\s+${D}{1,2},?\\s+${D}{4}$`, 'u');
const ID = new RegExp(`^${D}{2,}([-/]${D}{2,})+$`, 'u');
const PHONE = new RegExp(`^(\\+${D}{1,3}[\\s.-]?)?(\\(${D}{2,4}\\)\\s?)?${D}{2,4}([\\s.-]${D}{2,8}){1,3}$`, 'u');
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/u, URL_ = /^(https?:\/\/|www\.)\S+$|^\S+\.(org|com|net|gov|edu|[a-z]{2})(\/\S*)?$/iu;
const CHOICE = /^[✓✔☑☒✗✘xX]$/u;
export function shapeOf(v) {
  const s = String(v ?? '').trim();
  if (!s) return 'empty';
  if (CHOICE.test(s)) return 'choice';
  if (EMAIL.test(s)) return 'email';
  if (DATE.test(s)) return 'date';
  if (ID.test(s)) return 'id-number';
  if (PHONE.test(s) && /[(+]/.test(s)) return 'phone';
  if (AMOUNT.test(s.replace(/[|]/g, '').trim())) return 'amount';
  if (URL_.test(s)) return 'url';
  const ws = s.split(/\s+/);
  if (ws.length >= 2 && ws.length <= 5 && ws.every((w) => /^[\p{Lu}][\p{L}.'’\-&]*$/u.test(w) || /^[\p{Lo}]+$/u.test(w) || /^(of|and|the|de|la|le|der|die|das|del|von|van|y|e|&)$/iu.test(w))) return 'name';
  return s.length > 60 ? 'free-text' : 'text';
}
/** Has at least `n` letters in a row, in any script. */
export const hasWord = (s, n = 3) => new RegExp(`\\p{L}{${n}}`, 'u').test(String(s || ''));
/** A numbered row of a table: "8", "16a", "(c)", "b", "١٢", "IV" at the start of a line. */
export const ROW = /^[^\p{L}\p{N}]{0,3}\(?(\p{Nd}{1,2}\p{Ll}?|\p{L}|[IVXLC]{1,4})\)?[\s.)|]/u;
/** A section marker: a short word and a numeral at the start of a short line ("Part I", "Teil 2", "Partie III", "第三部") — tolerant of OCR's I/l/1/| confusion. */
export const MARKER = /^(\p{L}{2,14})\s+(\p{Nd}{1,3}|[IVXLC1|!l]{1,5})\b|^(\p{L}{2,14})\p{Nd}{1,3}\b|^第[\p{N}一二三四五六七八九十百]+\p{Lo}/u;
/** A code a document prints about itself: a short word, then a token with a digit in it, maybe a year in parentheses ("Form 990 (2018)",
 *  "Cat. No. 11282Y", "Formulaire 2042", "Vordruck ESt 1 A"). */
export const CODE = /(\p{Lu}[\p{L}.]{1,14}(?:\s?\p{L}{1,4}\.)?)\s*([\p{Nd}\p{Lu}][\p{L}\p{Nd}.\-/]{0,12})(?:\s*\((\p{Nd}{4})\))?/gu;
