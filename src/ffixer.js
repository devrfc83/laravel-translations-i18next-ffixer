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
 * @param {object} [options]
 * @param {boolean} [options.clone=true] - Return a new tree instead of mutating the input.
 * @param {boolean} [options.debug=false] - Log timing information to the console.
 * @param {string[]} [options.only] - Convert only these placeholder names.
 * @param {string[]} [options.except] - Never convert these placeholder names.
 * @param {boolean} [options.spacing=true] - Write "{{ name }}" (true) or "{{name}}" (false).
 * @param {string} [options.prefix='{{'] - Opening delimiter.
 * @param {string} [options.suffix='}}'] - Closing delimiter.
 * @returns {unknown} Fixed translations, or the input unchanged when it is not an object.
 */

// Matches Laravel placeholders (:attribute, :user-name). Skips ":30" in "10:30".
const LARAVEL_PLACEHOLDER = /(?<![\w:{]):([a-zA-Z_]\w*(?:[.-]\w+)*)/g;

const DEFAULT_OPTIONS = {
  clone: true,
  debug: false,
  only: null,
  except: null,
  spacing: true,
  prefix: '{{',
  suffix: '}}',
};

const resolveOptions = (raw) => {
  const given = raw ?? {};
  return {
    ...DEFAULT_OPTIONS,
    ...given,
    only: given.only ? new Set(given.only) : null,
    except: given.except ? new Set(given.except) : null,
  };
};

const wrap = (opts, body) => {
  const pad = opts.spacing ? ' ' : '';
  return `${opts.prefix}${pad}${body}${pad}${opts.suffix}`;
};

// Laravel replaces ":Name" with the ucfirst value and ":NAME" with the upper
// case value. i18next has no such variants, so they become formatters.
const toPlaceholder = (name, opts) => {
  const lower = name.toLowerCase();
  if (name === lower) return wrap(opts, name);
  if (name === name.toUpperCase()) return wrap(opts, `${lower}, uppercase`);
  if (name[0] === name[0].toUpperCase() && name.slice(1) === lower.slice(1)) {
    return wrap(opts, `${lower}, capitalize`);
  }
  return wrap(opts, name);
};

// A name is selected when it matches as written or in lower case.
const isSelected = (name, set) => set.has(name) || set.has(name.toLowerCase());

const convertString = (value, opts) =>
  value.replace(LARAVEL_PLACEHOLDER, (match, name) => {
    if (opts.only && !isSelected(name, opts.only)) return match;
    if (opts.except && isSelected(name, opts.except)) return match;
    return toPlaceholder(name, opts);
  });

/**
 * Convert the placeholders in a single string.
 *
 * @param {string} value - A translation string, e.g. 'Hello :name'.
 * @param {object} [options] - The same options accepted by ffixer.
 * @returns {string} The string with i18next placeholders.
 */
export const fixString = (value, options) =>
  convertString(value, resolveOptions(options));

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

const setOwn = (target, key, value) =>
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });

// "ancestors" holds the containers currently being visited, so a reference
// back to one of them is reported instead of recursing until the stack overflows.
const processValue = (value, opts, ancestors = new Set()) => {
  if (typeof value === 'string') {
    return convertString(value, opts);
  }

  if (!isTraversable(value)) {
    return value;
  }

  if (ancestors.has(value)) {
    throw new TypeError('ffixer: cyclic reference in translations');
  }

  if (!opts.clone && Object.isFrozen(value)) {
    throw new TypeError(
      'ffixer: cannot modify a frozen object in place; pass clone: true'
    );
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (opts.clone) {
        return value.map((item) => processValue(item, opts, ancestors));
      }
      for (let i = 0; i < value.length; i++) {
        value[i] = processValue(value[i], opts, ancestors);
      }
      return value;
    }

    if (opts.clone) {
      const result = {};
      for (const key of Object.keys(value)) {
        // Define the key as an own property: a plain assignment would call the
        // __proto__ setter for a key named "__proto__" (e.g. from JSON.parse).
        setOwn(result, key, processValue(value[key], opts, ancestors));
      }
      return result;
    }

    for (const key of Object.keys(value)) {
      value[key] = processValue(value[key], opts, ancestors);
    }
    return value;
  } finally {
    ancestors.delete(value);
  }
};

// Accepts ffixer(t, { debug, clone, … }) and the deprecated ffixer(t, debug, clone).
const normaliseArguments = (arg2, arg3) => {
  if (typeof arg2 === 'boolean' || typeof arg3 === 'boolean') {
    console.warn(
      'ffixer: positional (debug, clone) arguments are deprecated; ' +
        'pass { debug, clone } instead'
    );
    return { debug: arg2 ?? false, clone: arg3 ?? true };
  }
  return arg2;
};

export const ffixer = (translations, arg2, arg3) => {
  const opts = resolveOptions(normaliseArguments(arg2, arg3));
  const { debug } = opts;

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

  const result = processValue(translations, opts);

  if (debug) {
    console.warn('ffixer finished at ' + Date.now().toString());
  }

  return result;
};

export default ffixer;
