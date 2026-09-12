"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Save } from "lucide-react";
import { FONT_CHOICES, type Theme } from "@/lib/types/db";
import { updateTheme } from "../actions";
import { FileUpload } from "@/components/FileUpload";
import { contrastRatio, meetsWcagAA } from "@/lib/theme/contrast";

export function ThemeEditor({ theme, orgId }: { theme: Theme; orgId: string }) {
  const [name, setName] = useState(theme.name);
  const [colors, setColors] = useState(theme.colors);
  const [fonts, setFonts] = useState(theme.fonts);
  const [logoUrl, setLogoUrl] = useState(theme.logo_url ?? "");
  const [layout, setLayout] = useState(theme.layout_config);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  async function save() {
    await updateTheme(theme.id, {
      name,
      colors,
      fonts,
      logo_url: logoUrl || null,
      layout_config: layout,
    });
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 1500);
  }

  const inputClass = "rounded border border-black/10 px-3 py-2 text-sm dark:border-white/20";

  const textOnBackground = contrastRatio(colors.text, colors.background);
  const primaryOnBackground = contrastRatio(colors.primary, colors.background);

  return (
    <div className="flex flex-col gap-6">
      <label className="flex flex-col gap-1 text-sm">
        Theme name
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <fieldset className="flex flex-col gap-3 rounded border border-black/10 p-4 shadow-sm dark:border-white/10">
        <legend className="px-1 text-sm font-medium">Colors</legend>
        {(["primary", "background", "text"] as const).map((key) => (
          <label key={key} className="flex items-center justify-between text-sm capitalize">
            {key}
            <input
              type="color"
              value={colors[key]}
              onChange={(e) => setColors({ ...colors, [key]: e.target.value })}
              className="h-8 w-14"
            />
          </label>
        ))}
        <div className="flex flex-col gap-1 border-t border-black/10 pt-3 text-xs dark:border-white/10">
          <ContrastCheck
            label="Body text on background"
            ratio={textOnBackground}
            required={4.5}
          />
          <ContrastCheck
            label="Primary (buttons/links) on background"
            ratio={primaryOnBackground}
            required={3}
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded border border-black/10 p-4 shadow-sm dark:border-white/10">
        <legend className="px-1 text-sm font-medium">Fonts</legend>
        {(["heading", "body"] as const).map((key) => (
          <label key={key} className="flex items-center justify-between gap-2 text-sm capitalize">
            {key}
            <select
              className={inputClass}
              value={fonts[key]}
              onChange={(e) => setFonts({ ...fonts, [key]: e.target.value })}
            >
              {FONT_CHOICES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded border border-black/10 p-4 shadow-sm dark:border-white/10">
        <legend className="px-1 text-sm font-medium">Branding</legend>
        <label className="flex flex-col gap-1 text-sm">
          Logo URL
          <input
            className={inputClass}
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://…"
          />
        </label>
        <FileUpload orgId={orgId} accept="image/*" label="Upload logo" onUploaded={setLogoUrl} />
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Logo preview" className="h-10 w-auto" />
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded border border-black/10 p-4 shadow-sm dark:border-white/10">
        <legend className="px-1 text-sm font-medium">Layout</legend>
        <label className="flex items-center justify-between text-sm">
          Content width
          <select
            className={inputClass}
            value={layout.width}
            onChange={(e) => setLayout({ ...layout, width: e.target.value as "narrow" | "wide" })}
          >
            <option value="narrow">Narrow</option>
            <option value="wide">Wide</option>
          </select>
        </label>
        <label className="flex items-center justify-between text-sm">
          Block entrance animations
          <input
            type="checkbox"
            checked={layout.animations}
            onChange={(e) => setLayout({ ...layout, animations: e.target.checked })}
          />
        </label>
      </fieldset>

      <button
        onClick={save}
        className="flex items-center gap-1.5 self-start rounded bg-brand px-5 py-2.5 text-sm text-brand-foreground"
      >
        {saved ? <Check className="h-4 w-4" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
        {saved ? "Saved" : "Save theme"}
      </button>
    </div>
  );
}

/**
 * A soft warning, not a blocked save -- an author mid-way through picking
 * a palette shouldn't be locked out of saving other changes because one
 * color pair isn't finalized yet. The point is that the gap can't be
 * missed, not that it can't be shipped.
 */
function ContrastCheck({
  label,
  ratio,
  required,
}: {
  label: string;
  ratio: number;
  required: 3 | 4.5;
}) {
  const passes = meetsWcagAA(ratio, required === 3);
  return (
    <p
      role={passes ? undefined : "alert"}
      className={`flex items-center gap-1.5 ${passes ? "text-black/50 dark:text-white/50" : "font-medium text-red-600"}`}
    >
      {passes ? (
        <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
      )}
      {label}: {ratio.toFixed(1)}:1 (WCAG AA needs {required}:1
      {passes ? ", passes" : " — too low"})
    </p>
  );
}
