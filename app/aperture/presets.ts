/* ================================================================== *
 * Aperture — style presets
 * ------------------------------------------------------------------
 * Reusable pen/shape styles saved to localStorage: colour, width,
 * opacity, dash and fill. Apply to the active tool or the selection.
 * ================================================================== */

import type { Dash } from "./types";

export type StylePreset = {
  id: string;
  color: string;
  width: number;
  opacity: number;
  dash: Dash;
  fill: boolean;
  fillColor?: string;
};

const KEY = "aperture:presets:v1";
const uid = () => Math.random().toString(36).slice(2, 10);

const DEFAULTS: StylePreset[] = [
  { id: "d1", color: "#3b82f6", width: 4, opacity: 1, dash: "solid", fill: false },
  { id: "d2", color: "#ef4444", width: 6, opacity: 1, dash: "solid", fill: false },
  { id: "d3", color: "#22c55e", width: 3, opacity: 1, dash: "dashed", fill: true, fillColor: "#22c55e" },
  { id: "d4", color: "#f59e0b", width: 10, opacity: 0.4, dash: "solid", fill: false },
];

export function listPresets(): StylePreset[] {
  try { const raw = localStorage.getItem(KEY); if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr) && arr.length) return arr; } } catch {}
  return DEFAULTS;
}

export function addPreset(p: Omit<StylePreset, "id">): StylePreset[] {
  const list = listPresets();
  const preset: StylePreset = { ...p, id: uid() };
  const next = [preset, ...list].slice(0, 16);
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  return next;
}

export function removePreset(id: string): StylePreset[] {
  const next = listPresets().filter((p) => p.id !== id);
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  return next;
}
