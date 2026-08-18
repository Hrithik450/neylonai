# Proactive Suggestions System - Complete Fix Plan

## Current Issues Identified

### 1. **Insufficient Section Data in Database**
- Production has only 2 sections with 4 total suggestions
- Both sections have duplicate generic suggestions
- Need full crawl of https://neylonai.mhrithik.com to populate all sections

### 2. **Missing Queue-Based Delivery System**
- Current system doesn't implement proper queuing for section suggestions
- No mechanism to lock pending requests when user scrolls to another section
- Section suggestions should be queued and delivered in order

### 3. **No Per-Section Pending Suggestion Tracking**
- System doesn't track which specific suggestions were shown for each section
- Can't show "remaining" suggestions when user returns to a section
- Need to track: section_key → [shown_suggestion_ids, pending_suggestion_ids]

### 4. **Session Management Issues**
- New session generates 4 suggestions but doesn't queue them properly
- Should queue behind pending section suggestions
- Order matters: section queue → session batch queue

## Architecture Overview

```
User Journey:
1. First Visit → Show welcome + 4 general suggestions (session batch)
2. Scroll & Dwell 2.5s on Section A → Queue section A suggestions
3. Still showing Section A suggestion → User scrolls to Section B
   → Lock: finish Section A first, then queue Section B
4. Close tab, reopen later → Generate 4 new session suggestions
   → Queue behind any pending section suggestions from last session
```

## Implementation Plan

### Phase 1: Database & Schema ✓
- [x] Verify `knowledgePageSections` table exists
- [x] Verify sections have `suggestions` JSONB field
- [x] Add tracking table for per-visitor suggestion state

### Phase 2: Crawl & Populate Sections
- [ ] Trigger full crawl of https://neylonai.mhrithik.com
- [ ] Verify all pages are sectioned with Gemini
- [ ] Verify each section has 2-4 specific suggestions generated

### Phase 3: SDK Queue System
- [x] Implement suggestion queue in SDK persistence layer
- [x] Add section suggestion request locking
- [x] Track per-section shown/pending suggestions
- [x] Implement FIFO queue: section suggestions → session batch

### Phase 4: Backend API Improvements
- [x] Modify `/api/v1/suggestions` to return section-specific suggestions
- [x] Track which suggestions were shown per section per visitor
- [x] Return only unshown suggestions for sections

### Phase 5: Session & State Management
- [x] New session: generate 4 suggestions, add to queue
- [x] Queue processing: prioritize section suggestions over session batch
- [x] Handle tab close/reopen: persist pending queue state

## Detailed Implementation

### 1. Add Visitor Suggestion State Tracking Table

```typescript
// New table: visitor_suggestion_state
export const visitorSuggestionState = pgTable(
  "visitor_suggestion_state",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    visitor_id: varchar("visitor_id", { length: 128 }).notNull(), // localStorage visitor ID
    page_path: varchar("page_path", { length: 512 }).notNull(),
    section_key: varchar("section_key", { length: 96 }).notNull(),
    shown_suggestion_ids: jsonb("shown_suggestion_ids").$type<string[]>().notNull().default([]),
    pending_suggestion_ids: jsonb("pending_suggestion_ids").$type<string[]>().notNull().default([]),
    total_suggestions_for_section: integer("total_suggestions_for_section").notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("visitor_suggestion_state_uidx").on(
      t.organization_id,
      t.visitor_id,
      t.page_path,
      t.section_key,
    ),
  ],
);
```

### 2. SDK Suggestion Queue Implementation

