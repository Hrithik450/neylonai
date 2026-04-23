import React from "react";

export interface GsiScriptOptions {
  locale?: string;
  nonce?: string;
  onLoad?: () => void;
  onError?: () => void;
}

export function useLoadGsiScript(options: GsiScriptOptions = {}) {
  const { locale, nonce, onError, onLoad } = options;

  const [scriptLoaded, setScriptLoaded] = React.useState(false);

  const onLoadRef = React.useRef(onLoad);
  onLoadRef.current = onLoad;
  const onErrorRef = React.useRef(onError);
  onErrorRef.current = onError;

  React.useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    if (locale) script.src += `?hl=${locale}`;

    script.async = true;
    script.defer = true;
    if (nonce) script.nonce = nonce;

    script.onload = () => {
      setScriptLoaded(true);
      onLoadRef.current?.();
    };

    script.onerror = () => {
      setScriptLoaded(false);
      onErrorRef.current?.();
    };

    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [nonce]);

  return scriptLoaded;
}
