/* ================================================================== *
 * Aperture — local board manager
 * ------------------------------------------------------------------
 * Named board snapshots persisted to localStorage so you can keep and
 * switch between several boards. Independent of the live collab room.
 * ================================================================== */

import type { Shape, SavedBoard } from "./types";

const KEY = "aperture:boards:v1";
const uid = () => Math.random().toString(36).slice(2, 10);

function read(): SavedBoard[] {
  try { const raw = localStorage.getItem(KEY); if (!raw) return []; const arr = JSON.parse(raw); return Array.isArray(arr) ? arr : []; }
  catch { return []; }
}
function write(list: SavedBoard[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 40))); } catch {}
}

export function listBoards(): SavedBoard[] {
  return read().sort((a, b) => b.updated - a.updated);
}

export function saveBoardSnapshot(name: string, shapes: Shape[]): SavedBoard {
  const list = read();
  const board: SavedBoard = { id: uid(), name: name.trim() || "Untitled board", updated: Date.now(), shapes: structuredClone(shapes) };
  list.unshift(board);
  write(list);
  return board;
}

export function updateBoard(id: string, shapes: Shape[]): void {
  const list = read();
  const b = list.find((x) => x.id === id);
  if (!b) return;
  b.shapes = structuredClone(shapes); b.updated = Date.now();
  write(list);
}

export function renameBoard(id: string, name: string): void {
  const list = read();
  const b = list.find((x) => x.id === id);
  if (b) { b.name = name.trim() || b.name; b.updated = Date.now(); write(list); }
}

export function deleteBoard(id: string): void {
  write(read().filter((x) => x.id !== id));
}

export function getBoard(id: string): SavedBoard | undefined {
  return read().find((x) => x.id === id);
}

export function boardCount(): number {
  return read().length;
}
