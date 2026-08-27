import { mountSupportWidget } from "./embed";

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
    const dataUserId = scriptElement?.getAttribute("data-user-id");
    const dataUserEmail = scriptElement?.getAttribute("data-user-email");
    const dataUserName = scriptElement?.getAttribute("data-user-name");
    
    const windowUser = window.NeylonAI?.user;

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