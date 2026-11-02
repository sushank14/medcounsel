import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/auth-access";
import { prisma } from "@medcounsel/database";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!canAccessAdmin(user?.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_WEB_IMPORT !== "true" &&
    process.env.ALLOW_WEB_IMPORT !== "1"
  ) {
    return NextResponse.json(
      {
        error:
          "Web-triggered imports are disabled in production. Run ingestion locally or set ALLOW_WEB_IMPORT=true (not recommended on Render).",
      },
      { status: 403 }
    );
  }

  const body = await req.json();
  const pipeline = body.pipeline as string;

  const allowed = ["mcc", "maharashtra", "neetpg-colleges", "fees"];
  if (!allowed.includes(pipeline)) {
    return NextResponse.json({ error: "Invalid pipeline" }, { status: 400 });
  }

  const scripts: Record<string, string> = {
    mcc: "npm run import:mcc",
    maharashtra: "npm run import:maharashtra",
    "neetpg-colleges": "npm run import:neetpg-all",
    fees: "npm run import:fees",
  };

  const record = await prisma.dataImport.create({
    data: {
      adminUserId: session.user.id,
      format: "MANUAL",
      status: "PENDING",
      rawData: JSON.stringify({ pipeline, triggeredAt: new Date().toISOString() }),
    },
  });

  const root = path.resolve(process.cwd(), "../..");

  try {
    const { stdout, stderr } = await execAsync(scripts[pipeline], {
      cwd: root,
      timeout: 300000,
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    });

    await prisma.dataImport.update({
      where: { id: record.id },
      data: {
        status: "VERIFIED",
        normalizedData: JSON.stringify({ stdout: stdout.slice(-2000), stderr: stderr.slice(-500) }),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entity: "DataImport",
        entityId: record.id,
        action: `RUN_${pipeline.toUpperCase()}`,
        newValue: pipeline,
      },
    });

    return NextResponse.json({ success: true, importId: record.id, message: "Import completed" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    await prisma.dataImport.update({
      where: { id: record.id },
      data: { status: "REJECTED", errors: JSON.stringify({ message }) },
    });
    return NextResponse.json({ error: message, importId: record.id }, { status: 500 });
  }
}
