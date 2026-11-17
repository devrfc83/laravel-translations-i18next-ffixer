import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import ffixer, { registerFormatters } from '../src/ffixer.js';

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
  const capture = (method, fn) => {
    const messages = [];
    const original = console[method];
    console[method] = (...args) => messages.push(args.join(' '));
    try {
      fn();
    } finally {
      console[method] = original;
    }
    return messages;
  };

  it('logs one summary line with counts and duration when debug is true', () => {
    const messages = capture('debug', () => {
      ffixer({ a: ':x', b: 'no placeholders', c: ':y :z' }, { debug: true });
    });
    assert.equal(messages.length, 1);
    assert.match(
      messages[0],
      /^ffixer: 3 placeholders in 3 strings, \d+\.\d{2} ms$/
    );
  });

  it('avisa en debug cuando la entrada no es un objeto', () => {
    let result;
    const messages = capture('warn', () => {
      result = ffixer('not an object', { debug: true });
    });
    assert.equal(result, 'not an object');
    assert.ok(messages.some((w) => w.includes('expected object, got string')));
  });
});

describe('ffixer — placeholder name boundaries (#1)', () => {
  it('does not capture a trailing full stop', () => {
    assert.equal(ffixer({ m: 'At least :min.' }).m, 'At least {{ min }}.');
  });

  it('handles two placeholders joined by a hyphen', () => {
    assert.equal(
      ffixer({ m: 'Between :min-:max chars' }).m,
      'Between {{ min }}-{{ max }} chars'
    );
  });
});

describe('ffixer — colon attached to text (#2)', () => {
  for (const s of ['mailto:foo@bar.com', 'Note:important', 'ratio a:b']) {
    it(`leaves "${s}" untouched`, () => {
      assert.equal(ffixer({ s }).s, s);
    });
  }

  it('still converts a placeholder after an opening parenthesis', () => {
    assert.equal(ffixer({ s: '(:count)' }).s, '({{ count }})');
  });
});

describe('ffixer — case variants :Name and :NAME (#3)', () => {
  it('maps :Name to a capitalize formatter', () => {
    assert.equal(ffixer({ m: 'Hello :Name' }).m, 'Hello {{ name, capitalize }}');
  });

  it('maps :NAME to an uppercase formatter', () => {
    assert.equal(ffixer({ m: 'Hello :NAME' }).m, 'Hello {{ name, uppercase }}');
  });

  it('keeps lower-case placeholders unchanged', () => {
    assert.equal(ffixer({ m: ':name' }).m, '{{ name }}');
  });

  it('leaves mixed-case names such as :userName as they are', () => {
    assert.equal(ffixer({ m: ':userName' }).m, '{{ userName }}');
  });

  it('registers the formatters on an i18next-like instance', () => {
    const formatters = new Map();
    const i18n = {
      services: { formatter: { add: (name, fn) => formatters.set(name, fn) } },
    };
    registerFormatters(i18n);
    assert.equal(formatters.get('uppercase')('abc'), 'ABC');
    assert.equal(formatters.get('capitalize')('abc'), 'Abc');
  });
});

describe('ffixer — __proto__ keys in clone mode (#4)', () => {
  it('keeps a __proto__ key as an own property', () => {
    const input = JSON.parse('{"__proto__":{"x":":a"},"k":":b"}');
    const out = ffixer(input);
    assert.equal(Object.getPrototypeOf(out), Object.prototype);
    assert.deepEqual(Object.keys(out), ['__proto__', 'k']);
    assert.equal(out.k, '{{ b }}');
  });
});

describe('ffixer — edge cases (#5)', () => {
  it('leaves a placeholder already wrapped in braces untouched', () => {
    assert.equal(ffixer({ m: '{{:name}}' }).m, '{{:name}}');
  });

  it('throws a descriptive TypeError on a cyclic reference', () => {
    const t = { a: ':x' };
    t.self = t;
    assert.throws(() => ffixer(t), TypeError);
    assert.throws(() => ffixer(t), /cyclic reference/);
  });

  it('accepts the same object referenced twice (not a cycle)', () => {
    const shared = { a: ':x' };
    const out = ffixer({ first: shared, second: shared });
    assert.equal(out.first.a, '{{ x }}');
    assert.equal(out.second.a, '{{ x }}');
  });

  it('throws a helpful TypeError for a frozen object with clone=false', () => {
    assert.throws(
      () => ffixer(Object.freeze({ a: ':x' }), false, false),
      /frozen object in place; pass clone: true/
    );
  });

  it('still works on a frozen object with the default clone', () => {
    assert.equal(ffixer(Object.freeze({ a: ':x' })).a, '{{ x }}');
  });
});

describe('ffixer — options object (#6)', () => {
  it('accepts { clone: false } and mutates in place', () => {
    const input = { msg: 'Hello :name' };
    const out = ffixer(input, { clone: false });
    assert.equal(out, input);
    assert.equal(input.msg, 'Hello {{ name }}');
  });

  it('defaults to a cloned result with an empty options object', () => {
    const input = { msg: ':x' };
    assert.notEqual(ffixer(input, {}), input);
  });

  it('still accepts the deprecated positional form and warns', () => {
    const warnings = [];
    const original = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));
    try {
      const input = { msg: 'Hello :name' };
      const out = ffixer(input, false, false);
      assert.equal(out, input);
      assert.ok(warnings.some((w) => w.includes('deprecated')));
    } finally {
      console.warn = original;
    }
  });
});

