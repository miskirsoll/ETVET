"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * UNVERIFIED against a real Supabase Storage service -- see migration
 * 0008_media_storage.sql for why. Follows the standard supabase-js
 * Storage upload + getPublicUrl pattern.
 */
export function FileUpload({
  orgId,
  accept,
  onUploaded,
  label = "Upload file",
}: {
  orgId: string;
  accept: string;
  onUploaded: (url: string) => void;
  label?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);
    const supabase = createClient();
    const path = `${orgId}/${crypto.randomUUID()}-${file.name}`;
    const { data, error: uploadError } = await supabase.storage.from("media").upload(path, file);

    if (uploadError || !data) {
      setError(uploadError?.message ?? "Upload failed.");
      setUploading(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("media").getPublicUrl(data.path);
    onUploaded(publicUrl);
    setUploading(false);
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="inline-block w-fit cursor-pointer rounded border border-black/15 px-3 py-1.5 text-xs dark:border-white/20">
        {uploading ? "Uploading…" : label}
        <input type="file" accept={accept} onChange={handleChange} disabled={uploading} className="hidden" />
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
