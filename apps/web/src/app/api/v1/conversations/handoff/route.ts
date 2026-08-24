import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import {
  db,
  organizationParticipants,
  threads,
} from "@neylonai/database";
import { ParticipantsService } from "@neylonai/domain/participants";
import {
  ThreadMessagesService,
  ThreadsService,
} from "@neylonai/domain/chat";
import {
  escalateConversation,
  submitHandoffContact,
} from "@neylonai/domain/conversations";
import {
  isApiKeyAuthContext,
  requireApiKeyAuth,
} from "@/server/api-key-auth";

type HandoffBody = {
  threadId?: string | null;
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    profile_image?: string | null;
    anonymous?: boolean;
  };
  name?: string;
  email?: string;
  contact?: { type?: string; value?: string };
  reason?: string;
};

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiKeyAuth(req);
    if (!isApiKeyAuthContext(auth)) return auth;

    const body = (await req.json()) as HandoffBody;
    const externalId = body.user?.id?.trim();
    if (!externalId) {
      return NextResponse.json(
        { success: false, error: "Visitor identity is required" },
        { status: 400 },
      );
    }

    const ensured = await ParticipantsService.ensureParticipant(
      auth.organizationId,
      {
        externalId,
        name: body.user?.name,
        email: body.user?.email,
        profileImage: body.user?.profile_image,
        anonymous: body.user?.anonymous,
      },
    );
    if (!ensured.success || !ensured.data) {
      return NextResponse.json(
        { success: false, error: ensured.error ?? "Invalid visitor" },
        { status: 400 },
      );
    }

    let threadId = body.threadId?.trim() || null;
    if (threadId) {
      const [owned] = await db
        .select({ id: threads.id })
        .from(threads)
        .innerJoin(
          organizationParticipants,
          eq(threads.participant_id, organizationParticipants.id),
        )
        .where(
          and(
            eq(threads.id, threadId),
            eq(threads.organization_id, auth.organizationId),
            eq(organizationParticipants.external_id, externalId),
          ),
        )
        .limit(1);
      if (!owned) {
        return NextResponse.json(
          { success: false, error: "Conversation not found" },
          { status: 404 },
        );
      }
    } else {
      const created = await ThreadsService.createThread({
        organization_id: auth.organizationId,
        participant_id: ensured.data.id,
        title: "Human support request",
      });
      if (!created.success || !created.data) {
        throw new Error(created.error ?? "Failed to create conversation");
      }
      threadId = created.data.id;
      await ThreadMessagesService.createMessage({
        thread_id: threadId,
        role: "user",
        content: "I’d like to talk to the team.",
      });
    }

    const name = body.name?.trim();
    const email = body.email?.trim();
    // Accept any one of email / phone / linkedin. Sanitize the type so only
    // known kinds reach the domain; fall back to the legacy `email` field.
    const CONTACT_TYPES = ["email", "phone", "linkedin"] as const;
    const contactType =
      CONTACT_TYPES.find((t) => t === body.contact?.type) ?? null;
    const rawValue = body.contact?.value?.trim();
    const contact =
      contactType && rawValue
        ? { type: contactType, value: rawValue }
        : undefined;
    const result =
      name && (email || contact)
        ? await submitHandoffContact({
            organizationId: auth.organizationId,
            threadId,
            participantExternalId: externalId,
            name,
            email,
            contact,
          })
        : await escalateConversation({
            organizationId: auth.organizationId,
            threadId,
            reason: body.reason?.trim() || "Customer requested human support",
            trigger: "customer_request",
          });

    return NextResponse.json({
      success: true,
      data: { ...result, threadId },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Handoff failed",
      },
      { status: 400 },
    );
  }
}
