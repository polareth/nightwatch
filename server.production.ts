import { createRequestHandler } from "@remix-run/server-runtime";
import { serveFile } from "@std/http/file-server";
import { join } from "@std/path/join";

const handleRequest = createRequestHandler(
  // @ts-ignore - not compatible
  await import("./build/server/index.js"),
  "production",
);

export default {
  fetch: async (request) => {
    const pathname = new URL(request.url).pathname;

    try {
      const filePath = join("./build/client", pathname);
      const fileInfo = await Deno.stat(filePath);

      if (fileInfo.isDirectory) {
        throw new Deno.errors.NotFound();
      }

      const response = await serveFile(request, filePath, { fileInfo });

      if (pathname.startsWith("/assets/")) {
        response.headers.set("cache-control", "public, max-age=31536000, immutable");
      } else {
        response.headers.set("cache-control", "public, max-age=600");
      }

      return response;
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }

    return handleRequest(request);
  },
} satisfies Deno.ServeDefaultExport;

/* ---------------------------------- CRON ---------------------------------- */
Deno.cron("Sync sources", { hour: { every: 6 } }, async () => {
  console.log("Running scheduled sources sync...");
  const response = await fetch(`http://172.17.0.1:${Deno.env.get("PORT") ?? "8000"}/api/periodic-sync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("CRON_SECRET")}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Cron job failed: ${response.status} ${response.statusText}. Response: ${errorText}`);
  } else {
    const result = await response.json();
    console.log("Cron job completed successfully:", result);
  }
});
