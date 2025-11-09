"use client";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";

function EventCard({ eventId }: { eventId: Id<"events"> }) {
  const { user } = useUser();
  const router = useRouter();

  const event = useQuery(api.events.getEventsById, { eventId });
  const availability = useQuery(api.events.getEventAvailability, { eventId });

  const userTicket = useQuery(api.tickets.getUserTicketForEvent, {
    eventId,
    userId: user?.id || "",
  });

  return (
    <div>
      <div>EventCard</div>
    </div>
  );
}

export default EventCard;
