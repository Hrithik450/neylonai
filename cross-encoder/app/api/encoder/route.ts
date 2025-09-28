import { EncoderService } from "@/actions/encoder.service";
import { EncoderRequest } from "@/actions/encoder.types";
import { NextResponse } from "next/server";
import { withCors } from "@/lib/cors";

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function POST(request: Request) {
  try {
    const data: EncoderRequest = await request.json();
    const response = await EncoderService.encode(data);

    if (!response.success) {
      return withCors(
        NextResponse.json({ error: response.error }, { status: 400 })
      );
    }

    return withCors(NextResponse.json(response.data, { status: 201 }));
  } catch (error) {
    return withCors(
      NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to get the ranking for pairs",
        },
        { status: 500 }
      )
    );
  }
}
