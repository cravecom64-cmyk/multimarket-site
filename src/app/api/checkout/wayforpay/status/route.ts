import { NextRequest, NextResponse } from "next/server";
import { checkStatus } from "@/lib/wayforpay";

export async function GET(req: NextRequest) {
  const orderReference = req.nextUrl.searchParams.get("orderReference");

  if (!orderReference) {
    return NextResponse.json({ error: "orderReference is required" }, { status: 400 });
  }

  try {
    const status = await checkStatus(orderReference);
    return NextResponse.json({
      transactionStatus: status.transactionStatus,
      amount: status.amount,
      reason: status.reason,
    });
  } catch (error) {
    console.error("WayForPay status check error:", error);
    return NextResponse.json({ error: "Status check failed" }, { status: 500 });
  }
}
