import { PrismaClient, Degree, SpecialtyCategory } from "@prisma/client";

const SPECIALTIES: {
  name: string;
  slug: string;
  degree: Degree;
  category: SpecialtyCategory;
}[] = [
  { name: "General Medicine", slug: "md-general-medicine", degree: "MD", category: "CLINICAL" },
  { name: "Pediatrics", slug: "md-pediatrics", degree: "MD", category: "CLINICAL" },
  { name: "Radiodiagnosis", slug: "md-radiodiagnosis", degree: "MD", category: "CLINICAL" },
  { name: "Dermatology", slug: "md-dermatology", degree: "MD", category: "CLINICAL" },
  { name: "Psychiatry", slug: "md-psychiatry", degree: "MD", category: "CLINICAL" },
  { name: "Anaesthesiology", slug: "md-anaesthesiology", degree: "MD", category: "CLINICAL" },
  { name: "Pathology", slug: "md-pathology", degree: "MD", category: "NON_CLINICAL" },
  { name: "General Surgery", slug: "ms-general-surgery", degree: "MS", category: "CLINICAL" },
  { name: "Orthopedics", slug: "ms-orthopedics", degree: "MS", category: "CLINICAL" },
  { name: "Obstetrics & Gynecology", slug: "ms-obg", degree: "MS", category: "CLINICAL" },
  { name: "Ophthalmology", slug: "ms-ophthalmology", degree: "MS", category: "CLINICAL" },
  { name: "ENT", slug: "ms-ent", degree: "MS", category: "CLINICAL" },
  { name: "Emergency Medicine", slug: "md-emergency-medicine", degree: "MD", category: "CLINICAL" },
  { name: "Radiotherapy", slug: "md-radiotherapy", degree: "MD", category: "CLINICAL" },
];

export async function seedSpecialties(prisma: PrismaClient) {
  const created = [];
  for (const s of SPECIALTIES) {
    const spec = await prisma.specialty.upsert({
      where: { slug: s.slug },
      update: {},
      create: { ...s, durationYears: 3 },
    });
    created.push(spec);
  }
  console.log(`  ${created.length} specialties`);
  return created;
}
