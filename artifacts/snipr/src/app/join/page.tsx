import type { Metadata } from "next";
import { Suspense } from "react";
import JoinTeam from "@/views/JoinTeam";

export const metadata: Metadata = {
  title: "Accept Team Invitation - Snipr",
  description: "Accept your team invitation and join a workspace on Snipr.",
};

export default function JoinPage() {
  return (
    <Suspense>
      <JoinTeam />
    </Suspense>
  );
}
