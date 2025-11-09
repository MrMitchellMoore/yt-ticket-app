"use client";

import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import Spinner from "../shared/Spinner";

function EventList() {
  const events = useQuery(api.events.getEvents);

  // console.log("Events:", events);

  return (
    <div className="min-h-[400px] flex items-center justify-center">
      {/* <Spinner /> */}
    </div>
  );
}

export default EventList;
