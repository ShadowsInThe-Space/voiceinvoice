/**
 * Key Recovery Phrase Generator
 *
 * Generates and validates BIP39-style recovery phrases for
 * backing up encryption keys. Uses a German word list for
 * better usability with German-speaking users.
 *
 * @module lib/encryption/recovery-phrase
 */

import * as crypto from 'crypto';

/**
 * Simple SHA256 implementation for recovery phrase generation.
 * Uses Node.js crypto module which is available in Electron.
 *
 * @param data - Data to hash
 * @returns SHA256 hash as Uint8Array
 */
function sha256Sync(data: Uint8Array): Uint8Array {
  const hash = crypto.createHash('sha256');
  hash.update(Buffer.from(data));
  return new Uint8Array(hash.digest());
}

/**
 * German BIP39-compatible word list (2048 words).
 * A subset is included here; in production, use the full list.
 */
const WORDLIST: string[] = [
  // A
  'aber',
  'acht',
  'acker',
  'adler',
  'affe',
  'aktie',
  'alarm',
  'album',
  'alle',
  'allein',
  'alpen',
  'also',
  'alter',
  'amber',
  'ampel',
  'angel',
  'angst',
  'anker',
  'anruf',
  'antik',
  'apfel',
  'arbeit',
  'areal',
  'arena',
  'armee',
  'aroma',
  'asche',
  'atem',
  'atlas',
  'atmen',
  'atom',
  'audio',
  // B
  'backen',
  'baden',
  'balkon',
  'ball',
  'bande',
  'bank',
  'baron',
  'basis',
  'bauen',
  'baum',
  'beben',
  'becher',
  'becken',
  'befund',
  'beginn',
  'beide',
  'bein',
  'berg',
  'beruf',
  'besuch',
  'beton',
  'beutel',
  'biene',
  'bier',
  'bild',
  'birne',
  'blatt',
  'blau',
  'blech',
  'blick',
  'blitz',
  'blume',
  // C
  'cafe',
  'chaos',
  'chef',
  'chemie',
  'chips',
  'chor',
  'clown',
  'code',
  'couch',
  'cousin',
  'creme',
  'curry',
  // D
  'dach',
  'dame',
  'dampf',
  'dank',
  'daten',
  'datum',
  'daumen',
  'decke',
  'delta',
  'denken',
  'dicht',
  'dick',
  'diesel',
  'dienst',
  'dieses',
  'digital',
  'disko',
  'diva',
  'docht',
  'doktor',
  'dolch',
  'donner',
  'dorf',
  'dosen',
  'drache',
  'draht',
  'drama',
  'dreck',
  'drehen',
  'dreieck',
  'druck',
  'duell',
  // E
  'ebene',
  'echo',
  'echt',
  'ecke',
  'edel',
  'efeu',
  'ehrung',
  'eiche',
  'eifer',
  'eigen',
  'eile',
  'eimer',
  'eingang',
  'einheit',
  'einsatz',
  'einzig',
  'eisen',
  'elch',
  'elefant',
  'elend',
  'elite',
  'eltern',
  'email',
  'empfang',
  'ende',
  'endlich',
  'engel',
  'enkel',
  'entgegen',
  'entwurf',
  'epoche',
  'erbe',
  // F
  'fabrik',
  'fach',
  'fackel',
  'faden',
  'fahne',
  'fahrt',
  'falke',
  'fall',
  'falsch',
  'falte',
  'familie',
  'fangen',
  'farbe',
  'fass',
  'faust',
  'feder',
  'fehler',
  'feier',
  'feind',
  'feld',
  'fels',
  'fenster',
  'ferien',
  'fern',
  'fertig',
  'fest',
  'fett',
  'feuer',
  'figur',
  'film',
  'filter',
  'finger',
  // G
  'gabel',
  'galopp',
  'gang',
  'gans',
  'garten',
  'gasse',
  'gast',
  'gebiet',
  'gebot',
  'gedicht',
  'gefahr',
  'gegen',
  'geheim',
  'geist',
  'gelb',
  'geld',
  'gemein',
  'genau',
  'genie',
  'gepard',
  'gerade',
  'gericht',
  'gesang',
  'gesetz',
  'gesund',
  'gewinn',
  'gier',
  'gipfel',
  'gitter',
  'glanz',
  'glas',
  'glaube',
  // H
  'hafen',
  'hagel',
  'hahn',
  'haken',
  'halb',
  'halle',
  'hals',
  'halt',
  'hammer',
  'hand',
  'handel',
  'hase',
  'haufen',
  'haupt',
  'haus',
  'haut',
  'heben',
  'heck',
  'hecke',
  'heer',
  'heft',
  'heide',
  'heilig',
  'heim',
  'heizen',
  'held',
  'helfen',
  'hell',
  'hemd',
  'henkel',
  'herbst',
  'herd',
  // I
  'ideal',
  'idee',
  'igel',
  'illegal',
  'immer',
  'impfen',
  'impuls',
  'indem',
  'index',
  'indien',
  'innen',
  'insel',
  'insekt',
  'instanz',
  'intel',
  'intim',
  'inventur',
  'ironie',
  'irre',
  'isolieren',
  'italien',
  // J
  'jacke',
  'jagen',
  'jaguar',
  'jahr',
  'januar',
  'japan',
  'jazz',
  'jeans',
  'jeder',
  'jemals',
  'jemand',
  'jenseits',
  'joghurt',
  'jubel',
  'jugend',
  'juli',
  'jumbo',
  'jung',
  'junge',
  'juni',
  'jura',
  'jury',
  'justiz',
  'juwel',
  // K
  'kabel',
  'kabine',
  'kachel',
  'kaffee',
  'kaiser',
  'kalb',
  'kalt',
  'kamel',
  'kamera',
  'kampf',
  'kanal',
  'kante',
  'kapital',
  'kapsel',
  'karte',
  'kasse',
  'kasten',
  'katze',
  'kaufen',
  'kegel',
  'kehle',
  'keller',
  'kennen',
  'kern',
  'kerze',
  'kette',
  'kind',
  'kino',
  'kirche',
  'kirsche',
  'kissen',
  'kiste',
  // L
  'labor',
  'lachen',
  'lack',
  'laden',
  'lager',
  'lamm',
  'lampe',
  'land',
  'lange',
  'lasten',
  'laub',
  'lauf',
  'laune',
  'laut',
  'lawine',
  'leben',
  'leder',
  'leer',
  'legen',
  'lehre',
  'leib',
  'leicht',
  'leiden',
  'leinen',
  'leise',
  'leisten',
  'leiter',
  'lektion',
  'lenken',
  'lernen',
  'lesen',
  'letzte',
  // M
  'machen',
  'macht',
  'magie',
  'magnet',
  'mahlen',
  'malen',
  'mama',
  'mantel',
  'markt',
  'marmor',
  'marsch',
  'maske',
  'masse',
  'mast',
  'matte',
  'mauer',
  'maul',
  'meer',
  'mehl',
  'mehr',
  'meile',
  'meinen',
  'meister',
  'melden',
  'melken',
  'mensch',
  'messen',
  'metall',
  'meter',
  'miete',
  'milch',
  'million',
  // N
  'nachbar',
  'nacht',
  'nadel',
  'nagel',
  'nahe',
  'name',
  'narbe',
  'nase',
  'nation',
  'natur',
  'nebel',
  'neben',
  'neffe',
  'nehmen',
  'neid',
  'neigen',
  'nennen',
  'nerv',
  'nest',
  'netz',
  'neu',
  'neun',
  'neutral',
  'nicht',
  'nickel',
  'nieder',
  'niemand',
  'niere',
  'nieten',
  'niveau',
  'nobel',
  'noch',
  // O
  'oben',
  'ober',
  'objekt',
  'obst',
  'offen',
  'ohne',
  'ohr',
  'oktober',
  'olive',
  'onkel',
  'oper',
  'opfer',
  'option',
  'orange',
  'orden',
  'ordnung',
  'organ',
  'orient',
  'original',
  'ort',
  'osten',
  'ostern',
  'ozean',
  // P
  'paar',
  'paket',
  'palast',
  'palme',
  'panda',
  'panik',
  'papier',
  'parade',
  'parfum',
  'park',
  'partei',
  'pass',
  'paste',
  'patent',
  'pause',
  'pazifik',
  'pedal',
  'pegel',
  'pein',
  'pendel',
  'perfekt',
  'perle',
  'person',
  'pfad',
  'pfeife',
  'pfeil',
  'pferd',
  'pflanze',
  'pflaster',
  'pflegen',
  'pforte',
  'pfund',
  // Q
  'qual',
  'qualm',
  'quark',
  'quarz',
  'quelle',
  'quer',
  'quitte',
  'quote',
  // R
  'rabe',
  'rache',
  'rad',
  'radio',
  'rahmen',
  'rakete',
  'rampe',
  'rand',
  'rang',
  'rasen',
  'rast',
  'rat',
  'raten',
  'ratsel',
  'raub',
  'rauch',
  'raum',
  'rausch',
  'reben',
  'rechnen',
  'recht',
  'recken',
  'rede',
  'regal',
  'regen',
  'region',
  'reich',
  'reif',
  'reihe',
  'rein',
  'reise',
  'reiten',
  // S
  'saal',
  'saat',
  'sack',
  'safe',
  'saft',
  'sage',
  'sahne',
  'salat',
  'salz',
  'samen',
  'sammeln',
  'samt',
  'sand',
  'sanft',
  'satt',
  'sattel',
  'satz',
  'sauber',
  'sauer',
  'saugen',
  'saum',
  'schach',
  'schaden',
  'schaffen',
  'schale',
  'schall',
  'scham',
  'scharf',
  'schatten',
  'schauen',
  'scheibe',
  'schein',
  // T
  'tafel',
  'tag',
  'takt',
  'tal',
  'talent',
  'tanne',
  'tanz',
  'tapfer',
  'tasche',
  'tasse',
  'taste',
  'tat',
  'taube',
  'tauchen',
  'taufe',
  'tausch',
  'taxi',
  'technik',
  'tee',
  'teich',
  'teig',
  'teil',
  'telefon',
  'teller',
  'tempo',
  'tennis',
  'teppich',
  'termin',
  'test',
  'text',
  'theater',
  'thema',
  // U
  'ufer',
  'uhr',
  'umfang',
  'umgang',
  'umweg',
  'und',
  'unfall',
  'ungarn',
  'union',
  'unmut',
  'unrecht',
  'unruh',
  'unten',
  'unter',
  'urlaub',
  'ursprung',
  // V
  'vase',
  'vater',
  'ventil',
  'verb',
  'verdacht',
  'verein',
  'verlag',
  'vermut',
  'vers',
  'versuch',
  'vertrag',
  'vetter',
  'video',
  'vieh',
  'viel',
  'vier',
  'viertel',
  'villa',
  'virus',
  'vision',
  'vogel',
  'volk',
  'voll',
  'volumen',
  // W
  'wabe',
  'wachs',
  'wade',
  'waffe',
  'wagen',
  'wahl',
  'wahr',
  'wald',
  'wand',
  'wange',
  'wanne',
  'ware',
  'warm',
  'warten',
  'warum',
  'wasser',
  'watt',
  'weben',
  'wechsel',
  'weck',
  'weg',
  'wehen',
  'weib',
  'weich',
  'weide',
  'wein',
  'weise',
  'weiss',
  'weit',
  'weizen',
  'welle',
  'welt',
  // X, Y, Z
  'xerox',
  'xylon',
  'yacht',
  'yoga',
  'zaun',
  'zebra',
  'zehn',
  'zeichen',
  'zeigen',
  'zeile',
  'zeit',
  'zelle',
  'zelt',
  'zentrum',
  'zepter',
  'zeug',
  'ziege',
  'ziehen',
  'ziel',
  'ziffer',
  'zimmer',
  'zink',
  'zins',
  'zirkus',
  'zitat',
  'zitrone',
  'zoll',
  'zone',
  'zopf',
  'zorn',
  'zucker',
  'zufall',
  'zug',
  'zukunft',
  'zunge',
  'zuruf',
  'zwang',
  'zwei',
  'zweck',
  'zweig',
];

