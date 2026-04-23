export {};

declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          prompt: (notification: any) => void;
          cancel: () => void;
          renderButton: (el: HTMLElement | null, options: any) => void;
        };
      };
    };
  }
}
