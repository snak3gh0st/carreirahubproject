import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { InvoiceForm } from "./InvoiceForm";

export default async function NewInvoicePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  const role = (session.user as any).role;
  const allowedRoles = ["ADMIN", "FINANCE", "COMMERCIAL"];
  if (!allowedRoles.includes(role)) {
    redirect("/dashboard");
  }

  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  const deals = await prisma.deal.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      customerId: true,
    },
  });

  return <InvoiceForm customers={customers} deals={deals} />;
}
