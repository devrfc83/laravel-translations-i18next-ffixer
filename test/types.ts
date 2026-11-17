// Compile-time checks for index.d.ts. Run with: npm run typecheck
import ffixer, {
  fixString,
  registerFormatters,
  type FfixerOptions,
} from 'laravel-translations-i18next-ffixer';

interface Translations {
  en: { welcome: string; count: number };
}

const resources: Translations = { en: { welcome: 'Hi :name', count: 1 } };
const fixed: Translations = ffixer(resources);
const withOptions: Translations = ffixer(resources, { clone: false, spacing: false });
const legacy: Translations = ffixer(resources, false, false);

const opts: FfixerOptions = { only: ['name'], prefix: '%{', suffix: '}' };
const text: string = fixString('Hello :name', opts);

registerFormatters({
  services: { formatter: { add: (_name, _fn) => undefined } },
});

// @ts-expect-error debug must be a boolean
ffixer(resources, { debug: 'yes' });

export { fixed, withOptions, legacy, text };
