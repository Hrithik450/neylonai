import React from "react";

/**
 * Typewriter for widget greeting + rotating intro lines.
 */
export function useTypingAnimation(texts: string[], introTextFull: string) {
  const [introText, setIntroText] = React.useState("");
  const [displayText, setDisplayText] = React.useState("");

  const typingIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const introIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const nextTextTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const clearAll = React.useCallback(() => {
    if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    if (introIntervalRef.current) clearInterval(introIntervalRef.current);
    if (nextTextTimeoutRef.current) clearTimeout(nextTextTimeoutRef.current);
    typingIntervalRef.current = null;
    introIntervalRef.current = null;
    nextTextTimeoutRef.current = null;
  }, []);

  const loopTexts = React.useCallback(
    (text: string, index: number) => {
      if (!text) return;
      let i = 0;
      typingIntervalRef.current = setInterval(() => {
        setDisplayText(text.slice(0, i + 1));
        i += 1;
        if (i >= text.length) {
          if (typingIntervalRef.current) {
            clearInterval(typingIntervalRef.current);
            typingIntervalRef.current = null;
          }
          nextTextTimeoutRef.current = setTimeout(() => {
            setDisplayText("");
            if (texts.length === 0) return;
            const nextIndex = (index + 1) % texts.length;
            loopTexts(texts[nextIndex] ?? "", nextIndex);
          }, 1000);
        }
      }, 70);
    },
    [texts],
  );

  const startAnimation = React.useCallback(() => {
    clearAll();
    setIntroText("");
    setDisplayText("");

    if (!introTextFull) {
      if (texts[0]) loopTexts(texts[0], 0);
      return;
    }

    let i = 0;
    introIntervalRef.current = setInterval(() => {
      setIntroText(introTextFull.slice(0, i + 1));
      i += 1;
      if (i >= introTextFull.length) {
        if (introIntervalRef.current) {
          clearInterval(introIntervalRef.current);
          introIntervalRef.current = null;
        }
        loopTexts(texts[0] ?? "", 0);
      }
    }, 70);
  }, [clearAll, introTextFull, texts, loopTexts]);

  React.useEffect(() => {
    return () => clearAll();
  }, [clearAll]);

  return { introText, displayText, startAnimation };
}
