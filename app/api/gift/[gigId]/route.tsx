import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { isUUID } from "@/lib/validation";
import { getGiftData } from "@/lib/gift-data";
import { GiftDocument } from "@/components/gift-pdf";
import { renderToBuffer } from "@react-pdf/renderer";

// NOTE: Single-performer assumption. Multi-performer requires JWT identity
// binding + gig ownership check (tracked as future work).

function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[^\w\s\-().]/g, "")
    .replace(/\s+/g, "-")
    .replace(/^[.\-]+|[.\-]+$/g, "")
    .trim()
    .slice(0, 80);
  return cleaned || "venue";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gigId: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { gigId } = await params;
  if (!isUUID(gigId)) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  const data = await getGiftData(gigId);
  if (!data) {
    return NextResponse.json({ error: "Gig not found" }, { status: 404 });
  }

  let buffer: Buffer;
  try {
    buffer = await renderToBuffer(<GiftDocument data={data} />);
  } catch (err) {
    console.error("PDF generation failed:", err);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }

  const safeName = sanitizeFilename(data.gig.venue_name);
  const filename = `pacific-flow-${safeName}-${data.gig.gig_date}.pdf`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
