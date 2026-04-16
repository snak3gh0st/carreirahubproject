/**
 * One-off fix: "El Passo" → "El Paso" on Murilo's customer record, and
 * trims any leading/trailing whitespace on address parts.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { prisma } = require("../lib/db");

  const customer = await prisma.customer.findFirst({
    where: { name: { contains: "Murilo", mode: "insensitive" } },
  });
  if (!customer) throw new Error("Murilo not found");

  console.log("Before:", {
    address: JSON.stringify(customer.address),
    city: JSON.stringify(customer.city),
    state: JSON.stringify(customer.state),
    zipCode: JSON.stringify(customer.zipCode),
    country: JSON.stringify(customer.country),
  });

  const fixedCity = (customer.city || "").trim().replace(/\bEl Passo\b/gi, "El Paso");

  const updated = await prisma.customer.update({
    where: { id: customer.id },
    data: {
      address: customer.address?.trim() ?? customer.address,
      city: fixedCity,
      state: customer.state?.trim() ?? customer.state,
      zipCode: customer.zipCode?.trim() ?? customer.zipCode,
      country: customer.country?.trim() ?? customer.country,
    },
  });

  console.log("After:", {
    address: JSON.stringify(updated.address),
    city: JSON.stringify(updated.city),
    state: JSON.stringify(updated.state),
    zipCode: JSON.stringify(updated.zipCode),
    country: JSON.stringify(updated.country),
  });

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
