import test from "node:test";
import assert from "node:assert/strict";

import { displayOpsBiActivityStatus, displayOpsBiDocumentKind } from "../lib/ops/ops-bi";

test("displayOpsBiDocumentKind normalizes operational document labels", () => {
  assert.equal(displayOpsBiDocumentKind("CV_FINAL"), "CV final");
  assert.equal(displayOpsBiDocumentKind("COVER_LETTER_FINAL"), "Cover final");
  assert.equal(displayOpsBiDocumentKind("CANVA_LINK"), "Canva");
});

test("displayOpsBiActivityStatus normalizes application and interview labels", () => {
  assert.equal(displayOpsBiActivityStatus("NAO_PASSOU"), "Não passou");
  assert.equal(displayOpsBiActivityStatus("RECOLOCADO"), "Recolocado");
  assert.equal(displayOpsBiActivityStatus("INTERVIEW"), "Entrevista");
});
