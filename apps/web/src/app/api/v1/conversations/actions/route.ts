import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth-cookies";
import { getOrganizationForUser } from "@neylonai/domain/billing";
import {
  postHumanReply,
  resolveConversation,
  returnToAi,
} from "@neylonai/domain/conversations";

async function requireOrg(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session)
    return {
      error: NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      ),
    };
  const org = await getOrganizationForUser(session.id);
  if (!org)
    return {
      error: NextResponse.json(
        { success: false, error: "No organization" },
        { status: 403 },
      ),
    };
  return { org, session };
}

type ActionBody = {
  threadId?: string;
  action?: "resolve" | "return_to_ai" | "close" | "reply";
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
      return NextResponse.json(
        { success: false, error: "threadId and action are required" },
        { status: 400 },
      );
    }

    const organizationId = gate.org.organizationId;
    const actor = gate.session.email ?? gate.session.id;

    if (action === "reply") {
      const result = await postHumanReply({
        organizationId,
        threadId,
        content: body.content ?? "",
        actorId: gate.session.id,
        actorEmail: gate.session.email ?? null,
        actorName: gate.session.email ?? null,
      });
      return NextResponse.json({
        success: true,
        data: {
          state: result.state,
          message: {
            id: result.message.id,
            role: "human" as const,
            content: result.message.content,
            created_at: result.message.created_at,
            fromHuman: true,
          },
        },
      });
    }

    let state;
    switch (action) {
      case "resolve":
        state = await resolveConversation({
          organizationId,
          threadId,
          actor,
        });
        break;
      case "return_to_ai":
      case "close":
        // Close human handling → AI resumes same thread (handback).
        state = await returnToAi({
          organizationId,
          threadId,
          actor,
        });
        break;
      default:
        return NextResponse.json(
          { success: false, error: "Unknown action" },
          { status: 400 },
        );
    }

    return NextResponse.json({ success: true, data: { state } });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Conversation action failed",
      },
      { status: 500 },
    );
  }
}
