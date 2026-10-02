import { createRouter } from "@tanstack/react-router";
import { createIsomorphicFn, getGlobalStartContext } from "@tanstack/react-start";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

const getCspNonce = createIsomorphicFn()
  .server(() => getGlobalStartContext()?.nonce)
  .client(() => {
    const script = document.querySelector("script[nonce]") as HTMLScriptElement | null;
    return script?.nonce || undefined;
  });

export function getRouter() {
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    ssr: { nonce: getCspNonce() },
  });
}
