const maxBytes = 8_000_000;
const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);

export function productImageUrl(path: string) {
  return `/api/product-images/file/${path}`;
}

export function readTroopImage(file: File, maxEdge: number) {
  if (!file.type.startsWith("image/") || file.size > 4_000_000) {
    return Promise.reject(new Error("image"));
  }
  return drawImage(file, maxEdge);
}

export function readProductImage(file: File) {
  if (!allowed.has(file.type)) return Promise.reject(new Error("type"));
  if (file.size > maxBytes) return Promise.reject(new Error("size"));
  return drawImage(file, 1600);
}

function drawImage(file: File, maxEdge: number) {
  return new Promise<string>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error("type"));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.75));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("type"));
    };
    image.src = url;
  });
}
