const quoteMap: Record<string, string> = {
  '“': '"',
  '”': '"',
  '‘': "'",
  '’': "'",
  '，': ',',
  '。': '.',
  '：': ':',
  '；': ';',
  '！': '!',
  '？': '?',
};

export function normalizeTypingText(input: string) {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/[“”‘’，。：；！？]/g, (char) => quoteMap[char] ?? char)
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}
