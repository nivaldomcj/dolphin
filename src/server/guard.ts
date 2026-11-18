/**
 * Rejects requests whose Host or Origin is not this machine's own name for dolphin. Binding to 127.0.0.1 does not
 * stop DNS rebinding: a web page whose domain resolves to 127.0.0.1 would otherwise reach the API and MCP routes.
 */
export function makeGuard(getPort: () => number) {
  const names = ["127.0.0.1", "localhost", "dolphin.localhost"];
  let port = -1;
  let hosts = new Set<string>();
  let origins = new Set<string>();
  // Built on first use from the port the server actually bound (PORT=0 picks a free one).
  const allowed = () => {
    if (getPort() !== port) {
      port = getPort();
      // Browsers omit the default port from Host and Origin, so on port 80 the bare names are the ones they send.
      hosts = new Set(names.flatMap((h) => (port === 80 ? [h, `${h}:80`] : [`${h}:${port}`])));
      origins = new Set([...hosts].map((h) => `http://${h}`));
    }
    return { hosts, origins };
  };

  return function guard<A extends unknown[]>(handler: (req: Request, ...rest: A) => Response | Promise<Response>) {
    return (req: Request, ...rest: A): Response | Promise<Response> => {
      // Host names are case-insensitive.
      const host = (req.headers.get("host") ?? "").toLowerCase();
      const origin = req.headers.get("origin")?.toLowerCase() ?? null;
      // A native MCP client sends no Origin; a browser page always does on a POST.
      const { hosts, origins } = allowed();
      if (!hosts.has(host) || (origin !== null && !origins.has(origin))) {
        return new Response("Forbidden host or origin", { status: 403 });
      }
      return handler(req, ...rest);
    };
  };
}
