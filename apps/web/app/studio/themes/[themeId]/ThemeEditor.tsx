"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FONT_CHOICES, type Theme } from "@/lib/types/db";
import { updateTheme } from "../actions";

export function ThemeEditor({ theme }: { theme: Theme }) {
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

      <fieldset className="flex flex-col gap-3 rounded border border-black/10 p-4 dark:border-white/10">
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
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded border border-black/10 p-4 dark:border-white/10">
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

      <fieldset className="flex flex-col gap-3 rounded border border-black/10 p-4 dark:border-white/10">
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
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded border border-black/10 p-4 dark:border-white/10">
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
        className="self-start rounded bg-foreground px-5 py-2.5 text-sm text-background"
      >
        {saved ? "Saved" : "Save theme"}
      </button>
    </div>
  );
}
