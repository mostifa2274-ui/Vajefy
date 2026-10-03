/**
 * Pronunciation clips served from R2, when they have moved out of the static
 * assets (docs/OPERATIONS.md). Static files are served before the Worker runs,
 * so this only answers for clips that are not in the deployment. Names are
 * content hashes, so a clip never changes and can be cached for a year.
 */
export async function handleAudio(request: Request, bucket: R2BucketLike): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  const key = new URL(request.url).pathname.replace(/^\/audio\//, "");
  if (!/^[\w-]+\/[\w-]+\.mp3$/.test(key)) return new Response(null, { status: 404 });
  const object = await bucket.get(key);
  if (!object) return new Response(null, { status: 404 });
  const headers = new Headers({
    "Content-Type": object.httpMetadata?.contentType ?? "audio/mpeg",
    "Cache-Control": "public, max-age=31536000, immutable",
    ETag: object.httpEtag,
    "Content-Length": String(object.size),
  });
  return new Response(request.method === "HEAD" ? null : object.body, { headers });
}
