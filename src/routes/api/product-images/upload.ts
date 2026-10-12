import { createFileRoute } from "@tanstack/react-router";
import { saveSignedProductImage } from "@/lib/zad/upload.server";

export const Route = createFileRoute("/api/product-images/upload")({
  server: {
    handlers: {
      PUT: async ({ request }) => {
        try {
          const saved = await saveSignedProductImage(request);
          return Response.json(saved);
        } catch (error) {
          const message = error instanceof Error ? error.message : "تعذّر الرفع";
          const status = message.includes("خمس") || message.includes("بلغت")
            ? 409
            : message.includes("رابط") || message.includes("صلاحية")
              ? 401
              : 400;
          return new Response(message, { status });
        }
      },
    },
  },
});
