import { Suspense } from "react";
import Checkout from "@/views/Checkout";

export default function CheckoutPage() {
  return (
    <Suspense>
      <Checkout />
    </Suspense>
  );
}
