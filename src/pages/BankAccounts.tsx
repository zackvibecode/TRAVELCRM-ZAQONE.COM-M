import { useState } from "react";
import { Banknote, Check, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { Dialog, EmptyState } from "@/components/Ui";

interface BankAccount {
  id: string;
  bankName: string;
  accountNo: string;
  holder: string;
  isDefault: boolean;
}

// Empty until the backend bank account API is wired up.
const INITIAL_ACCOUNTS: BankAccount[] = [];

const EMPTY: Omit<BankAccount, "id"> = {
  bankName: "",
  accountNo: "",
  holder: "",
  isDefault: false,
};

export default function BankAccounts() {
  const { t } = useLang();
  const [accounts, setAccounts] = useState<BankAccount[]>(INITIAL_ACCOUNTS);
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
      const newId = `ba_${Date.now()}`;
      setAccounts((prev) => [...prev, { id: newId, ...form }]);
      if (form.isDefault) {
        setAccounts((prev) => prev.map((a) => ({ ...a, isDefault: a.id === newId })));
      }
    }
    if (editingId && form.isDefault) {
      setAccounts((prev) => prev.map((a) => ({ ...a, isDefault: a.id === editingId })));
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

  const field = (
    key: keyof Omit<BankAccount, "id" | "isDefault">,
    labelMs: string,
    labelEn: string,
    placeholder: string,
    mono?: boolean,
  ) => (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={`ba-${key}`} className="tv-label">
        {t(labelMs, labelEn)}
      </label>
      <input
        id={`ba-${key}`}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        placeholder={placeholder}
        className={`tv-input ${mono ? "font-[var(--font-mono)] tabular-nums" : ""}`}
      />
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5">
      {/* Page head */}
      <div className="tvl-pagehead">
        <div className="min-w-0">
          <h1 className="tvl-title">{t("Akaun Bank", "Bank Accounts")}</h1>
          <p className="tvl-subtitle">
            {t(
              "Urus akaun untuk pembayaran dan invois pelanggan.",
              "Manage accounts used for customer payments and invoices.",
            )}
          </p>
        </div>
        <button type="button" onClick={openAdd} className="tv-btn tv-btn--primary">
          <Plus size={15} aria-hidden="true" />
          {t("Tambah Akaun", "Add Account")}
        </button>
      </div>

      {/* Accounts list */}
      {accounts.length === 0 ? (
        <EmptyState
          icon={Banknote}
          title={t("Belum ada akaun bank", "No bank accounts yet")}
          description={t(
            "Tambah akaun untuk paparkan butiran pembayaran pada invois dan sebut harga pelanggan.",
            "Add an account to show payment details on customer invoices and quotations.",
          )}
          action={
            <button type="button" onClick={openAdd} className="tv-btn tv-btn--primary">
              <Plus size={15} aria-hidden="true" />
              {t("Tambah Akaun", "Add Account")}
            </button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {accounts.map((a) => (
            <section key={a.id} className="tv-panel flex flex-wrap items-center justify-between gap-3 p-5">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  aria-hidden="true"
                  className="tv-icon-tile bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                >
                  <Banknote size={16} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13.5px] font-semibold text-[var(--color-text)]">{a.bankName}</span>
                    {a.isDefault ? (
                      <span className="tv-pill bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                        <Star size={11} className="fill-current" aria-hidden="true" />
                        {t("Lalai", "Default")}
                      </span>
                    ) : null}
                  </div>
                  <p className="m-0 mt-0.5 font-[var(--font-mono)] text-[12.5px] tabular-nums text-[var(--color-text-secondary)]">
                    {a.accountNo}
                  </p>
                  <p className="m-0 mt-0.5 text-[12px] text-[var(--color-text-muted)]">{a.holder}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!a.isDefault ? (
                  <button type="button" onClick={() => setDefault(a.id)} className="tv-btn tv-btn--secondary">
                    <Check size={14} aria-hidden="true" />
                    {t("Jadikan Lalai", "Set Default")}
                  </button>
                ) : null}
                <button type="button" onClick={() => openEdit(a)} className="tv-btn tv-btn--secondary">
                  <Pencil size={14} aria-hidden="true" />
                  {t("Edit", "Edit")}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(a)}
                  className="tv-btn tv-btn--ghost-danger"
                >
                  <Trash2 size={14} aria-hidden="true" />
                  {t("Padam", "Delete")}
                </button>
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Add / edit dialog */}
      {dialogOpen ? (
        <Dialog
          title={
            editingId
              ? t("Edit Akaun Bank", "Edit Bank Account")
              : t("Tambah Akaun Bank", "Add Bank Account")
          }
          description={t(
            "Maklumat akaun akan dipaparkan pada invois pelanggan.",
            "Account details will appear on customer invoices.",
          )}
          onClose={() => setDialogOpen(false)}
          footer={
            <>
              <button type="button" onClick={() => setDialogOpen(false)} className="tv-btn tv-btn--secondary">
                {t("Batal", "Cancel")}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!form.bankName.trim() || !form.accountNo.trim()}
                className="tv-btn tv-btn--primary"
              >
                <Check size={14} aria-hidden="true" />
                {t("Simpan", "Save")}
              </button>
            </>
          }
        >
          {field("bankName", "Nama Bank", "Bank Name", "Maybank Islamic Berhad")}
          {field("accountNo", "No. Akaun", "Account Number", "1234 5678 9012", true)}
          {field("holder", "Nama Pemegang", "Account Holder", "ZAQONE TRAVEL & TOURS SDN BHD")}
          <label className="flex items-center gap-2 text-[13px] text-[var(--color-text)]">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              className="h-4 w-4 rounded-[4px] accent-[var(--color-primary)]"
            />
            {t("Jadikan akaun lalai", "Set as default account")}
          </label>
        </Dialog>
      ) : null}

      {/* Delete confirmation */}
      {deleteTarget ? (
        <Dialog
          role="alertdialog"
          title={t("Padam Akaun Bank?", "Delete Bank Account?")}
          description={`${deleteTarget.bankName} · ${deleteTarget.accountNo}`}
          onClose={() => setDeleteTarget(null)}
          maxWidth={400}
          footer={
            <>
              <button type="button" onClick={() => setDeleteTarget(null)} className="tv-btn tv-btn--secondary">
                {t("Batal", "Cancel")}
              </button>
              <button type="button" onClick={handleDelete} className="tv-btn tv-btn--danger">
                <Trash2 size={14} aria-hidden="true" />
                {t("Padam", "Delete")}
              </button>
            </>
          }
        />
      ) : null}
    </div>
  );
}
