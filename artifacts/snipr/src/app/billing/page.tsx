import { Suspense } from "react";
import Billing from "@/views/Billing";

export default function BillingPage() {
  return (
    <Suspense>
      <Billing />
    </Suspense>
  );
}
