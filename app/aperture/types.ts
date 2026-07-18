/* ================================================================== *
 * Aperture — shared types
 * ------------------------------------------------------------------
 * Extracted so the canvas page, the geometry/drawing library and the
 * side-panel UI all agree on one shape model. The model is a superset
 * of the original board (new optional fields are ignored by old data).
 * ================================================================== */

export type Tool =
  | "select" | "pan" | "eyedropper" | "measure"
  | "pen" | "marker" | "highlighter" | "neon" | "spray" | "eraser" | "laser"
  | "line" | "arrow" | "connector" | "rect" | "ellipse" | "diamond" | "triangle"
  | "star" | "polygon" | "hexagon" | "parallelogram" | "cloud" | "cylinder" | "frame"
  | "note" | "text" | "image" | "stamp" | "comment";

export type SavedBoard = { id: string; name: string; updated: number; shapes: Shape[] };

export type BoardPrefs = {
  exportBg: string;
  defaultFont: number;
  autoFit: boolean;
  showCoords: boolean;
};

export type Dash = "solid" | "dashed" | "dotted";
export type Bg = "grid" | "dots" | "plain" | "lines" | "iso";

export type Point = { x: number; y: number };

export type Shape = {
  id: string;
  kind: "stroke" | "shape" | "note" | "text" | "image" | "comment";
  tool: Tool;
  color: string;
  width: number;
  alpha?: number;
  dash?: Dash;
  fill?: boolean;
  fillColor?: string;
  fillAlpha?: number;
  bold?: boolean;
  italic?: boolean;
  fontSize?: number;
  align?: "left" | "center" | "right";
  pts?: Point[];
  x0?: number; y0?: number; x1?: number; y1?: number;
  x?: number; y?: number; w?: number; h?: number;
  radius?: number;        // corner radius for rects / notes
  shadow?: boolean;       // drop shadow for shapes
  sides?: number;         // polygon sides
  rotation?: number;      // radians, about the shape centre
  text?: string;
  src?: string;
  by?: string;
  // organisation
  name?: string;
  locked?: boolean;
  hidden?: boolean;
  groupId?: string;
  z?: number;
};

export type Cursor = { x: number; y: number; name: string; color: string; t: number };
export type Peer = { id: string; name: string; color: string };

export type Box = { x: number; y: number; w: number; h: number };

export type Camera = { x: number; y: number; zoom: number };

/* A single value returned by template builders. */
export type TemplateDef = {
  id: string;
  name: string;
  faName: string;
  icon: string;
  build: (cx: number, cy: number) => Shape[];
};
