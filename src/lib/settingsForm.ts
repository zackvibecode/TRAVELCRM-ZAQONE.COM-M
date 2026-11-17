import { useCallback, useMemo, useState } from "react";

/**
 * Shared client-side validation + save-state helpers for settings forms.
 * Keeps form state tracking consistent (idle → dirty → saving → saved/error)
 * across every settings page.
 */

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export function hasMeaningfulChange<T extends Record<string, unknown>>(
  form: T,
  initial: T,
): boolean {
  return (Object.keys(initial) as (keyof T)[]).some(
    (k) => String(form[k]) !== String(initial[k]),
  );
}

/** Simulate a save request (backend settings API menyusul pada fasa backend). */
export function useSettingsSave<T extends Record<string, unknown>>(
  form: T,
  initial: T,
  validate?: (form: T) => Record<string, string>,
  opts?: { onSaved?: () => void },
) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const dirty = useMemo(() => hasMeaningfulChange(form, initial), [form, initial]);

  const save = useCallback(() => {
    const validationErrors = validate?.(form) ?? {};
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      setSaveState("error");
      window.setTimeout(() => setSaveState(dirty ? "dirty" : "idle"), 2000);
      return false;
    }
    setSaveState("saving");
    window.setTimeout(() => {
      setSaveState("saved");
      opts?.onSaved?.();
      window.setTimeout(() => setSaveState("idle"), 2000);
    }, 500);
    return true;
  }, [form, validate, opts, dirty]);

  return { saveState, setSaveState, errors, setErrors, dirty, save };
}

/** Field-level validators. Return an error message or undefined. */
export const validators = {
  required(value: string): string | undefined {
    return value.trim() ? undefined : "required";
  },
  email(value: string): string | undefined {
    if (!value.trim()) return undefined;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? undefined : "email";
  },
  url(value: string): string | undefined {
    if (!value.trim()) return undefined;
    return /^https?:\/\/.+\..+/.test(value) ? undefined : "url";
  },
  phone(value: string): string | undefined {
    if (!value.trim()) return undefined;
    return /^[+\d][\d\s\-()]{6,}$/.test(value) ? undefined : "phone";
  },
  numberRange(min: number, max: number) {
    return (value: number): string | undefined =>
      value >= min && value <= max ? undefined : "range";
  },
};
