import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { X, ChevronLeft, ChevronRight, Compass } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useTour, openSidebarGroup } from "./TourContext";

type Rect = { top: number; left: number; width: number; height: number };

/** Padding, in px, between the target element and the spotlight hole. */
const PAD = 8;
/** Min gap, in px, between the tooltip and the viewport edge. */
const EDGE = 12;
/** How long to wait for an anchor to mount before giving up (ms). */
const WAIT_MS = 4000;

/**
 * Reads the current viewport-space rect of the anchor element, or null if it
 * is not mounted yet. Uses the live element so scroll/resize always reflect.
 */
function measure(anchor: string): Rect | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="${anchor}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/**
 * Picks the tooltip side that keeps it inside the viewport. Prefers the step's
 * requested side, then cycles through the alternatives.
 */
function pickSide(
  preferred: "top" | "right" | "bottom" | "left",
  hole: Rect,
  tip: { w: number; h: number },
): "top" | "right" | "bottom" | "left" {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const TW = tip.w || 340;
  const TH = tip.h || 220;
  const fits: Record<"top" | "right" | "bottom" | "left", boolean> = {
    top: hole.top - PAD - TH - EDGE >= 0,
    bottom: hole.top + hole.height + PAD + TH + EDGE <= vh,
    right: hole.left + hole.width + PAD + TW + EDGE <= vw,
    left: hole.left - PAD - TW - EDGE >= 0,
  };
  if (fits[preferred]) return preferred;
  const order: Array<"top" | "right" | "bottom" | "left"> = ["bottom", "top", "right", "left"];
  for (const s of order) if (fits[s]) return s;
  return preferred;
}

