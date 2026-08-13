import { NextRequest, NextResponse } from "next/server";
import { getInvoiceStatus } from "@/lib/monobank";

// Проксі до Monobank invoice/status — сторінка успіху не може дзвонити
// в Monobank напряму (там потрібен приватний X-Token), тож питає нас.
export async function GET(req: NextRequest) {
  const invoiceId = req.nextUrl.searchParams.get("invoiceId");

  if (!invoiceId) {
    return NextResponse.json({ error: "invoiceId is required" }, { status: 400 });
  }

  try {
    const status = await getInvoiceStatus(invoiceId);
    return NextResponse.json({
      status: status.status,
      amount: status.amount,
      finalAmount: status.finalAmount,
      reference: status.reference,
      failureReason: status.failureReason,
    });
  } catch (error) {
    console.error("Monobank status check error:", error);
    return NextResponse.json({ error: "Status check failed" }, { status: 500 });
  }
}
