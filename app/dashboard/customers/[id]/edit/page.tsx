import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { CustomerEditForm } from "./CustomerEditForm";

/**
 * Customer Edit Page
 *
 * Allows Finance team to update customer information with QuickBooks sync
 */
export default async function CustomerEditPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  // Fetch customer by ID
  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
  });

  if (!customer) {
    notFound();
  }

  return <CustomerEditForm customer={customer} />;
}
