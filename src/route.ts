import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { isExamId } from "./exam.ts";

export type LinkClick = (
  event: MouseEvent<HTMLAnchorElement>,
  href: string,
) => void;

export type Route =
  | { name: "list" }
  | { name: "exam"; id: string }
  | { name: "missing" };

export function listPath(): string {
  return import.meta.env.BASE_URL;
}

export function examPath(examId: string): string {
  return `${import.meta.env.BASE_URL}${examId}/`;
}

export function routeFromPath(pathname: string): Route {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const path = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  if (path === base) {
    return { name: "list" };
  }
  const prefix = `${base}/`;
  if (!path.startsWith(prefix)) {
    return { name: "missing" };
  }
  const id = path.slice(prefix.length);
  if (isExamId(id)) {
    return { name: "exam", id };
  }
  return { name: "missing" };
}

function canonicalPath(route: Route): string | null {
  if (route.name === "list") {
    return listPath();
  }
  if (route.name === "exam") {
    return examPath(route.id);
  }
  return null;
}

export function useRoute(): { route: Route; onLinkClick: LinkClick } {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const canonical = canonicalPath(routeFromPath(pathname));
    if (canonical && canonical !== pathname) {
      window.history.replaceState(null, "", canonical);
      setPathname(canonical);
    }
  }, [pathname]);

  const onLinkClick = useCallback<LinkClick>((event, href) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    const url = new URL(href, window.location.href);
    if (url.pathname === window.location.pathname) {
      return;
    }
    window.history.pushState(null, "", url.pathname);
    setPathname(url.pathname);
  }, []);

  return { route: routeFromPath(pathname), onLinkClick };
}
