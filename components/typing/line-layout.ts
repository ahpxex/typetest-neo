import type { LineSegment } from '@/components/typing/types';

export const VISIBLE_LINE_COUNT = 4;
export const ESTIMATED_GLYPH_WIDTH = 14;

export function buildVisibleLines(referenceChars: string[], maxCharsPerLine: number) {
  const safeWidth = Math.max(12, maxCharsPerLine);
  const lines: LineSegment[] = [];

  let index = 0;

  while (index < referenceChars.length) {
    const lineStart = index;
    let lineLength = 0;
    let lastBreak = -1;

    while (index < referenceChars.length) {
      const character = referenceChars[index];

      if (character === '\n') {
        break;
      }

      lineLength += 1;
      if (character === ' ') {
        lastBreak = index;
      }

      if (lineLength > safeWidth) {
        if (lastBreak >= lineStart) {
          index = lastBreak + 1;
        }
        break;
      }

      index += 1;
    }

    if (index === lineStart) {
      lines.push({ text: '', start: lineStart, end: lineStart });
      index += 1;
      continue;
    }

    const lineEnd = Math.min(index, referenceChars.length);
    const lineText = referenceChars.slice(lineStart, lineEnd).join('').replace(/\s+$/g, '');
    lines.push({ text: lineText, start: lineStart, end: lineEnd });

    if (referenceChars[index] === '\n') {
      index += 1;
    }
  }

  return lines.length > 0 ? lines : [{ text: '', start: 0, end: 0 }];
}

export function getCurrentLineIndex(lines: LineSegment[], currentCharIndex: number) {
  const resolvedIndex = lines.findIndex((line, index) => {
    const nextLineStart = lines[index + 1]?.start ?? Number.POSITIVE_INFINITY;
    return currentCharIndex >= line.start && currentCharIndex < nextLineStart;
  });

  if (resolvedIndex >= 0) {
    return resolvedIndex;
  }

  return Math.max(lines.length - 1, 0);
}
