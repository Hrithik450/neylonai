import React from "react";

export function useTypingAnimation(texts: string[], introTextFull: string) {
  const [introText, setIntroText] = React.useState("");
  const [displayText, setDisplayText] = React.useState("");

  const typingIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const introIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const nextTextTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const clearAll = React.useCallback(() => {
    if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    if (introIntervalRef.current) clearInterval(introIntervalRef.current);
    if (nextTextTimeoutRef.current) clearTimeout(nextTextTimeoutRef.current);
  }, []);

  const loopTexts = React.useCallback(
    (text: string, index: number) => {
      let i = -1;
      typingIntervalRef.current = setInterval(() => {
        setDisplayText((prev) => prev + text.charAt(i));
        i++;
        if (i >= text.length) {
          clearInterval(typingIntervalRef.current!);
          nextTextTimeoutRef.current = setTimeout(() => {
            setDisplayText("");
            const nextIndex = (index + 1) % texts.length;
            loopTexts(texts[nextIndex], nextIndex);
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
    let i = 0;
    introIntervalRef.current = setInterval(() => {
      i++;
      setIntroText(introTextFull.slice(0, i + 1));
      if (i >= introTextFull.length) {
        clearInterval(introIntervalRef.current!);
        loopTexts(texts[0], 0);
      }
    }, 70);
  }, [clearAll, introTextFull, texts, loopTexts]);

  React.useEffect(() => {
    return () => clearAll();
  }, [clearAll]);

  return { introText, displayText, startAnimation };
}
