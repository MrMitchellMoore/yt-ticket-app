import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { DURATIONS, TICKET_STATUS, WAITING_LIST_STATUS } from "./constants";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

export const getEvents = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("events")
      .filter((q) => q.eq(q.field("is_cancelled"), undefined))
      .collect();
  },
});

export const getEventsById = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    return await ctx.db.get(eventId);
  },
});

export const getEventAvailability = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const event = await ctx.db.get(eventId);
    if (!event) throw new Error("Event not found");

    // Count total purchased tickets for the event
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

    // Count current valid offers
    const now = Date.now();
    const activeOffers = await ctx.db
      .query("waitingList")
      .withIndex("by_event_status", (q) =>
        q.eq("eventId", eventId).eq("status", WAITING_LIST_STATUS.OFFERED)
      )
      .collect()
      .then(
        (entries) => entries.filter((e) => (e.offerExpiresAt ?? 0) > now).length
      );

    const totalReserved = purchasedCount + activeOffers;

    return {
      isSoldOut: totalReserved >= event.totalTickets,
      totalTickets: event.totalTickets,
      purchasedCount,
      activeOffers,
      remainingTickets: Math.max(0, event.totalTickets - totalReserved),
    };
  },
});

// Helper function to check availability (can be used by both queries and mutations)
async function checkEventAvailability(
  ctx: QueryCtx | MutationCtx,
  eventId: Id<"events">
) {
  const event = await ctx.db.get(eventId);
  if (!event) throw new Error("Event not found");

  // Count total purchased tickets for the event
  const purchasedCount = await ctx.db
    .query("tickets")
    .withIndex("by_event", (q) => q.eq("eventId", eventId))
    .collect()
    .then(
      (tickets) =>
        tickets.filter(
          (t) =>
            t.status === TICKET_STATUS.VALID || t.status === TICKET_STATUS.USED
        ).length
    );

  // Count current valid offers
  const now = Date.now();
  const activeOffers = await ctx.db
    .query("waitingList")
    .withIndex("by_event_status", (q) =>
      q.eq("eventId", eventId).eq("status", WAITING_LIST_STATUS.OFFERED)
    )
    .collect()
    .then(
      (entries) => entries.filter((e) => (e.offerExpiresAt ?? 0) > now).length
    );

  const availableSpots = event.totalTickets - (purchasedCount + activeOffers);

  return {
    available: availableSpots > 0,
    availableSpots,
    totalTickets: event.totalTickets,
    purchasedCount,
    activeOffers,
  };
}

export const checkAvailability = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    return await checkEventAvailability(ctx, eventId);
  },
});

// Join waiting list for an event
export const joinWaitingList = mutation({
  args: { eventId: v.id("events"), userId: v.string() },
  handler: async (ctx, { eventId, userId }) => {
    // Rate Limit Check
    // const status = await rateLimiter.limit(ctx, "queueJoin", { key: userId });
    // if (!status.ok){
    //   throw new ConvexError(
    //     `You've joined the waiting list too many times. Please wait ${Math.ceil(status.retryAfter / (60 * 1000))} minutes before trying again.`,
    //   )
    // }

    // First check if user already has an active entry in waiting list for this event
    // Active means any status except EXPIRED
    const existingEntry = await ctx.db
      .query("waitingList")
      .withIndex("by_user_event", (q) =>
        q.eq("userId", userId).eq("eventId", eventId)
      )
      .filter((q) => q.neq(q.field("status"), WAITING_LIST_STATUS.EXPIRED))
      .first();

    // Don't allow duplicate entries
    if (existingEntry) {
      throw new Error("Already in waiting list for this event");
    }

    // Verify event exists
    const event = await ctx.db.get(eventId);
    if (!event) throw new Error("Event not found");

    // Check if there are available tickets
    const { available } = await checkEventAvailability(ctx, eventId);

    const now = Date.now();

    if (available) {
      // If there are available tickets, create an offer entry
      const waitingListId = await ctx.db.insert("waitingList", {
        eventId,
        userId,
        status: WAITING_LIST_STATUS.OFFERED,
        offerExpiresAt: now + DURATIONS.TICKET_OFFER, // set expiration time
      });

      // TODO: Need to implement internal.waitingList.expireOffer

      // Schedule a job to expire this offer after the offer duration
      await ctx.scheduler.runAfter(
        DURATIONS.TICKET_OFFER,
        internal.waitingList.expireOffer,
        { waitingListId, eventId }
      );
    }
  },
});
