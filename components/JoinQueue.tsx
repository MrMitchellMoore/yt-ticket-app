"use client";

import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";

function JoinQueue({
  eventId,
  userId,
}: {
  eventId: Id<"events">;
  userId: Id<"users">;
}) {
  const joinWaitingList = useMutation(api.events.joinWaitingList);
  const queuePosition = useQuery(api.waitingList.getQueuePosition, {
    eventId,
    userId,
  });
  const userTicket = useQuery(api.tickets.getUserTicketForEvent, {
    eventId,
    userId,
  });

  const handleJoinQueue = async () => {
    await joinWaitingList({ eventId, userId });
  };

  return (
    <div>
      <div>Join Queue Component</div>
      <div>Queue Position: {queuePosition?.position || "N/A"}</div>
      <div>User Ticket: {userTicket?._id || "No ticket"}</div>
      <button onClick={handleJoinQueue}>Join Queue</button>
    </div>
  );
}

export default JoinQueue;
