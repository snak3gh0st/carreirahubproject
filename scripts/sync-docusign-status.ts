import "dotenv/config";

import { docusignContractSyncService } from "@/lib/services/docusign-contract-sync.service";

const APPLY = process.argv.includes("--apply");
const FROM_DATE_ARG = process.argv.find((arg) => arg.startsWith("--from-date="));
const fromDate = FROM_DATE_ARG ? new Date(FROM_DATE_ARG.split("=")[1]) : undefined;

async function main() {
  console.log(`=== DocuSign Contract Sync ${APPLY ? "(APPLY)" : "(DRY RUN)"} ===\n`);

  const contracts = await docusignContractSyncService.listContractsForSync();
  console.log(`Contracts eligible for sync: ${contracts.length}\n`);

  if (!APPLY) {
    for (const contract of contracts) {
      try {
        const inspection = await docusignContractSyncService.inspectContract(contract.id);
        console.log(
          `${inspection.contractId} | local=${inspection.localStatus} | docusign=${inspection.providerStatus} | target=${inspection.targetStatus}`
        );
      } catch (error) {
        console.error(`${contract.id} | ERROR | ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log(`\nRun with --apply to update the hub state.`);
    const emailPreview = await docusignContractSyncService.reconcileCompletedEnvelopesByEmail({
      fromDate,
      apply: false,
    });
    console.log("\n=== Email Reconciliation Preview ===\n");
    console.log(JSON.stringify(emailPreview, null, 2));
    return;
  }

  const result = await docusignContractSyncService.syncAllContracts({
    fromDate,
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("[sync-docusign-status]", error);
  process.exit(1);
});
