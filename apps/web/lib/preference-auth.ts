import { prisma } from "@medcounsel/database";

export async function assertPreferenceItemOwner(itemId: string, userId: string) {
  const item = await prisma.preferenceItem.findUnique({
    where: { id: itemId },
    include: { list: true },
  });
  if (!item || item.list.userId !== userId) return null;
  return item;
}
