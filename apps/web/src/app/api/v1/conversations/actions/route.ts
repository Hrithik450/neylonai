import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth-cookies";
import { getOrganizationForUser } from "@neylonai/domain/billing";
import { postHumanReply } from "@neylonai/domain/conversations";

const requireOrg = async (req: NextRequest) => {
  const session = await getSessionFromRequest(req);
  if (!session) return { error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  const org = await getOrganizationForUser(session.id);
  if (!org) return { error: NextResponse.json({ success: false, error: "No organization" }, { status: 403 }) };
  return { org, session };
};

type ActionBody = {
  threadId?: string;
  action?: "reply";
  content?: string;
};

export async function POST(req: NextRequest) {
  try {
    const gate = await requireOrg(req);
    if ("error" in gate) return gate.error;

    const body = (await req.json()) as ActionBody;
    const threadId = body.threadId?.trim();
    const action = body.action;

    if (!threadId || !action) {
      return NextResponse.json({ success: false, error: "threadId and action are required" }, { status: 400 });
    }

    if (action !== "reply") {
      return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
    }

    const result = await postHumanReply({
      organizationId: gate.org.organizationId,
      threadId,
      content: body.content ?? "",
      actorId: gate.session.id,
      actorEmail: gate.session.email ?? null,
      actorName: gate.session.email ?? null,
    });

    return NextResponse.json({
      success: true,
      data: {
        escalated: result.escalated,
        message: {
          id: result.message.id,
          role: "human" as const,
          content: result.message.content,
          created_at: result.message.created_at,
        },
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Conversation action failed" }, { status: 500 });
  }
}
