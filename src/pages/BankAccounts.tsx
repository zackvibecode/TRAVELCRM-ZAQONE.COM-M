import { useState } from "react";
import { Banknote, Check, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { useLang } from "@/lib/i18n";

interface BankAccount {
  id: string;
  bankName: string;
  accountNo: string;
  holder: string;
  isDefault: boolean;
}

// Mock data — backend bank account API menyusul pada fasa backend.
const STUB_ACCOUNTS: BankAccount[] = [
  { id: "ba_01", bankName: "Maybank Islamic Berhad", accountNo: "1234 5678 9012", holder: "ZAQONE TRAVEL & TOURS SDN BHD", isDefault: true },
  { id: "ba_02", bankName: "CIMB Bank Berhad", accountNo: "8001 2345 6789", holder: "ZAQONE TRAVEL & TOURS SDN BHD", isDefault: false },
  { id: "ba_03", bankName: "Hong Leong Islamic Bank", accountNo: "4567 8901 2345", holder: "ZAQONE TRAVEL & TOURS SDN BHD", isDefault: false },
];

const EMPTY: Omit<BankAccount, "id"> = {
  bankName: "",
  accountNo: "",
  holder: "",
  isDefault: false,
};

const panelStyle: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-panel)",
};

const inputCls =
  "h-[37px] w-full rounded-[var(--radius-control)] border border-[var(--color-border-strong)] px-[11px] text-[13.5px] text-[var(--color-text)] bg-[var(--color-surface)] outline-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:-outline-offset-1";

const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-control)] px-3.5 py-2 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55";

const btnSecondary: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
};

const btnPrimary: React.CSSProperties = {
  border: "1px solid var(--color-primary)",
  background: "var(--color-primary)",
  color: "var(--color-on-primary)",
};

