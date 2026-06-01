import { Suspense } from "react";
import Guide from "@/views/Guide";

export default function GuidePage() {
  return (
    <Suspense>
      <Guide />
    </Suspense>
  );
}
