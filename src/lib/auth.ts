// Mock auth (frontend-only). Backend Better Auth akan menggantikan ini
// pada task backend Staff Access — API contract kekal sama.
export type StaffRole =
  | "super_admin"
  | "management"
  | "sales"
  | "finance"
  | "operations";

export interface StaffSession {
  userId: string;
  name: string;
  email: string;
  role: StaffRole;
}

const SESSION_KEY = "zaqone_staff_session";

// Akaun demo — backend sebenar akan mengesahkan melalui Better Auth nanti.
const DEMO_ACCOUNTS: (StaffSession & { password: string })[] = [
  { userId: "usr_owner", name: "Zack (Owner)", email: "owner@zaqone.travel", role: "super_admin", password: "demo1234" },
  { userId: "usr_mgr", name: "Farah (Management)", email: "manager@zaqone.travel", role: "management", password: "demo1234" },
  { userId: "usr_sales", name: "Adib (Sales)", email: "sales@zaqone.travel", role: "sales", password: "demo1234" },
  { userId: "usr_fin", name: "Melati (Finance)", email: "finance@zaqone.travel", role: "finance", password: "demo1234" },
  { userId: "usr_ops", name: "Imran (Operations)", email: "ops@zaqone.travel", role: "operations", password: "demo1234" },
];

export function listDemoAccounts(): Pick<StaffSession, "name" | "email" | "role">[] {
  return DEMO_ACCOUNTS.map(({ name, email, role }) => ({ name, email, role }));
}

export function loginMock(email: string, password: string): StaffSession | null {
  const normalized = email.trim().toLowerCase();
  const account = DEMO_ACCOUNTS.find(
    (a) => a.email === normalized && a.password === password,
  );
  if (!account) return null;

  const session: StaffSession = {
    userId: account.userId,
    name: account.name,
    email: account.email,
    role: account.role,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function getSession(): StaffSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StaffSession) : null;
  } catch {
    return null;
  }
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
}
