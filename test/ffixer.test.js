import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import ffixer, { fixString, registerFormatters } from '../src/ffixer.js';

// Silences console output from a function while it runs and returns the
// messages that were logged with the given method.
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

describe('placeholders in strings', () => {
  it('converts a simple Laravel placeholder', () => {
    const input = { msg: 'Hello :name' };
    assert.equal(ffixer(input).msg, 'Hello {{ name }}');
  });

  it('converts several placeholders in the same string', () => {
    const input = { msg: ':greeting :name, you have :count messages' };
    assert.equal(
      ffixer(input).msg,
      '{{ greeting }} {{ name }}, you have {{ count }} messages'
    );
  });

  it('supports hyphens in the placeholder name', () => {
    const input = { msg: 'Hi :user-name' };
    assert.equal(ffixer(input).msg, 'Hi {{ user-name }}');
  });

  it('supports underscores and upper-case letters (:attribute style)', () => {
    const input = { msg: 'The :attribute field is required.' };
    assert.equal(
      ffixer(input).msg,
      'The {{ attribute }} field is required.'
    );
  });

  it('supports dots in the placeholder name', () => {
    const input = { msg: 'See :foo.bar' };
    assert.equal(ffixer(input).msg, 'See {{ foo.bar }}');
  });

  it('leaves strings without placeholders unchanged', () => {
    const input = { msg: 'No placeholders here.' };
    assert.equal(ffixer(input).msg, input.msg);
  });

  it('does not modify text already in i18next format', () => {
    const input = { msg: 'Hello {{ name }}' };
    assert.equal(ffixer(input).msg, 'Hello {{ name }}');
  });

  it('does not treat the :30 in a time as a placeholder', () => {
    const input = { msg: 'Meeting at 10:30' };
    assert.equal(ffixer(input).msg, 'Meeting at 10:30');
  });

  it('does not alter URLs containing ://', () => {
    const input = { msg: 'Visit https://example.com today' };
    assert.equal(ffixer(input).msg, 'Visit https://example.com today');
  });

  it('does not convert placeholders that start with a digit', () => {
    const input = { msg: 'Code :2fa is invalid' };
    assert.equal(ffixer(input).msg, 'Code :2fa is invalid');
  });
});