describe('ffixer — only / except / spacing / prefix / suffix (#7)', () => {
  it('converts only the names listed in "only"', () => {
    const out = ffixer({ m: ':a and :b' }, { only: ['a'] });
    assert.equal(out.m, '{{ a }} and :b');
  });

  it('skips the names listed in "except"', () => {
    const out = ffixer({ m: ':smile: and :name' }, { except: ['smile'] });
    assert.equal(out.m, ':smile: and {{ name }}');
  });

  it('writes compact placeholders with spacing: false', () => {
    assert.equal(ffixer({ m: 'Hi :name' }, { spacing: false }).m, 'Hi {{name}}');
  });

  it('uses custom delimiters', () => {
    assert.equal(
      ffixer({ m: 'Hi :name' }, { prefix: '%{', suffix: '}' }).m,
      'Hi %{ name }'
    );
  });

  it('applies the options to case variants too', () => {
    assert.equal(
      ffixer({ m: ':Name' }, { spacing: false }).m,
      '{{name, capitalize}}'
    );
  });

  it('combines options with clone: false', () => {
    const input = { m: ':a :b' };
    ffixer(input, { clone: false, only: ['b'], spacing: false });
    assert.equal(input.m, ':a {{b}}');
  });

  it('keeps the default output unchanged', () => {
    assert.equal(ffixer({ m: 'Hi :name' }, {}).m, 'Hi {{ name }}');
  });
});

it('accepts null as the options argument', () => {
  assert.equal(ffixer({ m: ':a' }, null).m, '{{ a }}');
});

describe('ffixer — named exports (#8)', () => {
  it('exports ffixer as a named export', async () => {
    const mod = await import('../src/ffixer.js');
    assert.equal(mod.ffixer, mod.default);
  });

  it('converts a single string with fixString', async () => {
    const { fixString } = await import('../src/ffixer.js');
    assert.equal(fixString('Hello :name'), 'Hello {{ name }}');
    assert.equal(fixString('Hi :name', { spacing: false }), 'Hi {{name}}');
    assert.equal(fixString('no placeholders'), 'no placeholders');
  });
});

describe('ffixer — plural strings (#11)', () => {
  it('leaves pipes untouched by default', () => {
    const out = ffixer({ apples: 'There is one apple|There are many apples' });
    assert.equal(out.apples, 'There is one apple|There are many apples');
  });

  it('splits the simple "one|other" form into _one and _other', () => {
    const out = ffixer(
      { apples: 'There is one apple|There are :count apples' },
      { plurals: true }
    );
    assert.deepEqual(out, {
      apples_one: 'There is one apple',
      apples_other: 'There are {{ count }} apples',
    });
  });

  it('maps explicit {0}, {1} and [2,*] segments to _zero, _one and _other', () => {
    const out = ffixer(
      { minutes: '{0} None|{1} One minute|[2,*] :count minutes' },
      { plurals: true }
    );
    assert.deepEqual(out, {
      minutes_zero: 'None',
      minutes_one: 'One minute',
      minutes_other: '{{ count }} minutes',
    });
  });

  it('leaves strings with unmappable ranges unchanged', () => {
    const input = '{0} None|[2,5] A few|[6,*] Many';
    assert.equal(ffixer({ m: input }, { plurals: true }).m, input);
  });

  it('leaves three-form simple strings unchanged', () => {
    const input = 'one|few|many';
    assert.equal(ffixer({ m: input }, { plurals: true }).m, input);
  });

  it('keeps the other keys in place', () => {
    const out = ffixer(
      { a: 'x', n: 'one|:count others', b: 'y' },
      { plurals: true }
    );
    assert.deepEqual(Object.keys(out), ['a', 'n_one', 'n_other', 'b']);
  });

  it('splits plurals in place with clone: false', () => {
    const input = { n: 'one|many' };
    ffixer(input, { clone: false, plurals: true });
    assert.deepEqual(input, { n_one: 'one', n_other: 'many' });
  });
});

describe('ffixer — no lookbehind in the pattern (#15)', () => {
  it('converts a placeholder at the very start of a string', () => {
    assert.equal(ffixer({ m: ':a is first' }).m, '{{ a }} is first');
  });

  it('converts placeholders after brackets and punctuation', () => {
    assert.equal(ffixer({ m: '[:a], (:b), "c":d' }).m, '[{{ a }}], ({{ b }}), "c"{{ d }}');
  });

  it('converts adjacent placeholders separated by a space', () => {
    assert.equal(ffixer({ m: ':a :b' }).m, '{{ a }} {{ b }}');
  });

  it('keeps the second of two directly joined placeholders unchanged', () => {
    assert.equal(ffixer({ m: ':a:b' }).m, '{{ a }}:b');
  });
});
