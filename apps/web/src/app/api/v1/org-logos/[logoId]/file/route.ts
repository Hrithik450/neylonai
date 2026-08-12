import { NextRequest, NextResponse } from "next/server";
import { resolveOrgLogoFile } from "@/server/org-logos";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ logoId: string }> },
) {
  try {
    const { logoId } = await params;
    if (!logoId?.trim()) {
      return NextResponse.json(
        { success: false, error: "Invalid logo id" },
        { status: 400 },
      );
    }

    const file = await resolveOrgLogoFile(logoId.trim());
    if (!file) {
      return NextResponse.json(
        { success: false, error: "Logo not found" },
        { status: 404 },
      );
    }

    if (file.kind === "redirect") {
      return NextResponse.redirect(file.url, {
        status: 302,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    return new NextResponse(new Uint8Array(file.bytes), {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Server error",
      },
      { status: 500 },
    );
  }
}