describe('nested structures (i18next / LARAVEL_TRANSLATIONS)', () => {
  it('walks nested objects like i18next resources', () => {
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

  it('processes arrays of strings', () => {
    const input = { lines: ['Line :n', 'Another :m'] };
    const out = ffixer(input);
    assert.deepEqual(out.lines, ['Line {{ n }}', 'Another {{ m }}']);
  });

  it('ignores non-string leaf values', () => {
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

  it('preserves null property values', () => {
    const input = { empty: null, text: 'Hi :name' };
    const out = ffixer(input);
    assert.equal(out.empty, null);
    assert.equal(out.text, 'Hi {{ name }}');
  });

  it('does not walk into Date instances', () => {
    const date = new Date('2020-01-01T00:00:00.000Z');
    const input = { createdAt: date, text: 'Hi :name' };
    const out = ffixer(input);
    assert.equal(out.createdAt, date);
    assert.equal(out.text, 'Hi {{ name }}');
  });

  it('handles empty objects and arrays', () => {
    const input = { emptyObj: {}, emptyArr: [], text: ':x' };
    const out = ffixer(input);
    assert.deepEqual(out.emptyObj, {});
    assert.deepEqual(out.emptyArr, []);
    assert.equal(out.text, '{{ x }}');
  });
});

describe('clone (default) vs in-place mutation', () => {
  it('clones by default and leaves the input untouched', () => {
    const input = {
      en: { translation: { greet: 'Hello :name' } },
    };
    const out = ffixer(input);
    assert.notEqual(out, input);
    assert.equal(input.en.translation.greet, 'Hello :name');
    assert.equal(out.en.translation.greet, 'Hello {{ name }}');
  });

  it('mutates in place with clone: false and returns the same reference', () => {
    const input = { msg: 'Hello :name' };
    const out = ffixer(input, { clone: false });
    assert.equal(out, input);
    assert.equal(input.msg, 'Hello {{ name }}');
  });

  it('mutates nested arrays in place with clone: false', () => {
    const input = { lines: ['A :x'] };
    ffixer(input, { clone: false });
    assert.equal(input.lines[0], 'A {{ x }}');
  });
});

describe('invalid or unusual inputs', () => {
  it('returns null unchanged', () => {
    assert.equal(ffixer(null), null);
  });

  it('returns undefined unchanged', () => {
    assert.equal(ffixer(undefined), undefined);
  });

  it('returns a primitive string unchanged', () => {
    assert.equal(ffixer('Hello :name'), 'Hello :name');
  });

  it('returns a number unchanged', () => {
    assert.equal(ffixer(0), 0);
  });

  it('accepts null as the options argument', () => {
    assert.equal(ffixer({ m: ':a' }, null).m, '{{ a }}');
  });
});

describe('idempotence and regressions', () => {
  it('running twice gives the same result', () => {
    const input = { msg: 'Hello :name' };
    const once = ffixer(structuredClone(input));
    const twice = ffixer(structuredClone(once));
    assert.deepEqual(once, twice);
    assert.equal(twice.msg, 'Hello {{ name }}');
  });

  it('handles a realistic Laravel validation message set', () => {
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

describe('debug mode', () => {
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

  it('warns in debug mode when the input is not an object', () => {
    let result;
    const messages = capture('warn', () => {
      result = ffixer('not an object', { debug: true });
    });
    assert.equal(result, 'not an object');
    assert.ok(messages.some((w) => w.includes('expected object, got string')));
  });
});

describe('placeholder name boundaries (#1)', () => {
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

describe('colon attached to text (#2)', () => {
  for (const s of ['mailto:foo@bar.com', 'Note:important', 'ratio a:b']) {
    it(`leaves "${s}" untouched`, () => {
      assert.equal(ffixer({ s }).s, s);
    });
  }

  it('still converts a placeholder after an opening parenthesis', () => {
    assert.equal(ffixer({ s: '(:count)' }).s, '({{ count }})');
  });
});

describe('case variants :Name and :NAME (#3)', () => {
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

describe('__proto__ keys in clone mode (#4)', () => {
  it('keeps a __proto__ key as an own property', () => {
    const input = JSON.parse('{"__proto__":{"x":":a"},"k":":b"}');
    const out = ffixer(input);
    assert.equal(Object.getPrototypeOf(out), Object.prototype);
    assert.deepEqual(Object.keys(out), ['__proto__', 'k']);
    assert.equal(out.k, '{{ b }}');
  });
});

describe('edge cases (#5)', () => {
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

  it('throws a helpful TypeError for a frozen object with clone: false', () => {
    assert.throws(
      () => ffixer(Object.freeze({ a: ':x' }), { clone: false }),
      /frozen object in place; pass clone: true/
    );
  });

  it('still works on a frozen object with the default clone', () => {
    assert.equal(ffixer(Object.freeze({ a: ':x' })).a, '{{ x }}');
  });
});

describe('options object and deprecated positional arguments (#6)', () => {
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
    const input = { msg: 'Hello :name' };
    let out;
    const messages = capture('warn', () => {
      out = ffixer(input, false, false);
    });
    assert.equal(out, input);
    assert.ok(messages.some((w) => w.includes('deprecated')));
  });
});

describe('only, except, spacing, prefix and suffix (#7)', () => {
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

describe('named exports (#8)', () => {
  it('exports ffixer as a named export', async () => {
    const mod = await import('../src/ffixer.js');
    assert.equal(mod.ffixer, mod.default);
  });

  it('converts a single string with fixString', () => {
    assert.equal(fixString('Hello :name'), 'Hello {{ name }}');
    assert.equal(fixString('Hi :name', { spacing: false }), 'Hi {{name}}');
    assert.equal(fixString('no placeholders'), 'no placeholders');
  });
});

describe('plural strings (#11)', () => {
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

describe('no lookbehind in the pattern (#15)', () => {
  it('converts a placeholder at the very start of a string', () => {
    assert.equal(ffixer({ m: ':a is first' }).m, '{{ a }} is first');
  });

  it('converts placeholders after brackets and punctuation', () => {
    assert.equal(
      ffixer({ m: '[:a], (:b), "c":d' }).m,
      '[{{ a }}], ({{ b }}), "c"{{ d }}'
    );
  });

  it('converts adjacent placeholders separated by a space', () => {
    assert.equal(ffixer({ m: ':a :b' }).m, '{{ a }} {{ b }}');
  });

  it('keeps the second of two directly joined placeholders unchanged', () => {
    assert.equal(ffixer({ m: ':a:b' }).m, '{{ a }}:b');
  });
});

describe('table-driven cases from the open issues', () => {
  const cases = [
    ['At least :min.', 'At least {{ min }}.'],
    ['Between :min-:max', 'Between {{ min }}-{{ max }}'],
    ['mailto:foo@bar.com', 'mailto:foo@bar.com'],
    ['Note:important', 'Note:important'],
    ['(:count)', '({{ count }})'],
    ['Hello :Name', 'Hello {{ name, capitalize }}'],
    ['Hello :NAME', 'Hello {{ name, uppercase }}'],
    ['{{:name}}', '{{:name}}'],
    ['{0} None|[1,*] :count items', '{0} None|[1,*] {{ count }} items'],
    ['Meeting at 10:30pm', 'Meeting at 10:30pm'],
    ['Visit https://example.com', 'Visit https://example.com'],
  ];

  for (const [input, expected] of cases) {
    it(`${input} -> ${expected}`, () => {
      assert.equal(ffixer({ s: input }).s, expected);
    });
  }
});
