import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import ffixer from '../src/ffixer.js';

describe('ffixer — placeholders en strings', () => {
  it('convierte un placeholder Laravel simple', () => {
    const input = { msg: 'Hello :name' };
    assert.equal(ffixer(input).msg, 'Hello {{ name }}');
  });

  it('convierte varios placeholders en la misma cadena', () => {
    const input = { msg: ':greeting :name, you have :count messages' };
    assert.equal(
      ffixer(input).msg,
      '{{ greeting }} {{ name }}, you have {{ count }} messages'
    );
  });

  it('soporta guiones en el nombre del placeholder', () => {
    const input = { msg: 'Hi :user-name' };
    assert.equal(ffixer(input).msg, 'Hi {{ user-name }}');
  });

  it('soporta guiones bajos y mayúsculas (estilo :attribute)', () => {
    const input = { msg: 'The :attribute field is required.' };
    assert.equal(
      ffixer(input).msg,
      'The {{ attribute }} field is required.'
    );
  });

  it('soporta puntos en el nombre del placeholder', () => {
    const input = { msg: 'See :foo.bar' };
    assert.equal(ffixer(input).msg, 'See {{ foo.bar }}');
  });

  it('deja cadenas sin placeholders intactas', () => {
    const input = { msg: 'No placeholders here.' };
    assert.equal(ffixer(input).msg, input.msg);
  });

  it('no modifica texto ya en formato i18next', () => {
    const input = { msg: 'Hello {{ name }}' };
    assert.equal(ffixer(input).msg, 'Hello {{ name }}');
  });

  it('no trata :30 en horas como placeholder', () => {
    const input = { msg: 'Meeting at 10:30' };
    assert.equal(ffixer(input).msg, 'Meeting at 10:30');
  });

  it('no altera URLs con ://', () => {
    const input = { msg: 'Visit https://example.com today' };
    assert.equal(ffixer(input).msg, 'Visit https://example.com today');
  });

  it('no convierte placeholders que empiezan por dígito', () => {
    const input = { msg: 'Code :2fa is invalid' };
    assert.equal(ffixer(input).msg, 'Code :2fa is invalid');
  });
});

describe('ffixer — estructura anidada (i18next / LARAVEL_TRANSLATIONS)', () => {
  it('recorre objetos anidados como resources de i18next', () => {
    const input = {
      en: {
        translation: {
          welcome: 'Welcome, :name',
          nested: {
            bye: 'Bye :name',
          },
        },
      },
    };
    const out = ffixer(input);
    assert.equal(out.en.translation.welcome, 'Welcome, {{ name }}');
    assert.equal(out.en.translation.nested.bye, 'Bye {{ name }}');
  });

  it('procesa arrays de strings', () => {
    const input = { lines: ['Line :n', 'Another :m'] };
    const out = ffixer(input);
    assert.deepEqual(out.lines, ['Line {{ n }}', 'Another {{ m }}']);
  });

  it('ignora valores no string en nodos hoja', () => {
    const input = {
      count: 42,
      enabled: true,
      label: 'Items: :count',
    };
    const out = ffixer(input);
    assert.equal(out.count, 42);
    assert.equal(out.enabled, true);
    assert.equal(out.label, 'Items: {{ count }}');
  });

  it('preserva null en propiedades del objeto', () => {
    const input = { empty: null, text: 'Hi :name' };
    const out = ffixer(input);
    assert.equal(out.empty, null);
    assert.equal(out.text, 'Hi {{ name }}');
  });

  it('no recorre instancias Date', () => {
    const date = new Date('2020-01-01T00:00:00.000Z');
    const input = { createdAt: date, text: 'Hi :name' };
    const out = ffixer(input);
    assert.equal(out.createdAt, date);
    assert.equal(out.text, 'Hi {{ name }}');
  });

  it('maneja objetos y arrays vacíos', () => {
    const input = { emptyObj: {}, emptyArr: [], text: ':x' };
    const out = ffixer(input);
    assert.deepEqual(out.emptyObj, {});
    assert.deepEqual(out.emptyArr, []);
    assert.equal(out.text, '{{ x }}');
  });
});

describe('ffixer — clone (por defecto) vs mutación in-place', () => {
  it('por defecto clona y no muta el objeto de entrada', () => {
    const input = {
      en: { translation: { greet: 'Hello :name' } },
    };
    const out = ffixer(input);
    assert.notEqual(out, input);
    assert.equal(input.en.translation.greet, 'Hello :name');
    assert.equal(out.en.translation.greet, 'Hello {{ name }}');
  });

  it('con clone=false muta in-place y devuelve la misma referencia', () => {
    const input = { msg: 'Hello :name' };
    const out = ffixer(input, false, false);
    assert.equal(out, input);
    assert.equal(input.msg, 'Hello {{ name }}');
  });

  it('con clone=false muta arrays anidados in-place', () => {
    const input = { lines: ['A :x'] };
    ffixer(input, false, false);
    assert.equal(input.lines[0], 'A {{ x }}');
  });
});

describe('ffixer — entradas no válidas o atípicas', () => {
  it('devuelve null sin cambios', () => {
    assert.equal(ffixer(null), null);
  });

  it('devuelve undefined sin cambios', () => {
    assert.equal(ffixer(undefined), undefined);
  });

  it('devuelve un string primitivo sin cambios', () => {
    assert.equal(ffixer('Hello :name'), 'Hello :name');
  });

  it('devuelve un número sin cambios', () => {
    assert.equal(ffixer(0), 0);
  });
});

describe('ffixer — idempotencia y regresiones', () => {
  it('ejecutar dos veces no altera el resultado', () => {
    const input = { msg: 'Hello :name' };
    const once = ffixer(structuredClone(input));
    const twice = ffixer(structuredClone(once));
    assert.deepEqual(once, twice);
    assert.equal(twice.msg, 'Hello {{ name }}');
  });

  it('caso realista tipo mensaje de validación Laravel', () => {
    const input = {
      en: {
        validation: {
          required: 'The :attribute field is required.',
          min: 'The :attribute must be at least :min characters.',
        },
      },
    };
    const out = ffixer(input);
    assert.equal(
      out.en.validation.required,
      'The {{ attribute }} field is required.'
    );
    assert.equal(
      out.en.validation.min,
      'The {{ attribute }} must be at least {{ min }} characters.'
    );
  });
});

describe('ffixer — modo debug', () => {
  it('registra inicio y fin en consola cuando debug es true', () => {
    const warnings = [];
    const original = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));

    try {
      ffixer({ msg: ':a' }, true);
      assert.equal(warnings.length, 2);
      assert.match(warnings[0], /^ffixer started at \d+$/);
      assert.match(warnings[1], /^ffixer finished at \d+$/);
    } finally {
      console.warn = original;
    }
  });

  it('avisa en debug cuando la entrada no es un objeto', () => {
    const warnings = [];
    const original = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));

    try {
      assert.equal(ffixer('not an object', true), 'not an object');
      assert.ok(
        warnings.some((w) => w.includes('expected object, got string'))
      );
    } finally {
      console.warn = original;
    }
  });
});
