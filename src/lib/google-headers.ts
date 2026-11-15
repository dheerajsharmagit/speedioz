// Google popup sign-in must be able to communicate with the originating page.
export function googleSignInHeaders(request: Request, response: Response) {
  if (
    !["/auth", "/profile"].includes(new URL(request.url).pathname) ||
    !response.headers.get("content-type")?.includes("text/html")
  )
    return response;
  const headers = new Headers(response.headers);
  headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
