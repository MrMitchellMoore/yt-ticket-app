import { v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  MutationCtx,
} from "./_generated/server";
import { DURATIONS, TICKET_STATUS, WAITING_LIST_STATUS } from "./constants";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

export const getQueuePosition = query({
  args: {
    eventId: v.id("events"),
    userId: v.string(),
  },
  handler: async (ctx, { eventId, userId }) => {
    const entry = await ctx.db
      .query("waitingList")
      .withIndex("by_user_event", (q) =>
        q.eq("userId", userId).eq("eventId", eventId)
      )
      .order("desc")
      .first();

    if (!entry) return null;

    // Get total number of people ahead in line
    const peopleAhead = await ctx.db
      .query("waitingList")
      .withIndex("by_event_status", (q) => q.eq("eventId", eventId))
      .filter((q) =>
        q.and(
          // create all entries before this one
          q.lt(q.field("_creationTime"), entry._creationTime),
          // only get entries that either waiting or offered
          q.or(
            q.eq(q.field("status"), WAITING_LIST_STATUS.WAITING),
            q.eq(q.field("status"), WAITING_LIST_STATUS.OFFERED)
          )
        )
      )
      .collect()
      .then((entries) => entries.length);

    return {
      ...entry,
      position: peopleAhead + 1, // +1 to include the user themselves
    };
  },
});

/**
  Internal mutation to expire a single offer and process queue for next person.
  Called by scheduled job when offer timer expires.
*/
export const expireOffer = internalMutation({
  args: {
    waitingListId: v.id("waitingList"),
    eventId: v.id("events"),
  },
  handler: async (ctx, { waitingListId, eventId }) => {
    const offer = await ctx.db.get(waitingListId);
    // if offer is not found or is not in offered status, do nothing
    if (!offer || offer.status !== WAITING_LIST_STATUS.OFFERED) return;

    await ctx.db.patch(waitingListId, {
      status: WAITING_LIST_STATUS.EXPIRED,
    });

    await ctx.scheduler.runAfter(0, internal.waitingList.processQueueInternal, {
      eventId,
    });
  },
});

/**
 * Mutation to process the waiting list queue and offer tickets to next eligible users.
  Checks current availability considering purchased tickets and active offers.
  This is exposed publicly so clients can manually trigger queue processing.
 */

// Helper function containing the queue processing logic
async function processQueueLogic(ctx: MutationCtx, eventId: Id<"events">) {
  const event = await ctx.db.get(eventId);

  if (!event) throw new Error("Event not found");

  const { availableSpots } = await ctx.db
    .query("events")
    .filter((q) => q.eq(q.field("_id"), eventId))
    .first()
    .then(async (event) => {
      if (!event) throw new Error("Event not found");

      const purchasedCount = await ctx.db
        .query("tickets")
        .withIndex("by_event", (q) => q.eq("eventId", eventId))
        .collect()
        .then(
          (tickets) =>
            tickets.filter(
              (t) =>
                t.status === TICKET_STATUS.VALID ||
                t.status === TICKET_STATUS.USED
            ).length
        );

      const now = Date.now();
      const activeOffers = await ctx.db
        .query("waitingList")
        .withIndex("by_event_status", (q) =>
          q.eq("eventId", eventId).eq("status", WAITING_LIST_STATUS.OFFERED)
        )
        .collect()
        .then(
          (entries) =>
            entries.filter((e) => (e.offerExpiresAt ?? 0) > now).length
        );

      return {
        availableSpots: event.totalTickets - (purchasedCount + activeOffers),
      };
    });

  if (availableSpots <= 0) return;

  const waitingUsers = await ctx.db
    .query("waitingList")
    .withIndex("by_event_status", (q) =>
      q.eq("eventId", eventId).eq("status", WAITING_LIST_STATUS.WAITING)
    )
    .order("asc")
    .take(availableSpots);

  const now = Date.now();
  for (const user of waitingUsers) {
    await ctx.db.patch(user._id, {
      status: WAITING_LIST_STATUS.OFFERED,
      offerExpiresAt: now + DURATIONS.TICKET_OFFER,
    });

    await ctx.scheduler.runAfter(
      DURATIONS.TICKET_OFFER,
      internal.waitingList.processQueueInternal,
      { eventId }
    );
  }
}

export const processQueue = mutation({
  args: {
    eventId: v.id("events"),
  },
  handler: async (ctx, { eventId }) => {
    await processQueueLogic(ctx, eventId);
  },
});

// Internal helper for scheduling
export const processQueueInternal = internalMutation({
  args: {
    eventId: v.id("events"),
  },
  handler: async (ctx, { eventId }) => {
    await processQueueLogic(ctx, eventId);
  },
});

export const releaseTicket = mutation({
  args: {
    eventId: v.id("events"),
    waitingListId: v.id("waitingList"),
  },
  handler: async (ctx, { eventId, waitingListId }) => {
    const entry = await ctx.db.get(waitingListId);

    if (!entry || entry.status !== WAITING_LIST_STATUS.OFFERED) {
      throw new Error("No valid ticket offer found");
    }

    // Mark the entry as expired
    await ctx.db.patch(waitingListId, {
      status: WAITING_LIST_STATUS.EXPIRED,
    });

    // process queue to offer ticket to next person
    await ctx.scheduler.runAfter(0, internal.waitingList.processQueueInternal, {
      eventId,
    });
  },
});
