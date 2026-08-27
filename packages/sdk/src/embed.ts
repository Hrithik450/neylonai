import type { SupportWidgetProps } from "./react/config/types";
import { WIDGET_STYLES } from "./widget-styles";

export {
  defineWidgetCustomization,
  type WidgetFontConfig,
} from "./widget-config";
export type {
  SupportWidgetConfig,
  SupportWidgetProps,
  StoredWidgetConfig,
} from "./react/config/types";

export type WidgetMountTarget = string | HTMLElement;

export interface MountSupportWidgetOptions extends SupportWidgetProps {
  /** CSS selector or host element. Omit to create a container in document.body. */
  target?: WidgetMountTarget;
}

export interface MountedSupportWidget {
  readonly element: HTMLElement;
  update(props: SupportWidgetProps): void;
  unmount(): void;
}

type MountRecord = {
  controller: MountedSupportWidget;
};

const mounts = new WeakMap<HTMLElement, MountRecord>();
const pendingMounts = new WeakMap<HTMLElement, Promise<MountedSupportWidget>>();

function resolveTarget(target?: WidgetMountTarget): {
  element: HTMLElement;
  owned: boolean;
} {
  if (typeof document === "undefined") {
    throw new Error("mountSupportWidget can only run in a browser.");
  }
  if (typeof target === "string") {
    const element = document.querySelector(target);
    if (!element) throw new Error(`Widget mount target not found: ${target}`);
    if (!(element instanceof HTMLElement)) {
      throw new Error(`Widget mount target must be an HTML element: ${target}`);
    }
    return { element, owned: false };
  }
  if (target) return { element: target, owned: false };

  const element = document.createElement("div");
  element.dataset.neylonaiMount = "";
  document.body.appendChild(element);
  return { element, owned: true };
}

/**
 * Framework-agnostic widget mount. React is owned internally and never appears
 * in the host application's integration code.
 */
export function mountSupportWidget(
  options: MountSupportWidgetOptions = {},
): Promise<MountedSupportWidget> {
  const { target, ...initialProps } = options;
  const resolved = resolveTarget(target);
  const existing = mounts.get(resolved.element);
  if (existing) {
    existing.controller.update(initialProps);
    return Promise.resolve(existing.controller);
  }
  const pending = pendingMounts.get(resolved.element);
  if (pending) {
    return pending.then((controller) => {
      controller.update(initialProps);
      return controller;
    });
  }

  const mounting = Promise.all([
    import("react"),
    import("react-dom/client"),
    import("./react/support-widget"),
  ]).then(([react, reactDom, widgetModule]) => {
    let shadowRoot: ShadowRoot;
    try {
      shadowRoot =
        resolved.element.shadowRoot ??
        resolved.element.attachShadow({ mode: "open" });
    } catch {
      throw new Error("Widget mount target cannot host a Shadow DOM root.");
    }
    if (!shadowRoot.querySelector("style[data-neylonai-styles]")) {
      const style = document.createElement("style");
      style.dataset.neylonaiStyles = "";
      style.textContent = WIDGET_STYLES;
      shadowRoot.appendChild(style);
    }
    const mountPoint = document.createElement("div");
    mountPoint.dataset.neylonaiRoot = "";
    shadowRoot.appendChild(mountPoint);

    const root = reactDom.createRoot(mountPoint);
    let mounted = true;
    const controller: MountedSupportWidget = {
      element: resolved.element,
      update(props) {
        if (!mounted) {
          throw new Error("Cannot update an unmounted Neylon AI widget.");
        }
        root.render(react.createElement(widgetModule.SupportWidget, props));
      },
      unmount() {
        if (!mounted) return;
        mounted = false;
        root.unmount();
        mountPoint.remove();
        mounts.delete(resolved.element);
        if (resolved.owned) resolved.element.remove();
      },
    };

    mounts.set(resolved.element, { controller });
    controller.update(initialProps);
    return controller;
  });
  pendingMounts.set(resolved.element, mounting);
  void mounting.then(
    () => pendingMounts.delete(resolved.element),
    () => pendingMounts.delete(resolved.element),
  );
  return mounting;
}