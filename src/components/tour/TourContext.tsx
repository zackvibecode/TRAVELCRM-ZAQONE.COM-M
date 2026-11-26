import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * One tour step. `selector` is a `[data-tour="..."]` attribute on the real
 * page element; the overlay waits for it to mount before highlighting.
 */
export interface TourStep {
  /** Route the element lives on. The tour navigates here first. */
  route: string;
  /** Value of the `data-tour` attribute to spotlight. */
  anchor: string;
  /** Preferred tooltip side; falls back automatically if it would overflow. */
  side?: "top" | "right" | "bottom" | "left";
  /** Bahasa Melayu title + body. */
  ms: { title: string; body: string };
  /** English title + body. */
  en: { title: string; body: string };
}

interface TourContextValue {
  /** Whether a tour is currently showing. */
  active: boolean;
  /** Index of the current step inside `steps`. */
  stepIndex: number;
  steps: TourStep[];
  start: () => void;
  next: () => void;
  prev: () => void;
  stop: () => void;
}

const TourContext = createContext<TourContextValue>({
  active: false,
  stepIndex: 0,
  steps: [],
  start: () => {},
  next: () => {},
  prev: () => {},
  stop: () => {},
});

export function TourProvider({ steps, children }: { steps: TourStep[]; children: ReactNode }) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const start = useCallback(() => {
    setStepIndex(0);
    setActive(true);
  }, []);

  const stop = useCallback(() => setActive(false), []);

  const next = useCallback(() => {
    setStepIndex((i) => {
      if (i + 1 >= steps.length) {
        // Past the last step: close instead of running off the end.
        setActive(false);
        return i;
      }
      return i + 1;
    });
  }, [steps.length]);

  const prev = useCallback(() => setStepIndex((i) => Math.max(0, i - 1)), []);

  const value = useMemo<TourContextValue>(
    () => ({ active, stepIndex, steps, start, next, prev, stop }),
    [active, stepIndex, steps, start, next, prev, stop],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour() {
  return useContext(TourContext);
}

/**
 * Expands a collapsible sidebar group (e.g. "/mesin-follow-up") so the tour can
 * highlight a child link that is otherwise hidden. AppShell listens for this.
 */
export function openSidebarGroup(route: string) {
  window.dispatchEvent(new CustomEvent("tour:open-group", { detail: route }));
}
