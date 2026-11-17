# laravel-translations-i18next-ffixer

[![npm version](https://img.shields.io/npm/v/laravel-translations-i18next-ffixer.svg)](https://www.npmjs.com/package/laravel-translations-i18next-ffixer)
[![CI](https://github.com/devrfc83/laravel-translations-i18next-ffixer/actions/workflows/ci.yml/badge.svg)](https://github.com/devrfc83/laravel-translations-i18next-ffixer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE.md)

Converts Laravel-style placeholders (`:name`) in translation strings to the
`{{ name }}` form used by [i18next](https://www.i18next.com/).

```js
import ffixer from 'laravel-translations-i18next-ffixer';

ffixer({ en: { auth: { throttle: 'Try again in :seconds seconds.' } } });
// { en: { auth: { throttle: 'Try again in {{ seconds }} seconds.' } } }
```

## What is it?

This package replaces Laravel-style placeholders so that the strings can be
consumed by i18next.

## Why?

When using Laravel in the backend and React in the frontend with Vite, there is
a package named [vite-plugin-laravel-translations](https://www.npmjs.com/package/vite-plugin-laravel-translations)
that exposes Laravel i18n strings configured in the **lang/** directory. This
package makes translation strings available as a global variable on the client
side, exposed by Vite as **import.meta.env.VITE_LARAVEL_TRANSLATIONS**. This way
you can maintain all your translations in PHP format and avoid duplicating work.

Since this object is a nested structure that contains a copy of the content in
the **lang/** directory, it can be loaded directly into
[react-i18next](https://react.i18next.com/) as the resource. It works, but
there is an issue: Laravel translation strings prefix placeholders with a colon
(`:`), while i18next encloses them in double curly brackets (`{{ }}`).

The i18next JavaScript library lets you configure the prefix and suffix used
for placeholders, but there is no documented way to support the format Laravel
uses for translation strings.

This package contains a small function that takes an object with the structure
used in **import.meta.env.VITE_LARAVEL_TRANSLATIONS** and replaces colon-prefixed placeholders
with double curly bracketed ones. Nested objects and arrays are walked
recursively, and the replacement applies only to string values.

## Installation

```sh
npm install laravel-translations-i18next-ffixer
```

Requires Node.js 20 or later for development. The package itself has no
runtime dependencies and works in any environment that supports ES modules.

## Usage

If you are using i18next, you will probably have an **i18n.js** file that holds
the configuration. Mine, for instance, looks like this:

```js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    debug: false,
    detection: {
      order: ['htmlTag', 'navigator'],
    },
    interpolation: {
      escapeValue: false,
    },
    resources: import.meta.env.VITE_LARAVEL_TRANSLATIONS,
  });

export default i18n;
```

Import the **ffixer** function and pass the translations through it:

```js
import ffixer from 'laravel-translations-i18next-ffixer';

// ...
interpolation: {
  escapeValue: false,
},
resources: ffixer(import.meta.env.VITE_LARAVEL_TRANSLATIONS),
// ...
```

### Options

Options are passed as the second argument:

```js
ffixer(import.meta.env.VITE_LARAVEL_TRANSLATIONS, { clone: false, debug: true });
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `clone` | `boolean` | `true` | Return a new tree and leave the input untouched. Set to `false` to mutate the input in place. |
| `debug` | `boolean` | `false` | Log one summary line with the number of placeholders, the number of strings and the elapsed time. |
| `only` | `string[]` | — | Convert only these placeholder names. |
| `except` | `string[]` | — | Never convert these placeholder names. |
| `spacing` | `boolean` | `true` | `true` writes `{{ name }}`, `false` writes `{{name}}`. |
| `prefix` | `string` | `'{{'` | Opening delimiter, for projects that changed i18next's interpolation settings. |
| `suffix` | `string` | `'}}'` | Closing delimiter. |
| `plurals` | `boolean` | `false` | Split Laravel plural strings into `_zero`, `_one` and `_other` keys. See [Plural strings](#plural-strings). |

`only` and `except` match names as written in the string, or in lower case.
Placeholders that do not match are left exactly as they are:

```js
ffixer({ m: ':smile: and :name' }, { except: ['smile'] });
// { m: ':smile: and {{ name }}' }
```

```js
ffixer({ m: 'Hi :name' }, { prefix: '%{', suffix: '}' });
// { m: 'Hi %{ name }' }
```

### Converting a single string

`fixString` converts one string with the same options:

```js
import { fixString } from 'laravel-translations-i18next-ffixer';

fixString('Hello :name');                    // 'Hello {{ name }}'
fixString('Hi :name', { spacing: false });   // 'Hi {{name}}'
```

This is useful for strings that arrive outside the initial bundle, such as
server-rendered messages.

### Case variants

Laravel derives `:Name` (first letter upper-cased) and `:NAME` (all upper-cased)
from the same key as `:name`. These become i18next formatters:

```js
ffixer({ m: 'Hello :Name and :NAME' }).m;
// 'Hello {{ name, capitalize }} and {{ name, uppercase }}'
```

Register the formatters once with your i18next instance:

```js
import i18n from 'i18next';
import { registerFormatters } from 'laravel-translations-i18next-ffixer';

i18n.init({ /* ... */ });
registerFormatters(i18n);
```

### Plural strings

By default, a Laravel plural string is left as it is, pipes included. With
`plurals: true`, strings that can be mapped are split into sibling keys:

```js
ffixer(
  { apples: 'There is one apple|There are :count apples' },
  { plurals: true }
);
// {
//   apples_one: 'There is one apple',
//   apples_other: 'There are {{ count }} apples',
// }
```

```js
ffixer(
  { minutes: '{0} None|{1} One minute|[2,*] :count minutes' },
  { plurals: true }
);
// {
//   minutes_zero: 'None',
//   minutes_one: 'One minute',
//   minutes_other: '{{ count }} minutes',
// }
```

Strings that cannot be mapped cleanly are left unchanged: three-form simple
strings, and explicit ranges such as `[2,5]` or `{3}`. Because the keys change,
the return type of `ffixer` does not describe the output when `plurals` is on.

## TypeScript

The package ships type declarations in **index.d.ts**. No extra package is
needed.

## Debug mode

Pass `debug: true` to log a single line when the conversion finishes:

```
ffixer: 412 placeholders in 1830 strings, 1.74 ms
```

This is a rudimentary way to measure the cost of the conversion on your
application's loading time.

## Known limitations

- **Text that looks like a placeholder is converted.** `:smile:` in a sentence
  becomes `{{ smile }}:`. Use `except` to skip such names.
- **Two placeholders written back to back are not both converted.** In
  `:a:b`, only `:a` is converted, because a colon after a letter is not treated
  as the start of a placeholder. This keeps URLs and `mailto:` links intact.
- **Plurals are opt-in and limited.** Only the simple `one|other` form and the
  explicit `{0}`, `{1}` and `[2,*]` forms are mapped. Languages with more than
  two plural forms are not supported yet.
- **Literal pipes are split when `plurals` is on.** A `|` in ordinary text is
  treated as a plural separator, so enable it only for translation files that
  use pipes for plurals.
- **Type declarations do not describe changed keys.** With `plurals: true`, the
  output keys differ from the input keys.

## Upgrading from 0.0.x

- Versions 0.0.3 and earlier mutated the input. From 0.0.4 the default clones it.
- The positional form `ffixer(t, debug, clone)` still works in 0.1.0 but prints
  a deprecation warning. Replace it with the options object:

```js
// before
ffixer(import.meta.env.VITE_LARAVEL_TRANSLATIONS, false, false);

// now
ffixer(import.meta.env.VITE_LARAVEL_TRANSLATIONS, { clone: false });
```

- Deep imports such as `laravel-translations-i18next-ffixer/src/ffixer.js` are
  no longer allowed by the `exports` map. Import from the package name.

## Development

After cloning the repository, install the development dependencies and run the
checks from the project root:

```sh
npm ci
npm run lint        # ESLint
npm run typecheck   # TypeScript check of index.d.ts
npm test            # Node's built-in test runner
npm run coverage    # tests with a coverage report
```

The tests live under **test/** and cover placeholders, nested structures,
cloning versus in-place mutation, options, plurals, edge cases and idempotency.

## Why the name?

Because it aims to **fix** the issue with the **suffix** parameter in i18next.

## Is there a better way?

I don't know. The original
[vite-plugin-laravel-translations](https://github.com/dcodegroup/vite-plugin-laravel-translations)
has had no commits since May 2025, so I'd rather not depend on a change there.
The issue is also worth raising with the i18next maintainers.

## Vite compatibility

The original `vite-plugin-laravel-translations` (0.3.1) declares a peer
dependency on Vite 6 or earlier. Projects on Vite 8 can use the community fork
[`@sydgren/vite-plugin-laravel-translations`](https://www.npmjs.com/package/@sydgren/vite-plugin-laravel-translations),
which requires Vite 8 and Node.js 24 or later. This package works with either
plugin, since both expose the translations through `import.meta.env`. I have
not reviewed the fork's source beyond its published files.

## Who is the author?

Hi, I'm Rodrigo Fuentealba Cartes, a Computer Science Engineer with more than 20
years of experience in the field. You can find my website
[here](https://www.devrfc83.com/).

## License

MIT. See [LICENSE.md](LICENSE.md).
