const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Checking circuit breaker states...\n");

  const states = await prisma.circuitBreakerState.findMany({
    orderBy: { updatedAt: 'desc' }
  });

  if (states.length === 0) {
    console.log("No circuit breaker states found.");
  } else {
    for (const state of states) {
      console.log(`Service: ${state.serviceName}`);
      console.log(`  State: ${state.state}`);
      console.log(`  Failure Count: ${state.failureCount}`);
      console.log(`  Success Count: ${state.successCount}`);
      console.log(`  Last State Change: ${state.lastStateChangeAt.toISOString()}`);
      console.log(`  Last Error: ${state.lastErrorMessage || 'none'}`);
      console.log(`  Updated: ${state.updatedAt.toISOString()}`);
      console.log("");
    }
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
