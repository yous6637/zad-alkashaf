import { createFileRoute } from "@tanstack/react-router";
import { openProductImage } from "@/lib/zad/upload.server";

export const Route = createFileRoute("/api/product-images/file/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const file = await openProductImage(params._splat ?? "");
        if (!file) return new Response(null, { status: 404 });
        return new Response(new Uint8Array(file.bytes), {
          headers: {
            "content-type": file.type,
            "cache-control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
