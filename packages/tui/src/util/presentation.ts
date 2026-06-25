/**
 * Terminal scrollback presentation helpers.
 *
 * `buildSessionEpilogue()` is emitted to stdout when the TUI exits.
 */
import type { CliRenderer } from '@opentui/core';
import { cliHelpBannerLogoPalette, formatBannerLogoAnsiLines, wordFullSmall } from '../component/banner-logo';

function ansiFg(r: number, g: number, b: number): string {
  return `\x1b[38;2;${r};${g};${b}m`;
}

export function buildSessionEpilogue(
  renderer: CliRenderer,
  input: { title: string; sessionID?: string },
): string {
  const palette = cliHelpBannerLogoPalette();
  const reset = '\x1b[0m';
  const logoFg = palette.logoFg;
  const mutedFg = palette.base;
  const weak = (text: string) =>
    `${ansiFg(Math.round(mutedFg.r * 255), Math.round(mutedFg.g * 255), Math.round(mutedFg.b * 255))}\x1b[2m${text.padEnd(10, ' ')}${reset}`;
  const bold = (text: string) =>
    `${ansiFg(Math.round(logoFg.r * 255), Math.round(logoFg.g * 255), Math.round(logoFg.b * 255))}\x1b[1m${text}${reset}`;
  const continueCommand = input.sessionID ? `deveco -s ${input.sessionID}` : '';

  return [
    ...formatBannerLogoAnsiLines(renderer.terminalWidth, palette, {
      rows: wordFullSmall,
      align: 'start',
    }).map((line) => ` ${line}`),
    '',
    `  ${weak('Session')}${bold(input.title)}`,
    input.sessionID ? `  ${weak('Continue')}${bold(continueCommand)}` : '',
    '',
  ].join('\n');
}

/** @deprecated Use `buildSessionEpilogue(renderer, input)`. */
export function sessionEpilogue(input: { title: string; sessionID?: string }) {
  const reset = '\x1b[0m';
  const bold = '\x1b[1m';
  const dim = '\x1b[90m';
  const weak = (text: string) => `${dim}${text.padEnd(10, ' ')}${reset}`;
  return [
    '',
    `  ${weak('Session')}${bold}${input.title}${reset}`,
    `  ${weak('Continue')}${bold}deveco -s ${input.sessionID}${reset}`,
    '',
  ].join('\n');
}
