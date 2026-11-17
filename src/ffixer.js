/**
 * laravel-translations-i18next-ffixer
 * ===================================
 *
 * When using vite-plugin-laravel-translations, translations become available
 * as a global variable named LARAVEL_TRANSLATIONS. This global variable is a
 * nested object that contains a copy of the content in the "lang/" directory.
 *
 * Loading the translations as a resource in i18next works with just one issue:
 * Laravel translation strings prefix a placeholder with a colon ( : ) instead
 * of enclosing it between double curly brackets ( {{ }} ).
 *
 * The i18next package provides a way to configure the prefix and suffix to be
 * used in the placeholders, but there is no (documented) way to support the
 * format provided by Laravel for translation strings.
 *
 * This small function takes all the translation strings and performs a regular
 * expression to replace colon-prefixed placeholders by double curly bracketed
 * ones.
 *
 * If a value is found to be an object, the function looks into it recursively
 * to perform a nested search/replace instead of the regular expression, that
 * only applies to strings.
 *
 * The result of this function can be consumed by i18next.
 */

/**
 * Convert Laravel-style placeholders (:name) to i18next ones ({{ name }}).
 *
 * @param {unknown} translations - Tree of translation strings (e.g. window.LARAVEL_TRANSLATIONS).
 * @param {boolean} [debug=false] - Log start/finish timestamps to the console.
 * @param {boolean} [clone=true] - Return a new tree instead of mutating the input.
 * @returns {unknown} Fixed translations, or the input unchanged when it is not an object.
 */

// Matches Laravel placeholders (:attribute, :user-name). Skips ":30" in "10:30".
const LARAVEL_PLACEHOLDER = /(?<![\w:]):([a-zA-Z_]\w*(?:[.-]\w+)*)/g;

// Laravel replaces ":Name" with the ucfirst value and ":NAME" with the upper
// case value. i18next has no such variants, so they become formatters.
const toPlaceholder = (name) => {
  const lower = name.toLowerCase();
  if (name === lower) return `{{ ${name} }}`;
  if (name === name.toUpperCase()) return `{{ ${lower}, uppercase }}`;
  if (name[0] === name[0].toUpperCase() && name.slice(1) === lower.slice(1)) {
    return `{{ ${lower}, capitalize }}`;
  }
  return `{{ ${name} }}`;
};

const fixString = (value) =>
  value.replace(LARAVEL_PLACEHOLDER, (_, name) => toPlaceholder(name));

/**
 * Register the "capitalize" and "uppercase" formatters used by ":Name" and
 * ":NAME" placeholders. Call it once with the i18next instance.
 *
 * @param {{ services: { formatter: { add: Function } } }} i18n - An initialised i18next instance.
 */
export const registerFormatters = (i18n) => {
  i18n.services.formatter.add('uppercase', (value) => String(value).toUpperCase());
  i18n.services.formatter.add('capitalize', (value) => {
    const text = String(value);
    return text.charAt(0).toUpperCase() + text.slice(1);
  });
};

const isTraversable = (value) =>
  value !== null &&
  typeof value === 'object' &&
  (Array.isArray(value) ||
    Object.prototype.toString.call(value) === '[object Object]');

const processValue = (value, clone) => {
  if (typeof value === 'string') {
    return fixString(value);
  }

  if (!isTraversable(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    if (clone) {
      return value.map((item) => processValue(item, clone));
    }
    for (let i = 0; i < value.length; i++) {
      value[i] = processValue(value[i], clone);
    }
    return value;
  }

  if (clone) {
    const result = {};
    for (const key of Object.keys(value)) {
      result[key] = processValue(value[key], clone);
    }
    return result;
  }

  for (const key of Object.keys(value)) {
    value[key] = processValue(value[key], clone);
  }
  return value;
};

const ffixer = (translations, debug = false, clone = true) => {
  if (debug) {
    console.warn('ffixer started at ' + Date.now().toString());
  }

  if (translations === null || translations === undefined) {
    if (debug) {
      console.warn('ffixer: received null or undefined, returning as-is');
    }
    return translations;
  }

  if (typeof translations !== 'object') {
    if (debug) {
      console.warn(
        'ffixer: expected object, got ' +
          typeof translations +
          ', returning as-is'
      );
    }
    return translations;
  }

  const result = processValue(translations, clone);

  if (debug) {
    console.warn('ffixer finished at ' + Date.now().toString());
  }

  return result;
};

export default ffixer;
