import { mountSupportWidget } from "./embed";

// Allow websites to inject user data via the global window object
declare global {
  interface Window {
    NeylonAI?: {
      user?: {
        id?: string;
        email?: string;
        name?: string;
        profile_image?: string;
      };
    };
  }
}

if (typeof document !== "undefined") {
  const currentScript = document.currentScript as HTMLScriptElement;
  let apiKey = currentScript?.getAttribute("data-key");
  let scriptElement = currentScript;
  
  if (!apiKey) {
    // Fallback if currentScript is null (e.g. async without currentScript in some browsers)
    const scripts = document.querySelectorAll("script");
    for (let i = 0; i < scripts.length; i++) {
      const key = scripts[i].getAttribute("data-key");
      if (key) {
        apiKey = key;
        scriptElement = scripts[i];
        break;
      }
    }
  }

  if (apiKey) {
    // 1. Check for user data on the script tag itself (data-user-email, etc.)
    const dataUserId = scriptElement?.getAttribute("data-user-id");
    const dataUserEmail = scriptElement?.getAttribute("data-user-email");
    const dataUserName = scriptElement?.getAttribute("data-user-name");
    
    // 2. Check for user data on the global window object
    const windowUser = window.NeylonAI?.user;

    // Combine them (script tag attributes take precedence over window, or vice versa)
    const userId = dataUserId || windowUser?.id;
    const userEmail = dataUserEmail || windowUser?.email;
    const userName = dataUserName || windowUser?.name;
    const userProfileImage = windowUser?.profile_image;

    let user = null;
    if (userId || userEmail) {
      user = {
        id: userId || "",
        email: userEmail || "",
        name: userName || "",
        profile_image: userProfileImage || "",
      };
    }

    mountSupportWidget({ 
      config: { 
        apiKey,
        ...(user ? { user } : {})
      } 
    });
  }
}
