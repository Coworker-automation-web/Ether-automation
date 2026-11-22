import { isRouteErrorResponse, useRouteError } from "react-router-dom";

/** Shown while the router is loading a route. Text only, by design. */
export function RouteLoading() {
  return <div role="status">Loading…</div>;
}

/** Shown when a route throws or does not exist. Text only, by design. */
export function RouteError() {
  const error = useRouteError();
  let message = "Something went wrong.";
  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "Page not found." : `${error.status} ${error.statusText}`;
  } else if (error instanceof Error) {
    message = error.message;
  }
  return <div role="alert">{message}</div>;
}

/** The `*` route: an unknown URL under /app is not an error thrown by a route, so it has its own text. */
export function NotFound() {
  return <div role="alert">Page not found.</div>;
}