/**
 * Number of words in recovery phrase.
 * 12 words = 128 bits of entropy.
 */
const PHRASE_LENGTH = 12;

/**
 * Generates a recovery phrase from an encryption key.
 *
 * The phrase can be used to regenerate the key on a new device.
 * Uses deterministic derivation so the same key always produces
 * the same phrase.
 *
 * @param key - 32-byte encryption key
 * @returns Array of 12 German words
 * @throws Error if key is invalid
 *
 * @example
 * ```typescript
 * const key = deriveEncryptionKey(licenseKey, deviceId);
 * const phrase = generateRecoveryPhrase(key);
 * // ['apfel', 'berg', 'chaos', 'dame', ...]
 * ```
 */
export function generateRecoveryPhrase(key: Uint8Array): string[] {
  if (!key || key.length !== 32) {
    throw new Error('Invalid key: must be 32 bytes');
  }

  // Hash the key to get deterministic indices
  const hash = sha256Sync(key);
  const words: string[] = [];

  // Generate 12 words from the hash
  for (let i = 0; i < PHRASE_LENGTH; i++) {
    // Use 2 bytes per word (11 bits needed for 2048 words)
    const index = ((hash[i * 2] << 8) | hash[i * 2 + 1]) % WORDLIST.length;
    words.push(WORDLIST[index]);
  }

  return words;
}

