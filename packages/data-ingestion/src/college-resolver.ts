/**
 * Shared college matching for MCC / Maharashtra imports and rebuild scripts.
 */
import { PrismaClient, DataStatus } from "@prisma/client";
import {
  displayCollegeName,
  displayCity,
  isGenericCollegeName,
  cityFromName,
  isGarbageCity,
} from "../../types/src/college-display.js";
import { inferCollegeTypeFromName } from "../../types/src/college-type.js";
import {
  extractInstituteCode,
  extractStateFromInstitute,
  normalizeCollegeName,
  slugify,
} from "./normalizers.js";
import { expandInstituteAbbrev, MAH_COLLEGE_MAP } from "./maharashtra-colleges.js";
import type { LocationHint } from "./processed-city-index.js";

export function instituteDisplayName(raw: string): string {
  const parts = raw.replace(/\(\d{5,7}\)\s*$/, "").split(",").map((p) => p.trim());
  const head =
    parts.length >= 2 && !/\d{5}/.test(parts[1]) && parts[1].length < 45
      ? `${parts[0]}, ${parts[1].replace(/\d+.*/, "").trim()}`
      : parts[0];
  return displayCollegeName(head);
}

export function extractCityFromInstitute(raw: string): string {
  const parts = raw.replace(/\(\d{5,7}\)\s*$/, "").split(",").map((p) => p.trim());
  if (parts.length >= 2 && parts[1].length < 40 && !/\d{5}/.test(parts[1])) {
    return displayCity(parts[1].replace(/\d+.*/, "").trim());
  }
  const { city } = extractStateFromInstitute(raw);
  return displayCity(city);
}

export function expandedNameForAbbrev(name: string, state: string, city?: string): string {
  const expanded = expandInstituteAbbrev(name, state);
  if (expanded !== name.replace(/\(\d{5,7}\)\s*$/, "").trim()) {
    return displayCollegeName(expanded);
  }
  return instituteDisplayName(name);
}

function displayNameWithCity(cleanName: string, city: string): string {
  if (!city || city === "Unknown") return cleanName;
  if (cleanName.toLowerCase().includes(city.toLowerCase())) return cleanName;
  if (isGenericCollegeName(cleanName)) return displayCollegeName(`${cleanName}, ${city}`);
  return cleanName;
}

function mahAbbrevSlugForCity(nameRoot: string, city: string, state: string): string | null {
  if (state !== "Maharashtra" || !isGenericCollegeName(nameRoot)) return null;
  const cityLower = city.toLowerCase();
  for (const [abbrev, info] of Object.entries(MAH_COLLEGE_MAP)) {
    if (
      info.city.toLowerCase() === cityLower &&
      info.name.toLowerCase() === nameRoot.toLowerCase()
    ) {
      return slugify(abbrev);
    }
  }
  return null;
}

export class CollegeResolver {
  private cache = new Map<string, string>();

  constructor(
    private prisma: PrismaClient,
    private locationIndex?: Map<string, LocationHint>
  ) {}

  clearCache() {
    this.cache.clear();
  }

