/**
 * Server-side validation for settings payloads. Every settings write goes
 * through here before touching app_settings / bank_accounts / numbering_rules.
 */

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

const CURRENCIES = ["MYR", "USD", "SGD"];
const LANGS = ["ms", "en"];
const ROLES = ["super_admin", "management", "sales", "finance", "operations"];

function isEmail(v: unknown): boolean {
  return typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function isPhone(v: unknown): boolean {
  return typeof v === "string" && /^[+\d][\d\s\-()]{6,}$/.test(v);
}

function isUrl(v: unknown): boolean {
  return typeof v === "string" && /^https?:\/\/.+\..+/.test(v);
}

function isDateString(v: unknown): boolean {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}

/** Validate a `general` settings payload. */
export function validateGeneral(value: Record<string, unknown>): ValidationResult {
  const errors: Record<string, string> = {};
  if (!LANGS.includes(value.defaultLang as string)) {
    errors.defaultLang = "defaultLang must be 'ms' or 'en'";
  }
  if (!CURRENCIES.includes(value.currency as string)) {
    errors.currency = "currency must be one of MYR, USD, SGD";
  }
  if (typeof value.timezone !== "string" || !value.timezone.includes("/")) {
    errors.timezone = "timezone must be a valid IANA zone";
  }
  const threshold = Number(value.seatsThreshold);
  if (!Number.isFinite(threshold) || threshold < 1 || threshold > 100) {
    errors.seatsThreshold = "seatsThreshold must be 1-100";
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

/** Validate a `company` settings payload. */
export function validateCompany(value: Record<string, unknown>): ValidationResult {
  const errors: Record<string, string> = {};
  if (typeof value.name !== "string" || !value.name.trim()) {
    errors.name = "name is required";
  }
  if (value.email !== undefined && value.email !== "" && !isEmail(value.email)) {
    errors.email = "invalid email format";
  }
  if (value.phone !== undefined && value.phone !== "" && !isPhone(value.phone)) {
    errors.phone = "invalid phone format";
  }
  if (value.website !== undefined && value.website !== "" && !isUrl(value.website)) {
    errors.website = "invalid website URL";
  }
  if (value.licenseExpiry !== undefined && !isDateString(value.licenseExpiry)) {
    errors.licenseExpiry = "licenseExpiry must be YYYY-MM-DD";
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

/** Validate a `notifications` payload. */
export function validateNotifications(value: Record<string, unknown>): ValidationResult {
  const errors: Record<string, string> = {};
  for (const key of ["lowSeats", "overdue", "departure", "newLead"]) {
    if (value[key] !== undefined && typeof value[key] !== "boolean") {
      errors[key] = `${key} must be a boolean`;
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

/** Validate a `security` payload. */
export function validateSecurity(value: Record<string, unknown>): ValidationResult {
  const errors: Record<string, string> = {};
  for (const key of ["require2faSuperAdmin"]) {
    if (value[key] !== undefined && typeof value[key] !== "boolean") {
      errors[key] = `${key} must be a boolean`;
    }
  }
  const attempts = Number(value.lockAfterAttempts ?? 5);
  if (!Number.isInteger(attempts) || attempts < 3 || attempts > 10) {
    errors.lockAfterAttempts = "lockAfterAttempts must be 3-10";
  }
  const idle = Number(value.idleTimeoutMinutes ?? 30);
  if (!Number.isInteger(idle) || idle < 5 || idle > 240) {
    errors.idleTimeoutMinutes = "idleTimeoutMinutes must be 5-240";
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

const VALIDATORS: Record<
  string,
  (v: Record<string, unknown>) => ValidationResult
> = {
  general: validateGeneral,
  company: validateCompany,
  notifications: validateNotifications,
  security: validateSecurity,
  terms: validateTerms,
};

export function validateSettingPayload(
  key: string,
  value: Record<string, unknown>,
): ValidationResult {
  const validator = VALIDATORS[key];
  if (!validator) {
    return { valid: false, errors: { key: `unknown settings key '${key}'` } };
  }
  return validator(value);
}

/** Validate a bank account payload. */
export function validateBankAccount(value: {
  bankName?: unknown;
  accountNo?: unknown;
  holder?: unknown;
  isDefault?: unknown;
}): ValidationResult {
  const errors: Record<string, string> = {};
  if (typeof value.bankName !== "string" || !value.bankName.trim()) {
    errors.bankName = "bankName is required";
  }
  if (typeof value.accountNo !== "string" || !value.accountNo.trim()) {
    errors.accountNo = "accountNo is required";
  }
  if (typeof value.holder !== "string" || !value.holder.trim()) {
    errors.holder = "holder is required";
  }
  if (value.isDefault !== undefined && typeof value.isDefault !== "boolean") {
    errors.isDefault = "isDefault must be a boolean";
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Validate a partial bank account update (PATCH). Only the provided fields
 * are checked; at least one field must be present.
 */
export function validateBankAccountPatch(value: {
  bankName?: unknown;
  accountNo?: unknown;
  holder?: unknown;
  isDefault?: unknown;
}): ValidationResult {
  const errors: Record<string, string> = {};
  const provided = Object.keys(value).filter(
    (k) =>
      ["bankName", "accountNo", "holder", "isDefault"].includes(k) &&
      value[k as keyof typeof value] !== undefined,
  );
  if (provided.length === 0) {
    return { valid: false, errors: { _: "at least one field is required" } };
  }
  if (
    value.bankName !== undefined &&
    (typeof value.bankName !== "string" || !value.bankName.trim())
  ) {
    errors.bankName = "bankName must be a non-empty string";
  }
  if (
    value.accountNo !== undefined &&
    (typeof value.accountNo !== "string" || !value.accountNo.trim())
  ) {
    errors.accountNo = "accountNo must be a non-empty string";
  }
  if (
    value.holder !== undefined &&
    (typeof value.holder !== "string" || !value.holder.trim())
  ) {
    errors.holder = "holder must be a non-empty string";
  }
  if (value.isDefault !== undefined && typeof value.isDefault !== "boolean") {
    errors.isDefault = "isDefault must be a boolean";
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

const NUMBERING_DOCS = ["booking", "invoice", "receipt", "quote", "credit_note"];
const RESET_ON = ["never", "year", "month"];

/** Default invoice/booking terms payload. */
export function validateTerms(value: Record<string, unknown>): ValidationResult {
  const errors: Record<string, string> = {};
  const deposit = Number(value.defaultDepositPercent ?? 30);
  if (!Number.isFinite(deposit) || deposit < 0 || deposit > 100) {
    errors.defaultDepositPercent = "defaultDepositPercent must be 0-100";
  }
  const fullDays = Number(value.fullPaymentDaysBefore ?? 14);
  if (!Number.isInteger(fullDays) || fullDays < 0 || fullDays > 365) {
    errors.fullPaymentDaysBefore = "fullPaymentDaysBefore must be 0-365";
  }
  const holdMinutes = Number(value.draftHoldMinutes ?? 60);
  if (!Number.isInteger(holdMinutes) || holdMinutes < 5 || holdMinutes > 1440) {
    errors.draftHoldMinutes = "draftHoldMinutes must be 5-1440";
  }
  if (
    value.paymentMethods !== undefined &&
    !Array.isArray(value.paymentMethods)
  ) {
    errors.paymentMethods = "paymentMethods must be an array";
  }
  if (value.termsText !== undefined && typeof value.termsText !== "string") {
    errors.termsText = "termsText must be a string";
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

/** Validate a numbering rule payload. */
export function validateNumberingRule(value: {
  doc?: unknown;
  prefix?: unknown;
  digits?: unknown;
  nextNo?: unknown;
  resetOn?: unknown;
}): ValidationResult {
  const errors: Record<string, string> = {};
  if (!NUMBERING_DOCS.includes(value.doc as string)) {
    errors.doc = `doc must be one of ${NUMBERING_DOCS.join(", ")}`;
  }
  if (
    typeof value.prefix !== "string" ||
    !/^[A-Z0-9]{2,6}$/.test(value.prefix)
  ) {
    errors.prefix = "prefix must be 2-6 uppercase alphanumerics";
  }
  const digits = Number(value.digits ?? 6);
  if (!Number.isInteger(digits) || digits < 3 || digits > 10) {
    errors.digits = "digits must be 3-10";
  }
  const nextNo = Number(value.nextNo ?? 1);
  if (!Number.isInteger(nextNo) || nextNo < 1) {
    errors.nextNo = "nextNo must be >= 1";
  }
  if (!RESET_ON.includes(value.resetOn as string)) {
    errors.resetOn = "resetOn must be never, year, or month";
  }
  return { valid: Object.keys(errors).length === 0, errors };
}
