import assert from "node:assert/strict";
import test from "node:test";
import { WorkspaceStore } from "./store.ts";
import type { Approval, ResearchReport } from "./types.ts";

function sampleReport(): ResearchReport {
  return {
    id: "report-test", query: "energi", title: "Energi", summary: "Ringkasan", findings: [],
    sources: [], mode: "extractive", provider: "Lokal", warnings: [], createdAt: new Date().toISOString(), durationMs: 1,
  };
}

test("document search is local, ranked, and deletable", () => {
  const store = new WorkspaceStore(":memory:");
  try {
    const document = store.addDocument("Rencana.txt", "Panel surya menghasilkan energi listrik.", 42);
    const results = store.search("energi surya", { documents: true, memory: false, limit: 4 });
    assert.equal(results.length, 1);
    assert.equal(results[0].documentId, document.id);
    assert.match(store.documentText(document.id)!, /surya/);
    store.deleteDocument(document.id);
    assert.equal(store.documents().length, 0);
    assert.equal(store.search("surya", { documents: true, memory: false, limit: 4 }).length, 0);
  } finally { store.close(); }
});

test("memory deletion also removes derived reports and pending actions", () => {
  const store = new WorkspaceStore(":memory:");
  try {
    const memory = store.addMemory("Preferensi", "Saya memilih energi surya");
    const report = sampleReport();
    report.sources = store.search("surya", { documents: false, memory: true, limit: 4 });
    store.saveReport(report);
    store.deleteMemory(memory.id);
    assert.equal(store.memories().length, 0);
    assert.equal(store.reports().length, 0);
  } finally { store.close(); }
});

test("an approval can only be claimed once and rejection blocks execution", () => {
  const store = new WorkspaceStore(":memory:");
  try {
    const report = sampleReport();
    store.saveReport(report);
    const approval: Approval = {
      id: "approval-test", reportId: report.id, action: "save_memory", status: "pending",
      title: "Simpan", destination: "Lokal", preview: "Ringkasan", createdAt: report.createdAt,
      resolvedAt: null, error: null,
    };
    store.createApproval(approval);
    assert.equal(store.claimApproval(approval.id), true);
    assert.equal(store.claimApproval(approval.id), false);
    store.finishApproval(approval.id);
    assert.equal(store.approval(approval.id)?.status, "completed");
    store.createApproval({ ...approval, id: "rejected" });
    assert.equal(store.rejectApproval("rejected"), true);
    assert.equal(store.claimApproval("rejected"), false);
    store.clearAll();
    assert.equal(store.reports().length, 0);
    assert.equal(store.approvals().length, 0);
  } finally { store.close(); }
});