  async resolveFromMccInstitute(name: string, _instituteNorm?: string): Promise<string> {
    const cacheKey = normalizeCollegeName(name);
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!;

    const instituteCode = extractInstituteCode(name);
    const cleanName = instituteDisplayName(name);
    const indexHint = this.locationIndex?.get(normalizeCollegeName(name))
      ?? this.locationIndex?.get(normalizeCollegeName(name.split(",")[0] ?? name));

    let city = extractCityFromInstitute(name);
    if (isGarbageCity(city) || city === "Unknown") {
      city =
        (indexHint?.city && !isGarbageCity(indexHint.city) ? indexHint.city : null) ??
        cityFromName(cleanName) ??
        cityFromName(name) ??
        "Unknown";
    }
    const state =
      indexHint?.state && indexHint.state !== "Unknown"
        ? indexHint.state
        : extractStateFromInstitute(name).state;
    const displayName = displayNameWithCity(cleanName, city);
    const nameRoot = cleanName.split(",")[0].trim();
    const slugBase = slugify(
      city && city !== "Unknown" ? `${nameRoot} ${city}` : displayName
    );
    const generic = isGenericCollegeName(nameRoot);

    if (instituteCode) {
      const byCode = await this.prisma.college.findFirst({
        where: { nmcId: instituteCode, NOT: { slug: { startsWith: "demo-" } } },
      });
      if (byCode) {
        await this.prisma.college.update({
          where: { id: byCode.id },
          data: {
            name: displayName,
            shortName: displayName.slice(0, 60),
            nmcId: instituteCode,
            city: city !== "Unknown" ? city : byCode.city,
          },
        });
        this.cache.set(cacheKey, byCode.id);
        return byCode.id;
      }
    }

    if (city && city !== "Unknown") {
      const abbrevSlug = mahAbbrevSlugForCity(nameRoot, city, state);
      if (abbrevSlug) {
        const byAbbrev = await this.prisma.college.findFirst({
          where: { slug: abbrevSlug, NOT: { slug: { startsWith: "demo-" } } },
        });
        if (byAbbrev) {
          await this.prisma.college.update({
            where: { id: byAbbrev.id },
            data: {
              name: displayName,
              shortName: displayName.slice(0, 60),
              city,
              ...(instituteCode ? { nmcId: instituteCode } : {}),
            },
          });
          this.cache.set(cacheKey, byAbbrev.id);
          return byAbbrev.id;
        }
      }

      const cityExisting = await this.prisma.college.findFirst({
        where: {
          NOT: { slug: { startsWith: "demo-" } },
          state,
          AND: [
            {
              OR: [
                { city: { equals: city } },
                { city: { contains: city.slice(0, Math.min(15, city.length)) } },
                { name: { contains: city } },
              ],
            },
            {
              OR: [
                { name: { contains: nameRoot.slice(0, 22) } },
                ...(generic && city
                  ? [
                      {
                        AND: [
                          { name: { contains: "Government Medical" } },
                          { name: { contains: city.slice(0, 12) } },
                        ],
                      },
                    ]
                  : []),
              ],
            },
          ],
        },
        orderBy: [{ dataStatus: "desc" }, { cutoffs: { _count: "desc" } }],
      });

      if (cityExisting) {
        await this.prisma.college.update({
          where: { id: cityExisting.id },
          data: {
            name: displayName,
            shortName: displayName.slice(0, 60),
            city,
            ...(instituteCode ? { nmcId: instituteCode } : {}),
          },
        });
        this.cache.set(cacheKey, cityExisting.id);
        return cityExisting.id;
      }
    }

    if (!generic) {
      const existing = await this.prisma.college.findFirst({
        where: {
          NOT: { slug: { startsWith: "demo-" } },
          OR: [
            ...(instituteCode ? [{ nmcId: instituteCode }] : []),
            { slug: slugBase },
            { name: displayName },
          ],
        },
        orderBy: [{ dataStatus: "desc" }, { cutoffs: { _count: "desc" } }],
      });

      if (existing) {
        await this.prisma.college.update({
          where: { id: existing.id },
          data: {
            name: displayName,
            shortName: displayName.slice(0, 60),
            ...(instituteCode ? { nmcId: instituteCode } : {}),
            ...(city !== "Unknown" && existing.city.length > 40 ? { city } : {}),
          },
        });
        this.cache.set(cacheKey, existing.id);
        return existing.id;
      }
    }

    let slug = slugBase;
    let n = 1;
    while (await this.prisma.college.findUnique({ where: { slug } })) {
      slug = `${slugBase}-${n++}`;
    }

    const created = await this.prisma.college.create({
      data: {
        name: displayName,
        shortName: displayName.slice(0, 60),
        slug,
        state,
        city: city !== "Unknown" ? city : "Unknown",
        collegeType: inferCollegeTypeFromName(name),
        nmcId: instituteCode,
        dataStatus: DataStatus.OFFICIAL,
      },
    });
    this.cache.set(cacheKey, created.id);
    return created.id;
  }

  async resolveFromMaharashtra(
    college: string,
    city: string,
    collegeNorm: string
  ): Promise<string> {
    const cacheKey = `mh:${collegeNorm}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!;

    const cleanName = displayCollegeName(
      city ? `${college.split(",")[0].trim()}, ${city}` : college.split(",")[0].trim()
    );
    const cleanCity = displayCity(city);
    const nameRoot = college.split(",")[0].trim();
    const slugCandidates = [
      collegeNorm,
      collegeNorm.replace(/-(mumbai|pune|nagpur|navi-mumbai|thane|aurangabad|sambhajinagar|gondia|latur|nashik|kolhapur|solapur|amravati|jalgaon|dhule|chandrapur|nanded|wardha|loni|karad|miraj|ratnagiri|palghar|pimpri|yavatmal|osmanabad|akola|ambajogai|sangli|satara|beed|buldhana|washim|hingoli|parbhani|jalna|usmanabad)$/i, ""),
      slugify(cleanName),
      ...(cleanCity
        ? [mahAbbrevSlugForCity(nameRoot, cleanCity, "Maharashtra")].filter(Boolean)
        : []),
    ].filter(Boolean) as string[];

    const existing = await this.prisma.college.findFirst({
      where: {
        state: "Maharashtra",
        NOT: { slug: { startsWith: "demo-" } },
        OR: [
          ...slugCandidates.map((slug) => ({ slug })),
          { name: cleanName },
          {
            AND: [
              { city: { contains: cleanCity.slice(0, 12) } },
              { name: { contains: college.slice(0, 22) } },
            ],
          },
        ],
      },
      orderBy: { dataStatus: "desc" },
    });

    if (existing) {
      await this.prisma.college.update({
        where: { id: existing.id },
        data: {
          name: cleanName,
          shortName: cleanName.slice(0, 60),
          city: cleanCity.length < 45 ? cleanCity : existing.city,
        },
      });
      this.cache.set(cacheKey, existing.id);
      return existing.id;
    }

    let slug = slugify(cleanName);
    let n = 1;
    const slugBase = slug;
    while (await this.prisma.college.findUnique({ where: { slug } })) {
      slug = `${slugBase}-${n++}`;
    }

    const created = await this.prisma.college.create({
      data: {
        name: cleanName,
        shortName: cleanName.slice(0, 60),
        slug,
        state: "Maharashtra",
        city: cleanCity,
        collegeType: inferCollegeTypeFromName(cleanName),
        dataStatus: DataStatus.OFFICIAL,
      },
    });
    this.cache.set(cacheKey, created.id);
    return created.id;
  }
}
