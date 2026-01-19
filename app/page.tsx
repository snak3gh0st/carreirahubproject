import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function Home() {
  // Check if user is authenticated
  const session = await getServerSession(authOptions);

  if (session) {
    // User is logged in, redirect to dashboard
    redirect("/dashboard");
  } else {
    // User is not logged in, redirect to signin
    redirect("/auth/signin");
  }
}
