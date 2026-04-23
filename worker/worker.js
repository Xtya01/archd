export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Proxy everything to archive.org
    const targetUrl = "https://archive.org" + url.pathname;

    const res = await fetch(targetUrl, {
      headers: {
        Range: request.headers.get("Range") || ""
      }
    });

    return new Response(res.body, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type"),
        "Accept-Ranges": "bytes",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600"
      }
    });
  }
};
