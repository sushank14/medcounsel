/** Browser backup so choice lists survive server DB resets (e.g. Render redeploys). */

const STORAGE_KEY = "medcounsel.choice-list.v1";

export type ChoiceListBackupItem = {
  collegeId: string;
  specialtyId: string;
  sortOrder: number;
  fitSnapshot?: string;
};

type ChoiceListBackup = {
  v: 1;
  userId: string;
  updatedAt: string;
  items: ChoiceListBackupItem[];
};

export function saveChoiceListBackup(userId: string, items: ChoiceListBackupItem[]) {
  if (typeof window === "undefined" || !userId) return;
  const payload: ChoiceListBackup = {
    v: 1,
    userId,
    updatedAt: new Date().toISOString(),
    items: items.map((item, index) => ({
      collegeId: item.collegeId,
      specialtyId: item.specialtyId,
      sortOrder: item.sortOrder ?? index + 1,
      fitSnapshot: item.fitSnapshot,
    })),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // quota / private mode — ignore
  }
}

export function loadChoiceListBackup(userId: string): ChoiceListBackupItem[] | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChoiceListBackup;
    if (parsed.v !== 1 || parsed.userId !== userId || !Array.isArray(parsed.items)) return null;
    return parsed.items.length ? parsed.items : null;
  } catch {
    return null;
  }
}

/** Pull latest list from API and refresh the browser backup. */
export async function syncChoiceListBackupFromServer() {
  const res = await fetch("/api/preferences");
  if (!res.ok) return;
  const data = (await res.json()) as {
    userId?: string;
    list?: { items: { collegeId: string; specialtyId: string; sortOrder: number; fitSnapshot?: string }[] };
  };
  if (!data.userId || !data.list) return;
  saveChoiceListBackup(
    data.userId,
    data.list.items.map((item) => ({
      collegeId: item.collegeId,
      specialtyId: item.specialtyId,
      sortOrder: item.sortOrder,
      fitSnapshot: item.fitSnapshot,
    }))
  );
}
