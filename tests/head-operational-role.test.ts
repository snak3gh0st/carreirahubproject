import test from "node:test";
import assert from "node:assert/strict";

import {
  getSidebarSectionsFor,
  SIDEBAR_BY_ROLE,
} from "../lib/sidebar/role-config";
import { toolRegistry } from "../lib/ai/tools";

test("HEAD_OPERACIONAL sees the full operational hub sidebar", () => {
  const headSections = getSidebarSectionsFor("HEAD_OPERACIONAL", null);
  const operationalSections = getSidebarSectionsFor("OPERATIONAL", null);

  assert.deepEqual(headSections, operationalSections);
  assert.deepEqual(SIDEBAR_BY_ROLE["HEAD_OPERACIONAL" as keyof typeof SIDEBAR_BY_ROLE], operationalSections);
});

test("HEAD_OPERACIONAL can use every operational AI tool", () => {
  const operationalToolNames = [
    "getStudentsByPhase",
    "getStudentProfile",
    "getStudentSessions",
    "getStudentNextActions",
    "getDailyActionView",
    "getCoordinatorOverview",
    "searchStudents",
  ];

  for (const name of operationalToolNames) {
    const tool = toolRegistry.find((candidate) => candidate.name === name);
    assert.ok(tool, `${name} should be registered`);
    assert.ok(
      tool.allowedRoles.includes("HEAD_OPERACIONAL" as any),
      `${name} should allow HEAD_OPERACIONAL`,
    );
  }
});
