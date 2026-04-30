export type WaitlistEntry = {
  id: string;
  full_name: string;
  email: string;
  referral_code: string;
  referred_by_code: string | null;
  status: string;
  created_at: string;
};

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const SUPABASE_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ||
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim();
const TABLE = "waitlist_entries";

const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);

export const waitlistConfigIssue = (): string => {
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push("VITE_SUPABASE_URL");
  if (!SUPABASE_KEY) missing.push("VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY");
  return missing.length ? `Missing ${missing.join(", ")}.` : "";
};

const headers = () => ({
  apikey: SUPABASE_KEY ?? "",
  Authorization: `Bearer ${SUPABASE_KEY ?? ""}`,
  "Content-Type": "application/json",
});

const tableUrl = () => `${SUPABASE_URL}/rest/v1/${TABLE}`;

export const waitlistEnabled = () => hasSupabase;

export const generateReferralCode = (email: string): string => {
  const prefix = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase() || "DAO";
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}${suffix}`;
};

export const joinWaitlist = async (params: {
  fullName: string;
  email: string;
  referredByCode?: string;
}): Promise<WaitlistEntry> => {
  if (!hasSupabase) throw new Error(`Waitlist backend is not configured. ${waitlistConfigIssue()}`);

  const fullName = params.fullName.trim();
  const email = params.email.trim().toLowerCase();
  const referredByCode = params.referredByCode?.trim().toUpperCase() || null;
  const referralCode = generateReferralCode(email);

  const payload = [{
    full_name: fullName,
    email,
    referral_code: referralCode,
    referred_by_code: referredByCode,
    status: "pending",
  }];

  const response = await fetch(tableUrl(), {
    method: "POST",
    headers: {
      ...headers(),
      Prefer: "return=representation,resolution=merge-duplicates",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Waitlist join failed: ${text || response.statusText}`);
  }

  const rows = (await response.json()) as WaitlistEntry[];
  const row = rows[0];
  if (!row) throw new Error("Waitlist join failed: empty response.");
  return row;
};

export const fetchWaitlist = async (limit = 50): Promise<WaitlistEntry[]> => {
  if (!hasSupabase) return [];

  const query = new URLSearchParams({
    select: "id,full_name,email,referral_code,referred_by_code,status,created_at",
    order: "created_at.desc",
    limit: String(limit),
  });
  const response = await fetch(`${tableUrl()}?${query.toString()}`, {
    method: "GET",
    headers: headers(),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch waitlist: ${text || response.statusText}`);
  }
  return (await response.json()) as WaitlistEntry[];
};
