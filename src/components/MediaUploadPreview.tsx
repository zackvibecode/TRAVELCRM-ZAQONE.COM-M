import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MediaUploadPreviewProps {
  images: string[];
  onChange: (images: string[]) => void;
}

export default function MediaUploadPreview({
  images,
  onChange,
}: MediaUploadPreviewProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const urls = Array.from(files).map((f) => URL.createObjectURL(f));
    onChange([...images, ...urls]);
  }

  function removeImage(url: string) {
    onChange(images.filter((i) => i !== url));
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Images</div>

      <div
        className={[
          "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-6 text-center transition-colors",
          dragging ? "border-primary bg-primary/5" : "hover:bg-muted/40",
        ].join(" ")}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <ImagePlus className="h-6 w-6 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Click or drag images here
        </p>
        <Button type="button" variant="outline" size="sm">
          Browse
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((img, i) => (
            <div
              key={img}
              className="group relative aspect-square overflow-hidden rounded-md border"
            >
              <img
                src={img}
                alt={`Preview ${i + 1}`}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(img)}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                title="Remove"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
