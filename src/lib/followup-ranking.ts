/**
 * Shared ranking model for the Dashboard & Leaderboard feature. Lives in
 * `lib` so the page, the chart components and (later) the backend summary
 * types can all import it without a components → pages dependency.
 */

export interface SalesScore {
  id: string;
  name: string;
  /**
   * Staff user id — used to highlight the signed-in rep's own row. In the
   * mock layer it is empty and the name is matched instead; the backend
   * supplies the real id.
   */
  userId?: string;
  /** Follow-ups confirmed manually (FU1/FU2/FU3 marked complete). */
  completed: number;
  /** Distinct leads touched — the same lead counted once per period. */
  uniqueLeads: number;
  /** Distinct days with at least one follow-up — rewards consistency. */
  activeDays: number;
  /** Leads that reached "won" within the period. */
  won: number;
}

/**
 * Leaderboard score — built from UNIQUE activity only, per the plan idea
 * ("leaderboard berasaskan aktiviti unik"). Repeated touches on the same
 * lead, or many follow-ups on a single day, do not inflate the score.
 *   uniqueLeads ×10  — breadth of pipeline actually worked
 *   activeDays  ×5  — consistency across the period
 *   won         ×25 — outcome quality
 * `completed` is shown for context but deliberately NOT scored, so a rep
 * cannot climb by re-nudging the same few leads.
 */
export function leaderboardScore(s: SalesScore): number {
  return s.uniqueLeads * 10 + s.activeDays * 5 + s.won * 25;
}
