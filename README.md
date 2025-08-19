# Laravel translation fixer for i18next

## What is it?

This package replaces laravel-style placeholders to make these suitable for the
i18next JavaScript library.

## Why?

When using Laravel in the backend and React in the frontend with Vite, there is
a package named [vite-plugin-laravel-translations](https://www.npmjs.com/package/vite-plugin-laravel-translations)
that exposes Laravel i18n strings configured in the **lang/** directory. This
package makes translation strings available as a global variable on the client
side, named **window.LARAVEL_TRANSLATIONS**. This way you can maintain all your
translations in PHP format and avoiding the duplication of work.

Since this global variable is just a nested object that contains a copy of the
content in the "lang/" directory, it can be loaded directly into [react-i18next](https://react.i18next.com/) as the
resource. It works, but there is an issue: Laravel translation strings have the
placeholders prefixed with a colon ( : ) but i18next encloses the placeholder
in double curly brackets ( {{ }} ).

The i18next JavaScript library provides a way to configure both the prefix and
the suffix that are used to enclose the placeholder, but there is no documented
way to support the format provided by Laravel for translation strings.

This package contains a small function that takes an object with the structure
used in the **window.LARAVEL_TRANSLATIONS** and performs a regular expression
to replace placeholders prefixed with a colon by double curly bracketed ones.

If a value is found to be an object, the function looks into it recursively, and
the regular expression is applied only to values that are strings. The resulting
object can be consumed by i18next.

A second parameter was added to enable/disable debug: Performing a regular
expression operation as many times as there are translation strings impacts the
application's loading time, and printing the start/stop time is just a basic
way to measure such impact.

## How to use it?

If you are using i18next, you will probably have an **i18n.js** file that holds
the configuration. Mine, for instance, looks like this.


```
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    debug: false,
    detection: {
      order: ['htmlTag', 'navigator']
    },
    interpolation: {
      escapeValue: false,
    },
    resources: window.LARAVEL_TRANSLATIONS
  })

export default i18n
```

The first step is to install the package:

```
$ npm install laravel-translations-i18next-ffixer
```

Then, import the **ffixer** function in your configuration file:

```
import ffixer from 'laravel-translations-i18next-ffixer'
```

Finally, you can pass the result of this function to the **resources** key in
your configuration, like this:

```
    ...
    interpolation: {
      escapeValue: false,
    },
    resources: ffixer(window.LARAVEL_TRANSLATIONS)
    ...
```

If you want to print when is this function being loaded in the console, you can
use **ffixer(window.LARAVEL_TRANSLATIONS, debug=true)** instead. This is a very
rudimentary form of debugging, I didn't want to make things more complicated.

## Why the name?

Because it aims to **fix** the issue with the **suffix** parameter in i18next.

## Is there a better way?

I don't know. I'll keep researching and probably ping the guys who maintain
the vite-plugin-laravel-translations package and the i18next library about
this issue.

## Who is the author?

Hi, I'm Rodrigo Fuentealba Cartes, a Computer Science Engineer with more than 20
years of experience in the field. You can find my website
[here](https://www.devrfc83.com/).

## License

MIT. See LICENSE.md
