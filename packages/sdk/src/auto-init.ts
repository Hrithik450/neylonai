import { mountSupportWidget } from "./embed";

if (typeof document !== "undefined") {
  const currentScript = document.currentScript as HTMLScriptElement;
  let apiKey = currentScript?.getAttribute("data-key");
  
  if (!apiKey) {
    // Fallback if currentScript is null (e.g. async without currentScript in some browsers, though async classic scripts support it)
    const scripts = document.querySelectorAll("script");
    for (let i = 0; i < scripts.length; i++) {
      const key = scripts[i].getAttribute("data-key");
      if (key) {
        apiKey = key;
        break;
      }
    }
  }

  if (apiKey) {
    mountSupportWidget({ config: { apiKey } });
  }
}