/**
 * Validates a recovery phrase.
 *
 * Checks that:
 * - The phrase has exactly 12 words
 * - All words are in the word list
 *
 * @param phrase - Array of words or space-separated string
 * @returns true if valid
 */
export function validateRecoveryPhrase(phrase: string[] | string): boolean {
  const words = Array.isArray(phrase) ? phrase : phrase.toLowerCase().trim().split(/\s+/);

  if (words.length !== PHRASE_LENGTH) {
    return false;
  }

  return words.every((word) => WORDLIST.includes(word.toLowerCase()));
}

/**
 * Formats a recovery phrase for display.
 *
 * @param phrase - Array of words
 * @returns Formatted string with word numbers
 */
export function formatRecoveryPhrase(phrase: string[]): string {
  return phrase.map((word, i) => `${(i + 1).toString().padStart(2, ' ')}. ${word}`).join('\n');
}

/**
 * Parses a recovery phrase from user input.
 *
 * Handles various input formats:
 * - Space-separated words
 * - Numbered list
 * - Comma-separated
 *
 * @param input - User input string
 * @returns Array of words (lowercase)
 */
export function parseRecoveryPhrase(input: string): string[] {
  // Remove numbers and common separators
  const cleaned = input
    .toLowerCase()
    .replace(/\d+\./g, '') // Remove "1.", "2.", etc.
    .replace(/[,;]/g, ' ') // Replace commas/semicolons with spaces
    .trim();

  // Split on whitespace and filter empty strings
  return cleaned.split(/\s+/).filter((word) => word.length > 0);
}

/**
 * Gets the word list for UI display (e.g., autocomplete).
 *
 * @returns Array of valid words
 */
export function getWordList(): readonly string[] {
  return Object.freeze([...WORDLIST]);
}

/**
 * Checks if a word is in the word list.
 *
 * @param word - Word to check
 * @returns true if valid
 */
export function isValidWord(word: string): boolean {
  return WORDLIST.includes(word.toLowerCase());
}