export default function BankAccounts() {
  const { t } = useLang();
  const [accounts, setAccounts] = useState<BankAccount[]>(STUB_ACCOUNTS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState<BankAccount | null>(null);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY);
    setDialogOpen(true);
  };

  const openEdit = (a: BankAccount) => {
    setEditingId(a.id);
    setForm({ bankName: a.bankName, accountNo: a.accountNo, holder: a.holder, isDefault: a.isDefault });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (editingId) {
      setAccounts((prev) =>
        prev.map((a) => (a.id === editingId ? { ...a, ...form } : a)),
      );
    } else {
      setAccounts((prev) => [
        ...prev,
        { id: `ba_${Date.now()}`, ...form },
      ]);
    }
    if (form.isDefault) {
      const savedId = editingId ?? `ba_${Date.now()}`;
      setAccounts((prev) =>
        prev.map((a) => ({ ...a, isDefault: a.id === savedId })),
      );
    }
    setDialogOpen(false);
  };

  const setDefault = (id: string) =>
    setAccounts((prev) => prev.map((a) => ({ ...a, isDefault: a.id === id })));

  const handleDelete = () => {
    if (!deleteTarget) return;
    setAccounts((prev) => prev.filter((a) => a.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const field = (key: keyof Omit<BankAccount, "id" | "isDefault">, labelMs: string, labelEn: string, placeholder: string, mono?: boolean) => (
    <div className="flex flex-col gap-1.5 min-w-0">
      <label htmlFor={`ba-${key}`} className="text-[12.5px] font-medium text-[var(--color-text-secondary)]">
        {t(labelMs, labelEn)}
      </label>
      <input
        id={`ba-${key}`}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        placeholder={placeholder}
        className={`${inputCls} ${mono ? "font-[var(--font-mono)] tabular-nums" : ""}`}
      />
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5">
      {/* Page head */}
      <div className="tvl-pagehead">
        <div style={{ minWidth: 0 }}>
          <h1 className="tvl-title">{t("Akaun Bank", "Bank Accounts")}</h1>
          <p className="tvl-subtitle">
            {t(
              "Urus akaun untuk pembayaran dan invois pelanggan.",
              "Manage accounts used for customer payments and invoices.",
            )}
          </p>
        </div>
        <button type="button" onClick={openAdd} className={btnBase} style={btnPrimary}>
          <Plus size={15} />
          {t("Tambah Akaun", "Add Account")}
        </button>
      </div>

      {/* Accounts list */}
      <div className="flex flex-col gap-3">
        {accounts.map((a) => (
          <section key={a.id} style={panelStyle} className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="flex items-center gap-3 min-w-0">
              <div
                aria-hidden="true"
                className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px]"
                style={{ background: "var(--color-primary-soft)", color: "var(--color-primary)" }}
              >
                <Banknote size={16} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13.5px] font-semibold text-[var(--color-text)]">{a.bankName}</span>
                  {a.isDefault && (
                    <span
                      className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2 py-0.5 text-[11.5px] font-semibold"
                      style={{ background: "var(--color-success-soft)", color: "var(--color-success)" }}
                    >
                      <Star size={11} className="fill-current" />
                      {t("Lalai", "Default")}
                    </span>
                  )}
                </div>
                <p className="m-0 mt-0.5 font-[var(--font-mono)] text-[12.5px] tabular-nums text-[var(--color-text-secondary)]">{a.accountNo}</p>
                <p className="m-0 mt-0.5 text-[12px] text-[var(--color-text-muted)]">{a.holder}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!a.isDefault && (
                <button
                  type="button"
                  onClick={() => setDefault(a.id)}
                  className={btnBase}
                  style={btnSecondary}
                >
                  <Check size={14} />
                  {t("Jadikan Lalai", "Set Default")}
                </button>
              )}
              <button
                type="button"
                onClick={() => openEdit(a)}
                className={btnBase}
                style={btnSecondary}
              >
                <Pencil size={14} />
                {t("Edit", "Edit")}
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(a)}
                className={btnBase}
                style={{ border: "1px solid color-mix(in srgb, var(--color-danger) 35%, var(--color-border))", background: "var(--color-surface)", color: "var(--color-danger)" }}
              >
                <Trash2 size={14} />
                {t("Padam", "Delete")}
              </button>
            </div>
          </section>
        ))}
      </div>

      <p className="m-0 text-[11.5px] text-[var(--color-text-muted)]">
        {t(
          "Data olok-olok — akaun bank sebenar akan didayakan pada fasa backend.",
          "Mock data — real bank accounts will be enabled in the backend phase.",
        )}
      </p>

      {/* Add / edit dialog */}
      {dialogOpen ? (
        <div
          className="fixed inset-0 z-[70] grid place-items-center p-4"
          style={{ background: "color-mix(in srgb, var(--color-text) 45%, transparent)" }}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ba-dialog-title"
            className="flex w-full max-w-[460px] flex-col overflow-hidden"
            style={{ ...panelStyle, boxShadow: "0 24px 60px color-mix(in srgb, var(--color-text) 28%, transparent)" }}
          >
            <div className="flex items-start justify-between gap-3 px-5 py-5">
              <div className="min-w-0">
                <h2 id="ba-dialog-title" className="m-0 font-[var(--font-display)] text-[16px] font-bold text-[var(--color-text)]">
                  {editingId
                    ? t("Edit Akaun Bank", "Edit Bank Account")
                    : t("Tambah Akaun Bank", "Add Bank Account")}
                </h2>
                <p className="m-0 mt-1 text-[12.5px] text-[var(--color-text-muted)]">
                  {t("Maklumat akaun akan dipaparkan pada invois pelanggan.", "Account details will appear on customer invoices.")}
                </p>
              </div>
              <button
                type="button"
                aria-label={t("Tutup", "Close")}
                onClick={() => setDialogOpen(false)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-[6px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-muted)]"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-col gap-4 px-5 pb-5">
              {field("bankName", "Nama Bank", "Bank Name", "Maybank Islamic Berhad")}
              {field("accountNo", "No. Akaun", "Account Number", "1234 5678 9012", true)}
              {field("holder", "Nama Pemegang", "Account Holder", "ZAQONE TRAVEL & TOURS SDN BHD")}
              <label className="flex items-center gap-2 text-[13px] text-[var(--color-text)]">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                  className="h-4 w-4 rounded-[4px]"
                  style={{ accentColor: "var(--color-primary)" }}
                />
                {t("Jadikan akaun lalai", "Set as default account")}
              </label>
            </div>
            <div
              className="flex flex-wrap justify-end gap-2 px-5 py-4"
              style={{ borderTop: "1px solid var(--color-border)", background: "var(--color-surface-raised)" }}
            >
              <button type="button" onClick={() => setDialogOpen(false)} className={btnBase} style={btnSecondary}>
                {t("Batal", "Cancel")}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!form.bankName.trim() || !form.accountNo.trim()}
                className={btnBase}
                style={btnPrimary}
              >
                <Check size={14} />
                {t("Simpan", "Save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Delete confirmation */}
      {deleteTarget ? (
        <div
          className="fixed inset-0 z-[70] grid place-items-center p-4"
          style={{ background: "color-mix(in srgb, var(--color-text) 45%, transparent)" }}
          role="presentation"
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="ba-delete-title"
            className="flex w-full max-w-[400px] flex-col overflow-hidden"
            style={{ ...panelStyle, boxShadow: "0 24px 60px color-mix(in srgb, var(--color-text) 28%, transparent)" }}
          >
            <div className="px-5 py-5">
              <h2 id="ba-delete-title" className="m-0 font-[var(--font-display)] text-[16px] font-bold text-[var(--color-text)]">
                {t("Padam Akaun Bank?", "Delete Bank Account?")}
              </h2>
              <p className="m-0 mt-1 text-[12.5px] text-[var(--color-text-muted)]">
                {deleteTarget.bankName} · <span className="font-[var(--font-mono)] tabular-nums">{deleteTarget.accountNo}</span>
              </p>
            </div>
            <div
              className="flex flex-wrap justify-end gap-2 px-5 py-4"
              style={{ borderTop: "1px solid var(--color-border)", background: "var(--color-surface-raised)" }}
            >
              <button type="button" onClick={() => setDeleteTarget(null)} className={btnBase} style={btnSecondary}>
                {t("Batal", "Cancel")}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className={btnBase}
                style={{ border: "1px solid var(--color-danger)", background: "var(--color-danger)", color: "var(--color-surface)" }}
              >
                <Trash2 size={14} />
                {t("Padam", "Delete")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
