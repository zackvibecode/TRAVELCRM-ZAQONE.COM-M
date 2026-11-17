import { useState } from "react";
import { Banknote, Check, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

  const fieldCls =
    "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {t("Akaun Bank", "Bank Accounts")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "Urus akaun untuk pembayaran dan invois pelanggan.",
              "Manage accounts used for customer payments and invoices.",
            )}
          </p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          {t("Tambah Akaun", "Add Account")}
        </button>
      </div>

      {/* Accounts list */}
      <div className="space-y-3">
        {accounts.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Banknote className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{a.bankName}</span>
                  {a.isDefault && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      <Star className="h-3 w-3 fill-current" />
                      {t("Lalai", "Default")}
                    </span>
                  )}
                </div>
                <p className="font-mono text-xs text-muted-foreground">{a.accountNo}</p>
                <p className="text-xs text-muted-foreground">{a.holder}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!a.isDefault && (
                <button
                  onClick={() => setDefault(a.id)}
                  className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted/50"
                >
                  <Check className="h-3.5 w-3.5" />
                  {t("Jadikan Lalai", "Set Default")}
                </button>
              )}
              <button
                onClick={() => openEdit(a)}
                className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted/50"
              >
                <Pencil className="h-3.5 w-3.5" />
                {t("Edit", "Edit")}
              </button>
              <button
                onClick={() => setDeleteTarget(a)}
                className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("Padam", "Delete")}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId
                ? t("Edit Akaun Bank", "Edit Bank Account")
                : t("Tambah Akaun Bank", "Add Bank Account")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "Maklumat akaun akan dipaparkan pada invois pelanggan.",
                "Account details will appear on customer invoices.",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("Nama Bank", "Bank Name")}</label>
              <input
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                placeholder="Maybank Islamic Berhad"
                className={fieldCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("No. Akaun", "Account Number")}</label>
              <input
                value={form.accountNo}
                onChange={(e) => setForm({ ...form, accountNo: e.target.value })}
                placeholder="1234 5678 9012"
                className={cn(fieldCls, "font-mono")}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("Nama Pemegang", "Account Holder")}</label>
              <input
                value={form.holder}
                onChange={(e) => setForm({ ...form, holder: e.target.value })}
                placeholder="ZAQONE TRAVEL & TOURS SDN BHD"
                className={fieldCls}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                className="h-4 w-4 rounded border-input"
              />
              {t("Jadikan akaun lalai", "Set as default account")}
            </label>
          </div>
          <DialogFooter>
            <button
              onClick={() => setDialogOpen(false)}
              className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted/50"
            >
              {t("Batal", "Cancel")}
            </button>
            <button
              onClick={handleSave}
              disabled={!form.bankName.trim() || !form.accountNo.trim()}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {t("Simpan", "Save")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("Padam Akaun Bank?", "Delete Bank Account?")}</DialogTitle>
            <DialogDescription>
              {deleteTarget?.bankName} · {deleteTarget?.accountNo}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setDeleteTarget(null)}
              className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted/50"
            >
              {t("Batal", "Cancel")}
            </button>
            <button
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4" />
              {t("Padam", "Delete")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="text-xs text-muted-foreground">
        {t(
          "Data olok-olok — akaun bank sebenar akan didayakan pada fasa backend.",
          "Mock data — real bank accounts will be enabled in the backend phase.",
        )}
      </p>
    </div>
  );
}
