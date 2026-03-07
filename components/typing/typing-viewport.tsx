'use client';

import { memo } from 'react';

import { cn } from '@/lib/utils';
import type { TypingViewportProps } from '@/components/typing/types';

export const TypingViewport = memo(function TypingViewport({
  articleTitle,
  renderedText,
  isFocused,
  typedChars,
  currentCharIndex,
  visibleLines,
  isLineMeasureReady,
  hiddenInputRef,
  textMeasureRef,
  onInputValue,
  onBackspace,
  onPaste,
  onFocusChange,
  onFocusTypingArea,
}: TypingViewportProps) {
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>{articleTitle}</span>
        <span>自动保存已开启</span>
      </div>

      <div
        onMouseDown={(event) => {
          event.preventDefault();
          onFocusTypingArea();
        }}
        className="relative flex min-h-0 flex-1 cursor-text items-center px-2 md:px-4"
      >
        <textarea
          ref={hiddenInputRef}
          defaultValue={renderedText}
          onChange={(event) => onInputValue(event.target.value)}
          onFocus={() => onFocusChange(true)}
          onBlur={() => onFocusChange(false)}
          onPaste={onPaste}
          onKeyDown={(event) => {
            if (event.key === 'Backspace') {
              onBackspace();
            }
          }}
          className="absolute inset-0 h-full w-full resize-none opacity-0"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoFocus
        />

        <div
          ref={textMeasureRef}
          className={cn(
            'mx-auto w-full max-w-[1400px] text-center font-mono text-[1.18rem] leading-[1.95] tracking-[0.01em] text-zinc-400/60 transition-opacity md:text-[1.55rem] md:leading-[1.85]',
            !isLineMeasureReady && 'opacity-0',
          )}
        >
          {!isFocused && renderedText.length === 0 ? (
            <div className="mb-8 text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
              点击文本区域开始输入
            </div>
          ) : null}

          <div className="space-y-3">
            {visibleLines.map((line, lineOffset) => {
              const isCurrentLine = lineOffset === 0;
              const lineChars = Array.from(line.text);

              return (
                <div
                  key={`${line.start}-${line.end}`}
                  className={cn(
                    'mx-auto min-h-[3.2rem] max-w-full whitespace-pre-wrap text-center',
                    !isCurrentLine && 'opacity-65',
                  )}
                >
                  {lineChars.map((character, charIndex) => {
                    const absoluteIndex = line.start + charIndex;
                    const typedCharacter = typedChars[absoluteIndex];
                    const hasTyped = typedCharacter !== undefined;
                    const isActive = absoluteIndex === currentCharIndex;
                    const isCorrect = hasTyped && typedCharacter === character;
                    const isIncorrect = hasTyped && typedCharacter !== character;

                    return (
                      <span
                        key={`${absoluteIndex}-${character}`}
                        className={cn(
                          'relative',
                          isCorrect && 'text-foreground',
                          isIncorrect && 'bg-destructive/15 text-destructive',
                          isActive && 'bg-primary/12 text-foreground before:absolute before:bottom-0 before:left-0 before:h-[2px] before:w-full before:bg-primary',
                        )}
                      >
                        {character}
                      </span>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
});
