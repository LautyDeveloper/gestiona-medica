// @vitest-environment node

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
  fileURLToPath(new URL('../app/globals.css', import.meta.url)),
  'utf8',
);

type Oklch = [number, number, number];

function themeVariables(selector: ':root' | '.dark') {
  const block = new RegExp(
    `${selector.replace('.', '\\.')}\\s*\\{([^}]+)\\}`,
  ).exec(css)?.[1];
  if (!block) throw new Error(`No se encontró el tema ${selector}`);
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*oklch\(([^/)]+)\)/g)].map(
      ([, name, values]) => [
        name,
        values.trim().split(/\s+/).map(Number) as Oklch,
      ],
    ),
  );
}

function luminance([lightness, chroma, hue]: Oklch) {
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  const red = clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const green = clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const blue = clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: Oklch, second: Oklch) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe('contraste de los temas', () => {
  it.each([
    [':root', 'claro'],
    ['.dark', 'oscuro'],
  ] as const)('cumple AA en el tema %s (%s)', (selector, _label) => {
    const colors = themeVariables(selector);
    const pairs = [
      ['background', 'foreground'],
      ['card', 'card-foreground'],
      ['primary', 'primary-foreground'],
      ['secondary', 'secondary-foreground'],
      ['muted', 'muted-foreground'],
      ['accent', 'accent-foreground'],
      ['card', 'appointment'],
      ['card', 'order'],
      ['card', 'medication'],
      ['card', 'prescription'],
      ['card', 'task'],
    ] as const;

    for (const [background, foreground] of pairs)
      expect(
        contrast(colors[background], colors[foreground]),
        `${foreground} sobre ${background}`,
      ).toBeGreaterThanOrEqual(4.5);
  });
});
