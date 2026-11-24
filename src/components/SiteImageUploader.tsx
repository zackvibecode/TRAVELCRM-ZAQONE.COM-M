import { useRef, useState } from "react";
import { Image, Loader2, UploadCloud } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useLang } from "@/lib/i18n";

interface SiteImageUploaderProps {
  /** Current image URL (e.g. /website/site-images/site/abc.jpg) — empty = none. */
  value: string;
  /** Called with the served image URL after a successful upload. */
  onChange: (url: string) => void;
  /** R2 folder prefix — "site" for website content, "branding" etc. */
  folder?: string;
  /** Hint text under the drop area. */
  hint?: string;
}

/**
 * Uploads an image to the Worker (R2) via POST /website/admin/images
 * (multipart form). Requires super_admin/management role. On success the
 * public URL (/website/site-images/<key>) is passed to onChange.
 */
export default function SiteImageUploader({
  value,
  onChange,
  folder = "site",
  hint,
}: SiteImageUploaderProps) {
  const { t } = useLang();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const upload = async (file: File) => {
    setError("");
    if (file.size > 5 * 1024 * 1024) {
      setError(t("Fail mesti 5 MB atau lebih kecil.", "File must be 5 MB or smaller."));
      return;
    }
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (file.type && !allowed.includes(file.type)) {
      setError(t("Hanya JPEG, PNG, WebP atau GIF dibenarkan.", "Only JPEG, PNG, WebP or GIF allowed."));
      return;
    }

    const form = new FormData();
    form.append("file", file);
    form.append("folder", folder);

    setUploading(true);
    try {
      const res = await apiFetch<{ url: string; key: string }>(
        "/website/admin/images",
        { method: "POST", body: form },
      );
      if (res.url) {
        onChange(res.url);
      } else {
        setError(t("Gagal memuat naik — tiada URL balasan.", "Upload failed — no URL returned."));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(
        msg
          ? `${t("Gagal memuat naik", "Upload failed")}: ${msg}`
          : t("Gagal memuat naik. Cuba lagi.", "Upload failed. Try again."),
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={0}
        aria-label={t("Klik untuk pilih gambar", "Click to choose an image")}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) void upload(file);
        }}
        className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-muted)] px-4 py-6 text-center transition-colors hover:border-[var(--color-primary)]"
      >
        {uploading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin text-[var(--color-primary)]" />
            <span className="text-xs text-muted-foreground">
              {t("Sedang memuat naik…", "Uploading…")}
            </span>
          </>
        ) : value ? (
          <>
            <img
              src={value}
              alt={t("Pratonton gambar", "Image preview")}
              className="max-h-40 w-auto rounded-md object-contain"
            />
            <span className="text-[11px] text-muted-foreground">
              {t("Klik untuk tukar gambar", "Click to replace the image")}
            </span>
          </>
        ) : (
          <>
            <UploadCloud className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs font-medium">
              {t("Klik untuk pilih gambar, atau seret ke sini", "Click to choose an image, or drag one here")}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Image className="h-3 w-3" />
              {hint ?? t("JPEG/PNG/WebP/GIF · maks 5 MB", "JPEG/PNG/WebP/GIF · max 5 MB")}
            </span>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      {value && !uploading ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="self-start text-[11.5px] font-medium text-[var(--color-danger)] hover:underline"
        >
          {t("Buang gambar", "Remove image")}
        </button>
      ) : null}
      {error ? (
        <p role="alert" className="m-0 text-[12px] font-medium text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