export default function SpotlightOverlay() {
  const { active, stepIndex, steps, next, prev, stop } = useTour();
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const location = useLocation();

  const step = active ? steps[stepIndex] : undefined;
  const [hole, setHole] = useState<Rect | null>(null);
  const [side, setSide] = useState<"top" | "right" | "bottom" | "left">("bottom");
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tipSize, setTipSize] = useState({ w: 340, h: 220 });

  const stepKey = step ? `${step.route}::${step.anchor}` : "";

  /** Navigate to the step's route if we're not already there. */
  useEffect(() => {
    if (!step) return;
    if (location.pathname !== step.route) {
      navigate(step.route);
    }
  }, [step, location.pathname, navigate]);

  /** Wait for the anchor to mount (route may still be rendering). */
  useEffect(() => {
    if (!step) {
      setHole(null);
      return;
    }
    let cancelled = false;
    const started = performance.now();
    const tick = () => {
      if (cancelled) return;
      const r = measure(step.anchor);
      if (r) {
        setHole(r);
        return;
      }
      if (performance.now() - started < WAIT_MS) {
        requestAnimationFrame(tick);
      } else {
        // Anchor never showed (e.g. empty state) — skip to the next step.
        next();
      }
    };
    tick();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepKey]);

  /** Recompute on scroll/resize while a hole is showing. */
  useEffect(() => {
    if (!step || !hole) return;
    const update = () => setHole(measure(step.anchor));
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [step, hole]);

  /** Scroll the anchor into view once when the hole first appears. */
  useEffect(() => {
    if (!step || !hole) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.anchor}"]`);
    el?.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepKey]);

  /** Expand the sidebar group so a highlighted sidebar link is visible. */
  useEffect(() => {
    if (!step) return;
    openSidebarGroup(step.route);
  }, [step]);

  /** Measure the real tooltip size so side-picking is accurate. */
  useLayoutEffect(() => {
    if (!tooltipRef.current) return;
    const r = tooltipRef.current.getBoundingClientRect();
    setTipSize({ w: r.width, h: r.height });
  }, [stepKey, lang]);

  useEffect(() => {
    if (hole && step) setSide(pickSide(step.side ?? "bottom", hole, tipSize));
  }, [hole, step, tipSize]);

  /** Keyboard: Esc closes, arrows navigate. */
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") stop();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, next, prev, stop]);

  /** Lock body scroll while the tour is open. */
  useEffect(() => {
    if (!active) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [active]);

  const isFirst = stepIndex === 0;
  const isLast = stepIndex >= steps.length - 1;

  const tipStyle = useCallback((): React.CSSProperties => {
    if (!hole) return {};
    const gap = PAD + 12;
    const vw = window.innerWidth;
    let top = 0;
    let left = 0;
    switch (side) {
      case "top":
        top = hole.top - gap - tipSize.h;
        left = hole.left + hole.width / 2 - tipSize.w / 2;
        break;
      case "bottom":
        top = hole.top + hole.height + gap;
        left = hole.left + hole.width / 2 - tipSize.w / 2;
        break;
      case "right":
        top = hole.top + hole.height / 2 - tipSize.h / 2;
        left = hole.left + hole.width + gap;
        break;
      case "left":
        top = hole.top + hole.height / 2 - tipSize.h / 2;
        left = hole.left - gap - tipSize.w;
        break;
    }
    // Clamp inside the viewport.
    left = Math.min(Math.max(left, EDGE), vw - tipSize.w - EDGE);
    top = Math.max(top, EDGE);
    return { top, left };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hole, side, tipSize]);

  if (!active || !step) return null;

  const copy = lang === "ms" ? step.ms : step.en;

  return (
    <div className="tour-root" role="dialog" aria-modal="true" aria-label={t("Panduan", "Tour")}>
      {/* Four dark panels leave a transparent "hole" over the target. */}
      {hole ? (
        <>
          <div className="tour-shade" style={{ top: 0, left: 0, width: "100%", height: Math.max(hole.top - PAD, 0) }} />
          <div
            className="tour-shade"
            style={{
              top: Math.max(hole.top - PAD, 0),
              left: 0,
              width: Math.max(hole.left - PAD, 0),
              height: hole.height + PAD * 2,
            }}
          />
          <div
            className="tour-shade"
            style={{
              top: Math.max(hole.top - PAD, 0),
              left: hole.left + hole.width + PAD,
              right: 0,
              width: "auto",
              height: hole.height + PAD * 2,
            }}
          />
          <div
            className="tour-shade"
            style={{ top: hole.top + hole.height + PAD, left: 0, width: "100%", bottom: 0, height: "auto" }}
          />
          <div
            className="tour-ring"
            style={{
              top: hole.top - PAD,
              left: hole.left - PAD,
              width: hole.width + PAD * 2,
              height: hole.height + PAD * 2,
            }}
          />
        </>
      ) : (
        <div className="tour-shade" style={{ inset: 0 }} />
      )}

      <div ref={tooltipRef} className="tour-tip" style={{ ...tipStyle(), visibility: hole ? "visible" : "hidden" }}>
        <div className="tour-tip__head">
          <span className="tour-tip__badge">
            <Compass className="h-3 w-3" />
            {t("Panduan", "Tour")}
          </span>
          <span className="tour-tip__count">
            {stepIndex + 1} / {steps.length}
          </span>
          <button type="button" className="tour-tip__close" onClick={stop} aria-label={t("Tutup panduan", "Close tour")}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <h3 className="tour-tip__title">{copy.title}</h3>
        <p className="tour-tip__body">{copy.body}</p>

        <div className="tour-tip__foot">
          <button type="button" className="tour-tip__skip" onClick={stop}>
            {t("Lewati panduan", "Skip tour")}
          </button>
          <div className="tour-tip__nav">
            <button type="button" className="tour-tip__btn" onClick={prev} disabled={isFirst}>
              <ChevronLeft className="h-4 w-4" />
              {t("Kembali", "Back")}
            </button>
            <button type="button" className="tour-tip__btn tour-tip__btn--primary" onClick={next}>
              {isLast ? t("Tamat", "Finish") : t("Seterusnya", "Next")}
              {!isLast && <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
