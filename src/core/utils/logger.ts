/** No-console-in-committed-code escape hatch. Debug/info no-op in production builds. See CLAUDE.md §6. */

const isDev: boolean = Boolean(import.meta.env?.DEV);

type LogArgs = unknown[];

function noop(): void {}

export const logger = {
  debug: isDev ? (...args: LogArgs) => console.warn('[frdup:debug]', ...args) : noop,
  info: isDev ? (...args: LogArgs) => console.warn('[frdup:info]', ...args) : noop,
  warn: (...args: LogArgs) => console.warn('[frdup:warn]', ...args),
  error: (...args: LogArgs) => console.error('[frdup:error]', ...args),
};
