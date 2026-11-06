// Client-side checks for uploaded thumbnails. This is a first line of defence only —
// real moderation (explicit-content scanning, malware checks) must run on your server.

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

async function sniffType(file: File): Promise<"jpeg" | "png" | "webp" | null> {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "webp";
  return null; // checks real file bytes, so a renamed .exe/.svg is rejected
}

export async function prepareThumbnail(file: File): Promise<{ ok: true; dataUrl: string } | { ok: false; error: string }> {
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "Image is too large. Maximum size is 3 MB." };
  if (!(await sniffType(file))) return { ok: false, error: "Only real JPG, PNG or WebP images are allowed." };

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("bad image"));
      i.src = url;
    });
    if (img.width < 480 || img.height < 270) return { ok: false, error: "Image must be at least 480 × 270 pixels." };
    // Re-encoding through a canvas strips metadata and any hidden payload.
    const w = Math.min(640, img.width);
    const h = Math.round((img.height * w) / img.width);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")!.drawImage(img, 0, 0, w, h);
    return { ok: true, dataUrl: c.toDataURL("image/jpeg", 0.8) };
  } catch {
    return { ok: false, error: "We couldn’t read that image. Try another file." };
  } finally {
    URL.revokeObjectURL(url);
  }
}