```typescript
// packages/sdk/src/react/proactive/suggestion-queue.ts

export interface QueuedSuggestion {
  id: string;
  text: string;
  source: ProactiveSuggestionDto["source"];
  sectionKey?: string;
  priority: "section" | "session";
  requestedAt: number;
}

export interface SuggestionQueue {
  items: QueuedSuggestion[];
  lockedSectionKey: string | null;
  lockedUntil: number | null;
}

export function enqueueSectionSuggestions(
  queue: SuggestionQueue,
  sectionKey: string,
  suggestions: ProactiveSuggestionDto[],
): SuggestionQueue {
  // Add section suggestions with high priority
  const newItems = suggestions.map(s => ({
    ...s,
    sectionKey,
    priority: "section" as const,
    requestedAt: Date.now(),
  }));
  
  return {
    ...queue,
    items: [...queue.items, ...newItems],
  };
}

export function enqueueSessionSuggestions(
  queue: SuggestionQueue,
  suggestions: ProactiveSuggestionDto[],
): SuggestionQueue {
  // Add session suggestions with lower priority (append to end)
  const newItems = suggestions.map(s => ({
    ...s,
    priority: "session" as const,
    requestedAt: Date.now(),
  }));
  
  return {
    ...queue,
    items: [...queue.items, ...newItems],
  };
}

export function dequeueNextSuggestion(
  queue: SuggestionQueue,
): { suggestion: QueuedSuggestion | null; updatedQueue: SuggestionQueue } {
  if (queue.items.length === 0) {
    return { suggestion: null, updatedQueue: queue };
  }
  
  // Check if locked
  if (queue.lockedSectionKey && queue.lockedUntil && Date.now() < queue.lockedUntil) {
    // Only dequeue from locked section
    const nextIdx = queue.items.findIndex(
      item => item.sectionKey === queue.lockedSectionKey
    );
    
    if (nextIdx === -1) {
      // No more from locked section, unlock
      return dequeueNextSuggestion({
        ...queue,
        lockedSectionKey: null,
        lockedUntil: null,
      });
    }
    
    const suggestion = queue.items[nextIdx]!;
    const updatedItems = queue.items.filter((_, i) => i !== nextIdx);
    
    // Check if this was the last from this section
    const hasMoreFromSection = updatedItems.some(
      item => item.sectionKey === queue.lockedSectionKey
    );
    
    return {
      suggestion,
      updatedQueue: {
        items: updatedItems,
        lockedSectionKey: hasMoreFromSection ? queue.lockedSectionKey : null,
        lockedUntil: hasMoreFromSection ? queue.lockedUntil : null,
      },
    };
  }
  
  // Not locked, dequeue first (FIFO, section priority)
  const [suggestion, ...rest] = queue.items;
  
  // Lock if this is a section suggestion
  const lockSection = suggestion.sectionKey ?? null;
  const lockUntil = lockSection ? Date.now() + 30000 : null; // 30s lock
  
  return {
    suggestion,
    updatedQueue: {
      items: rest,
      lockedSectionKey: lockSection,
      lockedUntil: lockUntil,
    },
  };
}
```

### 3. Backend API: Track Per-Section State

```typescript
// New API endpoint: POST /api/v1/suggestions/section-state
// Returns: { shownIds: string[], pendingIds: string[], hasMore: boolean }

export async function getVisitorSectionState(input: {
  organizationId: string;
  visitorId: string;
  pagePath: string;
  sectionKey: string;
}): Promise<{
  shown: string[];
  pending: string[];
  total: number;
}> {
  const state = await db
    .select()
    .from(visitorSuggestionState)
    .where(
      and(
        eq(visitorSuggestionState.organization_id, input.organizationId),
        eq(visitorSuggestionState.visitor_id, input.visitorId),
        eq(visitorSuggestionState.page_path, input.pagePath),
        eq(visitorSuggestionState.section_key, input.sectionKey),
      )
    )
    .limit(1);
    
  if (state.length === 0) {
    return { shown: [], pending: [], total: 0 };
  }
  
  return {
    shown: state[0].shown_suggestion_ids,
    pending: state[0].pending_suggestion_ids,
    total: state[0].total_suggestions_for_section,
  };
}
```

### 4. Modified Suggestion Flow

```
1. User scrolls to Section A, dwells 2.5s
   → SDK fires "dwell" trigger
   → Check: is queue locked for different section? 
     YES → Queue Section A request, wait
     NO  → Fetch suggestions for Section A
   → Lock queue for Section A
   → Show first Section A suggestion
   → Queue remaining Section A suggestions

2. While Section A suggestion showing, user scrolls to Section B, dwells 2.5s
   → SDK fires "dwell" trigger for Section B
   → Check: is queue locked?
     YES (locked for Section A) → Queue Section B fetch request
   → Section A suggestion finishes showing
   → Dequeue next from Section A (if more available)
     OR unlock queue and process Section B

3. New session opened
   → Generate 4 general suggestions
   → Check: any pending section suggestions in queue?
     YES → Append 4 suggestions to END of queue
     NO  → Add 4 suggestions to queue, start showing
```

## Testing Plan

1. **Test Crawl**: Verify all pages and sections crawled
2. **Test Section Suggestions**: Verify each section has 2-4 unique suggestions
3. **Test Queue**: User scrolls multiple sections rapidly
4. **Test Pending**: Close tab mid-section, reopen, verify continues
5. **Test New Session**: Close tab after all sections shown, reopen, verify 4 new suggestions

## Next Steps

1. ~~Trigger full website crawl~~ → **After deploy**: run a website crawl refresh for org `8da298a2-bd3d-4795-a472-779bdeee8c88` (prod currently has only 2 sections / 4 duplicate suggestions)
2. ~~Implement suggestion queue in SDK~~ ✓
3. ~~Add visitor suggestion state tracking~~ ✓
4. Test end-to-end flow after crawl + deploy

---

Organization ID: `8da298a2-bd3d-4795-a472-779bdeee8c88`
Website URL: `https://neylonai.mhrithik.com`
