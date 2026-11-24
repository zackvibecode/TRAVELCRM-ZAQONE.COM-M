export type BlockKind =
  | "heading"
  | "text"
  | "hero"
  | "list"
  | "cta"
  | "itinerary"
  | "pricing"
  | "gallery"
  | "notice";

export interface Block {
  id: string;
  kind: BlockKind;
  value: string;
  /** Optional structured payload (itinerary days, price rows, image urls). */
  data?: Record<string, unknown>;
}
