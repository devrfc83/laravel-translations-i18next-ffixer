/** Options accepted by ffixer and fixString. */
export interface FfixerOptions {
  /** Return a new tree instead of mutating the input. Default: true. */
  clone?: boolean;
  /** Log a summary line with counts and duration. Default: false. */
  debug?: boolean;
  /** Convert only these placeholder names. */
  only?: readonly string[];
  /** Never convert these placeholder names. */
  except?: readonly string[];
  /** Write "{{ name }}" (true) or "{{name}}" (false). Default: true. */
  spacing?: boolean;
  /** Opening delimiter. Default: "{{". */
  prefix?: string;
  /** Closing delimiter. Default: "}}". */
  suffix?: string;
  /**
   * Split Laravel plural strings into _zero/_one/_other keys. This changes
   * the keys of the output, so the returned type T does not describe them.
   * Default: false.
   */
  plurals?: boolean;
}

/**
 * Convert Laravel-style placeholders (:name) to i18next ones ({{ name }}).
 * Non-object input is returned unchanged.
 */
export declare function ffixer<T>(translations: T, options?: FfixerOptions): T;

/** @deprecated Pass an options object instead: ffixer(t, { debug, clone }). */
export declare function ffixer<T>(translations: T, debug?: boolean, clone?: boolean): T;

/** Convert the placeholders in a single string. */
export declare function fixString(value: string, options?: FfixerOptions): string;

/** Minimal shape of an i18next instance needed by registerFormatters. */
export interface I18nextLike {
  services: {
    formatter: {
      add(name: string, fn: (value: unknown) => string): void;
    };
  };
}

/** Register the "capitalize" and "uppercase" formatters used by :Name and :NAME. */
export declare function registerFormatters(i18n: I18nextLike): void;

export default ffixer;
