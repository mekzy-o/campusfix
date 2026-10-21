/** Lets the user attach photos, with previews and client-side type/size checks. */
import { useEffect, useMemo, useRef } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { MAX_IMAGES } from '../lib/schemas';

export default function ImagePicker({ files, onChange, error, id = 'images', label = 'Add photos' }) {
  const inputRef = useRef(null);
  const previews = useMemo(() => files.map((f) => ({ file: f, url: URL.createObjectURL(f) })), [files]);
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {previews.map((p, i) => (
          <figure key={p.url} className="relative h-24 w-24 overflow-hidden rounded-md border border-line">
            <img src={p.url} alt={`Selected photo ${i + 1}: ${p.file.name}`} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(files.filter((_, idx) => idx !== i))}
              className="absolute top-1 right-1 rounded-full bg-ink/80 p-1 text-white hover:bg-ink"
              aria-label={`Remove ${p.file.name}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </figure>
        ))}
        {files.length < MAX_IMAGES && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-line-strong text-sm text-muted hover:border-navy hover:text-navy"
          >
            <ImagePlus className="h-5 w-5" aria-hidden />
            {label}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        aria-label={label}
        onChange={(e) => {
          onChange([...files, ...Array.from(e.target.files || [])]);
          e.target.value = '';
        }}
      />
      {error ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : (
        <p className="mt-2 text-sm text-faint">Up to {MAX_IMAGES} JPG, PNG or WEBP photos, 3 MB each.</p>
      )}
    </div>
  );
}
