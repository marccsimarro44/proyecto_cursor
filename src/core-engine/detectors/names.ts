import type { PatternMatch } from "@/lib/regex-utils/match";
import { AMBIGUOUS_FIRST_NAMES, FIRST_NAMES, foldName } from "./first-names";

/**
 * Names of people and companies, recognized from context rather than from a
 * format: there is no checksum for "Ana García". The rules favor precision,
 * since every false positive costs the reader a word, and the user can add
 * whatever slips through as a term of their own.
 *
 * People:
 * - a known first name followed by surnames ("Ana García de la Fuente");
 * - a known first name alone, unless it is also a common word ("Rosa");
 * - any capitalized name after a title ("Sra. Lozano") or a greeting
 *   ("Hola Ainhoa", "Atentamente,\nIñaki").
 *
 * Companies:
 * - capitalized words before a legal form ("Construcciones Levante, S.L.");
 * - capitalized words after a sector word ("Gestoría Ruiz y Asociados").
 *
 * A name never crosses a line break, tab or punctuation, so CSV columns and
 * list items stay apart.
 */

interface Word {
  text: string;
  /** `foldName(text)`. */
  folded: string;
  start: number;
  end: number;
}

const WORD = /[\p{L}\p{N}][\p{L}\p{M}\p{N}'’·ª-]*/gu;
const TITLE_CASE = /^\p{Lu}(?:[\p{Ll}\p{M}'’·ª]|$)/u;
const UPPER_CASE = /^\p{Lu}[\p{Lu}\p{M}'’·-]+$/u;
const STARTS_WITH_CAPITAL_OR_DIGIT = /^[\p{Lu}\p{N}]/u;

/** One to three spaces: two words of the same name. */
const INLINE_GAP = /^[ \u00A0]{1,3}$/;
const AMPERSAND_GAP = /^[ \u00A0]*&[ \u00A0]*$/;
/** After "Sr", "Dra.", or an initial such as the "M." of "Juan M. Soler". */
const ABBREVIATION_GAP = /^\.?[ \u00A0]{1,3}$/;
/** Between a greeting and the name: "Hola, Marta", "Atentamente,\nLuis". */
const GREETING_GAP = /^\.?[ \u00A0]*[,:]?[ \u00A0]*(?:\r?\n[ \u00A0]*)?$/;
/**
 * What may follow a name after a greeting when the name is not a known
 * first name: "Hola Ainhize," is a name, "Hola Necesito ayuda" is not.
 */
const NAME_END = /^(?:$|[ \u00A0]*(?:[,.:;!?)\r\n]|$))/;
const LEGAL_FORM_GAP = /^,?[ \u00A0]{0,3}$/;
/** Between two fields of a CSV or spreadsheet row. */
const FIELD_SEPARATOR = /^[,;\t|]$/;
const FIELD_END = /^(?:$|[,;\t|\r\n])/;
/** "Apellidos: Fernández Gil". */
const LABEL_GAP = /^[ \u00A0]*:[ \u00A0]*$/;
/** "GARCÍA LÓPEZ, MARÍA". */
const COMMA_GAP = /^,[ \u00A0]?$/;
const INVERTED_NAME_END = /^(?:$|[;\t|).\r\n])/;
/** What may come just before a field: start of text, line, cell or label. */
const FIELD_START = /(?:^|[\r\n\t;:(|])[ \u00A0]*$/;
/** The four characters before a word that opens a sentence or a line. */
const SENTENCE_START = /(?:^|[.:;!?¿¡"«(\r\n])[ \u00A0]*$/;

const PARTICLES = new Set([
  "de",
  "del",
  "la",
  "las",
  "los",
  "y",
  "i",
  "e",
  "da",
  "das",
  "do",
  "dos",
  "van",
  "von",
  "der",
  "di",
  "du",
]);

const CONJUNCTIONS = new Set(["y", "i", "e"]);

const SAINTS = new Set(["san", "santa", "santo", "sant"]);

/** Form fields whose value is a person's name: "Titular: …". */
const LABELS = new Set([
  "nombre",
  "apellidos",
  "apellido",
  "titular",
  "paciente",
  "cliente",
  "empleado",
  "empleada",
  "trabajador",
  "trabajadora",
  "alumno",
  "alumna",
  "firmante",
  "remitente",
  "destinatario",
  "destinataria",
  "interesado",
  "interesada",
  "solicitante",
  "contacto",
]);

const TITLES = new Set([
  "sr",
  "sra",
  "srta",
  "sres",
  "sras",
  "d",
  "dª",
  "dna",
  "don",
  "dona",
  "dr",
  "dra",
  "prof",
  "profa",
  "lic",
  "lcdo",
  "lcda",
  "ldo",
  "lda",
  "excmo",
  "excma",
  "ilmo",
  "ilma",
  "mr",
  "mrs",
  "ms",
]);

/** Titles that are also a single letter or a common word. */
const WEAK_TITLES = new Set(["d", "dª", "dona"]);

const GREETINGS = new Set([
  "hola",
  "estimado",
  "estimada",
  "querido",
  "querida",
  "atentamente",
  "cordialmente",
  "saludos",
  "saludo",
  "gracias",
  "fdo",
  "firmado",
  "firmada",
  "atte",
  "hello",
  "hi",
  "dear",
  "regards",
]);

/**
 * Capitalized words that can follow a title or greeting, or end a name,
 * without being a name: "Hola Equipo", "Ana García DNI 12345678Z".
 */
const NOT_NAMES = new Set([
  "a",
  "al",
  "el",
  "la",
  "los",
  "las",
  "un",
  "una",
  "mi",
  "mis",
  "tu",
  "su",
  "por",
  "para",
  "que",
  "todos",
  "todas",
  "equipo",
  "senor",
  "senora",
  "senores",
  "amigo",
  "amiga",
  "amigos",
  "companero",
  "companera",
  "companeros",
  "chicos",
  "chicas",
  "buenas",
  "buenos",
  "dias",
  "tardes",
  "noches",
  "cliente",
  "director",
  "directora",
  "dni",
  "nie",
  "nif",
  "cif",
  "iban",
  "tel",
  "telf",
  "telefono",
  "movil",
  "email",
  "correo",
  "calle",
  "avda",
  "plaza",
  "claude",
  "chatgpt",
  "gpt",
  "gemini",
  "copilot",
  "grok",
  "siri",
  "alexa",
  "cortana",
]);

const COMPANY_SECTORS = new Set([
  "fundacion",
  "asociacion",
  "cooperativa",
  "gestoria",
  "asesoria",
  "bufete",
  "despacho",
  "clinica",
  "consultora",
  "consultoria",
  "inmobiliaria",
  "constructora",
  "construcciones",
  "talleres",
  "transportes",
  "laboratorios",
  "distribuciones",
  "grupo",
  "hnos",
]);

const MAX_NAME_WORDS = 5;
const MAX_COMPANY_WORDS = 6;

/**
 * Spanish and common foreign legal forms, longest first. Dotted forms are
 * required to be uppercase as written ("S.L.", not "s.l.").
 */
const LEGAL_FORM =
  /(?<![\p{L}\p{N}])(?:S\.\s?L\.\s?U\.?|S\.\s?L\.\s?P\.?|S\.\s?L\.\s?L\.?|S\.\s?L\.\s?N\.\s?E\.?|S\.\s?A\.\s?U\.?|S\.\s?A\.\s?S\.?|S\.\s?Coop\.?|S\.\s?L\.?|S\.\s?A\.?|S\.\s?C\.|C\.\s?B\.|A\.\s?I\.\s?E\.?|S\.\s?r\.\s?l\.?|B\.\s?V\.|SLU|SLL|SLNE|SAU|SL|SA|Ltd\.?|LLC|Inc\.?|GmbH|Sociedad\s+Limitada(?:\s+Unipersonal)?|Sociedad\s+An[oó]nima)(?![\p{L}\p{N}])/gu;

function splitWords(text: string): Word[] {
  const words: Word[] = [];
  for (const match of text.matchAll(WORD)) {
    words.push({
      text: match[0],
      folded: foldName(match[0]),
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return words;
}

function gap(text: string, before: Word, after: Word): string {
  return text.slice(before.end, after.start);
}

function isTitleCase(word: Word): boolean {
  return TITLE_CASE.test(word.text);
}

function isUpperCase(word: Word): boolean {
  return UPPER_CASE.test(word.text);
}

/**
 * A capitalized word that can be part of a name. In a name written in
 * capitals every word is; otherwise short capitals are acronyms ("DNI").
 */
function isNamePart(word: Word, upper: boolean): boolean {
  if (NOT_NAMES.has(word.folded)) return false;
  // "Estimada Sra. Lozano": the title introduces the name. A single letter
  // stays a possible initial ("Juan D. Soler").
  if (word.text.length > 1 && TITLES.has(word.folded)) return false;
  if (upper) return isUpperCase(word);
  return isTitleCase(word) || (isUpperCase(word) && word.text.length >= 4);
}

/**
 * After "y" or "i", whether the word at `index` opens a second name ("Ana
 * Martín y Luis Pérez") rather than closing this one ("Puig i Soler"): a
 * first name, or a word followed by more capitalized words.
 */
function startsAnotherName(
  text: string,
  words: readonly Word[],
  index: number,
  upper: boolean,
): boolean {
  const next = words[index + 1];
  return (
    FIRST_NAMES.has(words[index].folded) ||
    (next !== undefined &&
      INLINE_GAP.test(gap(text, words[index], next)) &&
      isNamePart(next, upper))
  );
}

/** Index of the last word of the name that starts at `first`. */
function extendName(
  text: string,
  words: readonly Word[],
  first: number,
  upper: boolean,
): number {
  let last = first;
  let count = 1;
  while (count < MAX_NAME_WORDS) {
    const previous = words[last];
    const next = words[last + 1];
    if (next === undefined) break;
    const between = gap(text, previous, next);
    const isInitial = previous.text.length === 1;
    if (
      !INLINE_GAP.test(between) &&
      !(isInitial && ABBREVIATION_GAP.test(between))
    ) {
      break;
    }

    if (isNamePart(next, upper)) {
      last++;
      count++;
      continue;
    }

    // "de la Fuente": up to two particles, then a name part. A conjunction
    // joins surnames ("Puig i Soler"), never two people ("Ana y Luis").
    let index = last + 1;
    while (
      index - last <= 2 &&
      words[index] !== undefined &&
      PARTICLES.has(words[index].folded) &&
      (count >= 2 || !CONJUNCTIONS.has(words[index].folded))
    ) {
      const after = words[index + 1];
      if (
        after === undefined ||
        !INLINE_GAP.test(gap(text, words[index], after))
      ) {
        break;
      }
      if (
        isNamePart(after, upper) &&
        !(
          CONJUNCTIONS.has(words[index].folded) &&
          startsAnotherName(text, words, index + 1, upper)
        )
      ) {
        last = index + 1;
        count++;
        break;
      }
      index++;
    }
    if (last < index) break;
  }
  return last;
}

/**
 * In a table row such as `Pilar;García López;…`, the index of the last word
 * of the field after the first name when that field holds only surnames.
 */
function surnameField(
  text: string,
  words: readonly Word[],
  last: number,
  upper: boolean,
): number | undefined {
  const next = words[last + 1];
  if (
    next === undefined ||
    !FIELD_SEPARATOR.test(gap(text, words[last], next)) ||
    !isNamePart(next, upper) ||
    FIRST_NAMES.has(next.folded)
  ) {
    return undefined;
  }
  const end = extendName(text, words, last + 1, upper);
  const after = text.slice(words[end].end, words[end].end + 2);
  return FIELD_END.test(after) ? end : undefined;
}

/**
 * "GARCÍA LÓPEZ, MARÍA": the index of the last word of the first name after
 * the surnames at `last`, when the field ends there.
 */
function firstNameAfterComma(
  text: string,
  words: readonly Word[],
  last: number,
  upper: boolean,
): number | undefined {
  const next = words[last + 1];
  if (
    next === undefined ||
    !COMMA_GAP.test(gap(text, words[last], next)) ||
    !FIRST_NAMES.has(next.folded) ||
    !isNamePart(next, upper)
  ) {
    return undefined;
  }
  const end = extendName(text, words, last + 1, upper);
  const after = text.slice(words[end].end, words[end].end + 2);
  return INVERTED_NAME_END.test(after) ? end : undefined;
}

/**
 * "GARCÍA LÓPEZ, MARÍA" seen from the first name at `index`: the index of
 * the first surname, when the surnames open a field or a line.
 */
function surnamesBeforeComma(
  text: string,
  words: readonly Word[],
  index: number,
  upper: boolean,
): number | undefined {
  const previous = words[index - 1];
  if (
    previous === undefined ||
    !COMMA_GAP.test(gap(text, previous, words[index])) ||
    !isNamePart(previous, upper)
  ) {
    return undefined;
  }
  let first = index - 1;
  for (let count = 1; count < MAX_NAME_WORDS - 1; count++) {
    const before = words[first - 1];
    if (
      before === undefined ||
      !INLINE_GAP.test(gap(text, before, words[first])) ||
      !(isNamePart(before, upper) || PARTICLES.has(before.folded))
    ) {
      break;
    }
    first--;
  }
  while (PARTICLES.has(words[first].folded)) first++;
  const start = words[first].start;
  return FIELD_START.test(text.slice(Math.max(0, start - 4), start))
    ? first
    : undefined;
}

function span(text: string, from: Word, to: Word): PatternMatch {
  return {
    value: text.slice(from.start, to.end),
    start: from.start,
    end: to.end,
  };
}

/** Finds the names of people in `text`, in order. */
export function findPersonNames(text: string): PatternMatch[] {
  const words = splitWords(text);
  const found: PatternMatch[] = [];

  let index = 0;
  while (index < words.length) {
    const word = words[index];
    const next = words[index + 1];

    // "Apellidos: Fernández Gil", "Paciente: GARCÍA LÓPEZ, MARÍA".
    if (
      LABELS.has(word.folded) &&
      next !== undefined &&
      LABEL_GAP.test(gap(text, word, next))
    ) {
      const upper = isUpperCase(next);
      if (isNamePart(next, upper) && !PARTICLES.has(next.folded)) {
        let last = extendName(text, words, index + 1, upper);
        last = firstNameAfterComma(text, words, last, upper) ?? last;
        found.push(span(text, next, words[last]));
        index = last + 1;
        continue;
      }
    }

    // "Sra. Lozano", "Hola Ainhoa": the cue is not part of the name.
    const isTitle = TITLES.has(word.folded) && isTitleCase(word);
    const isGreeting = GREETINGS.has(word.folded);
    if (
      (isTitle || isGreeting) &&
      next !== undefined &&
      (isTitle ? ABBREVIATION_GAP : GREETING_GAP).test(gap(text, word, next))
    ) {
      const upper = isUpperCase(next);
      if (isNamePart(next, upper) && !PARTICLES.has(next.folded)) {
        const last = extendName(text, words, index + 1, upper);
        const known = FIRST_NAMES.has(next.folded);
        const accepted = isTitle
          ? !WEAK_TITLES.has(word.folded) || last > index + 1 || known
          : known ||
            NAME_END.test(text.slice(words[last].end, words[last].end + 8));
        if (accepted) {
          found.push(span(text, next, words[last]));
          index = last + 1;
          continue;
        }
      }
    }

    // "San Sebastián", "Santa Teresa": a place or a saint.
    const previous = words[index - 1];
    const afterSaint =
      previous !== undefined &&
      SAINTS.has(previous.folded) &&
      INLINE_GAP.test(gap(text, previous, word));

    if (
      FIRST_NAMES.has(word.folded) &&
      !NOT_NAMES.has(word.folded) &&
      !afterSaint &&
      (isTitleCase(word) || isUpperCase(word))
    ) {
      const upper = isUpperCase(word);
      const last = extendName(text, words, index, upper);

      const surnamesFirst = surnamesBeforeComma(text, words, index, upper);
      const previousEnd = found.at(-1)?.end ?? -1;
      if (
        surnamesFirst !== undefined &&
        words[surnamesFirst].start >= previousEnd &&
        INVERTED_NAME_END.test(text.slice(words[last].end, words[last].end + 2))
      ) {
        found.push(span(text, words[surnamesFirst], words[last]));
        index = last + 1;
        continue;
      }

      const surnames = surnameField(text, words, last, upper);
      const alone = last === index;
      if (
        !alone ||
        surnames !== undefined ||
        (!upper && !AMBIGUOUS_FIRST_NAMES.has(word.folded))
      ) {
        found.push(span(text, word, words[last]));
        index = last + 1;
        if (surnames !== undefined) {
          found.push(span(text, words[index], words[surnames]));
          index = surnames + 1;
        }
        continue;
      }
    }

    index++;
  }
  return found;
}

/** Index of the first word of the company name that ends at `last`. */
function extendCompanyBackward(
  text: string,
  words: readonly Word[],
  last: number,
): number {
  let first = last;
  let count = 1;
  for (let index = last - 1; index >= 0 && count < MAX_COMPANY_WORDS; index--) {
    const between = gap(text, words[index], words[index + 1]);
    if (!INLINE_GAP.test(between) && !AMPERSAND_GAP.test(between)) break;
    const word = words[index];
    if (STARTS_WITH_CAPITAL_OR_DIGIT.test(word.text)) {
      if (NOT_NAMES.has(word.folded) || GREETINGS.has(word.folded)) break;
      // "Factura de Construcciones…": capitalized only to open the sentence.
      // "Pide Construcciones…": the sector word already opens the name.
      if (
        (first - index > 1 || COMPANY_SECTORS.has(words[first].folded)) &&
        startsSentence(text, word)
      ) {
        break;
      }
      first = index;
      count++;
    } else if (!PARTICLES.has(word.folded)) {
      break;
    } else if (
      // "Ana Martín y Bricolaje Express, S.A.": two parties, not one name.
      CONJUNCTIONS.has(word.folded) &&
      [words[index - 1], words[index - 2]].some(
        (before) => before !== undefined && FIRST_NAMES.has(before.folded),
      )
    ) {
      break;
    }
  }
  return first;
}

function startsSentence(text: string, word: Word): boolean {
  return SENTENCE_START.test(
    text.slice(Math.max(0, word.start - 4), word.start),
  );
}

/** Index of the last word of the company name that starts at `first`. */
function extendCompanyForward(
  text: string,
  words: readonly Word[],
  first: number,
): number {
  let last = first;
  let count = 1;
  for (
    let index = first + 1;
    index < words.length && count < MAX_COMPANY_WORDS;
    index++
  ) {
    const between = gap(text, words[index - 1], words[index]);
    if (!INLINE_GAP.test(between) && !AMPERSAND_GAP.test(between)) break;
    const word = words[index];
    if (STARTS_WITH_CAPITAL_OR_DIGIT.test(word.text)) {
      if (NOT_NAMES.has(word.folded)) break;
      last = index;
      count++;
    } else if (!PARTICLES.has(word.folded)) {
      break;
    }
  }
  return last;
}

/** Finds the names of companies and organizations in `text`, in order. */
export function findCompanyNames(text: string): PatternMatch[] {
  const words = splitWords(text);
  const found: PatternMatch[] = [];

  // "Gestoría Ruiz y Asociados"
  for (let index = 0; index < words.length - 1; index++) {
    const word = words[index];
    if (!COMPANY_SECTORS.has(word.folded)) continue;
    if (!isTitleCase(word) && !isUpperCase(word)) continue;
    const last = extendCompanyForward(text, words, index);
    if (last > index) {
      found.push(span(text, word, words[last]));
      index = last;
    }
  }

  // "Construcciones Levante, S.L."
  let cursor = 0;
  for (const match of text.matchAll(LEGAL_FORM)) {
    while (cursor < words.length && words[cursor].end <= match.index) {
      cursor++;
    }
    const lastIndex = cursor - 1;
    const last = words[lastIndex];
    if (
      last === undefined ||
      !LEGAL_FORM_GAP.test(text.slice(last.end, match.index)) ||
      !STARTS_WITH_CAPITAL_OR_DIGIT.test(last.text) ||
      NOT_NAMES.has(last.folded)
    ) {
      continue;
    }
    const first = words[extendCompanyBackward(text, words, lastIndex)];
    const end = match.index + match[0].length;
    found.push({
      value: text.slice(first.start, end),
      start: first.start,
      end,
    });
  }

  // Both rules can find the same company; keep the longest of each overlap.
  found.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: PatternMatch[] = [];
  for (const match of found) {
    const last = kept[kept.length - 1];
    if (last === undefined || match.start >= last.end) kept.push(match);
    else if (match.end > last.end)
      kept[kept.length - 1] = {
        ...last,
        end: match.end,
        value: text.slice(last.start, match.end),
      };
  }
  return kept;
}
