# Changelog

All notable changes to this project are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
project uses [Semantic Versioning](https://semver.org/).

## [0.1.1] - 2026-11-17

### Changed

- The release workflow publishes with npm trusted publishing (OIDC) instead of
  the `NPM_TOKEN` secret. The package code is unchanged from 0.1.0.

## [0.1.0] - 2026-11-17

### Added

- `ffixer(translations, { clone, debug, only, except, spacing, prefix, suffix, plurals })`
  options object. See the README for the full table.
- `fixString(value, options)` converts a single string.
- Named exports: `ffixer`, `fixString` and `registerFormatters`.
- `registerFormatters(i18n)` adds the `capitalize` and `uppercase` formatters.
- `plurals: true` option that splits Laravel plural strings into `_zero`,
  `_one` and `_other` keys.
- TypeScript declarations in `index.d.ts`, checked with `npm run typecheck`.
- `npm run coverage` reports test coverage.
- GitHub Actions: CI on Node 20, 22 and 24, and npm publication on `v*` tags
  with provenance.

### Changed

- **Breaking:** the deprecated positional form `ffixer(t, debug, clone)` still
  works but prints a warning. Use `ffixer(t, { debug, clone })`.
- **Breaking:** `package.json` declares an `exports` map. Deep imports such as
  `laravel-translations-i18next-ffixer/src/ffixer.js` are no longer allowed.
- **Breaking:** `engines` requires Node.js 20 or later for development. The
  package itself has no runtime dependencies.
- Debug mode logs one summary line with the number of placeholders, the number
  of strings and the elapsed time. The raw start and end timestamps are gone.
- The published tarball contains only `src/`, `index.d.ts` and the package
  metadata. Tests and editor settings are no longer published.
- The lint configuration moved from `.eslintrc` to `eslint.config.js` (ESLint 9).
- `package.json` declares `sideEffects: false`, so bundlers can drop unused
  imports.

### Fixed

- Trailing punctuation is no longer captured as part of a placeholder name:
  `:min.` becomes `{{ min }}.`.
- A colon attached to preceding text is no longer converted: `mailto:foo@bar`
  and `Note:important` are unchanged.
- Laravel's `:Name` and `:NAME` variants become the `capitalize` and
  `uppercase` formatters instead of unknown variables.
- A `__proto__` key no longer changes the prototype of the result in clone mode.
- `{{:name}}` is left unchanged.
- A cyclic reference throws a descriptive `TypeError` instead of overflowing
  the stack.
- `clone: false` on a frozen object throws a message that suggests `clone: true`.
- The regex no longer uses a lookbehind, which Safari before 16.4 cannot parse.

### Removed

- `.eslintrc` (replaced by `eslint.config.js`).

## [0.0.5]

- Added the test suite (`test/ffixer.test.js`).

## [0.0.4]

- Improved the replacement regex, so that `10:30` and `://` are left alone.
- The input is cloned by default. Pass `clone: false` to mutate it in place,
  as versions 0.0.3 and earlier did.
- Added the `clone` parameter.

## [0.0.3]

- Renamed the repository. The source is the same as 0.0.2.

## [0.0.2]

- Added the `debug` parameter, which logs start and end timestamps.
- Expanded the documentation.

## [0.0.1]

- Initial release. Converts `:name` placeholders to `{{ name }}` by mutating
  the input in place.

[0.1.0]: https://github.com/devrfc83/laravel-translations-i18next-ffixer/compare/v0.0.5...HEAD
[0.0.5]: https://github.com/devrfc83/laravel-translations-i18next-ffixer/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/devrfc83/laravel-translations-i18next-ffixer/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/devrfc83/laravel-translations-i18next-ffixer/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/devrfc83/laravel-translations-i18next-ffixer/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/devrfc83/laravel-translations-i18next-ffixer/releases/tag/v0.0.1
