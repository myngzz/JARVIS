import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { chunkText, ftsQuery } from "./research-core.ts";
import type {
  Activity, Approval, DocumentRecord, MemoryRecord, ResearchReport, Source,
} from "./types.ts";

export class WorkspaceStore {
  private database: DatabaseSync;

  constructor(filename: string) {
    this.database = new DatabaseSync(filename);
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY, createdAt TEXT NOT NULL, data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, bytes INTEGER NOT NULL,
        characters INTEGER NOT NULL, chunks INTEGER NOT NULL, createdAt TEXT NOT NULL
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS document_chunks USING fts5(
        documentId UNINDEXED, name, content, tokenize = 'unicode61'
      );
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL, createdAt TEXT NOT NULL
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS memory_search USING fts5(
        memoryId UNINDEXED, title, content, tokenize = 'unicode61'
      );
      CREATE TABLE IF NOT EXISTS approvals (
        id TEXT PRIMARY KEY, reportId TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
        action TEXT NOT NULL, status TEXT NOT NULL, title TEXT NOT NULL,
        destination TEXT NOT NULL, preview TEXT NOT NULL, createdAt TEXT NOT NULL,
        resolvedAt TEXT, error TEXT
      );
      CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY, text TEXT NOT NULL, kind TEXT NOT NULL, createdAt TEXT NOT NULL
      );
    `);
  }

  private transaction<Result>(operation: () => Result): Result {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.database.exec("COMMIT");
      return result;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  addActivity(text: string, kind: Activity["kind"]) {
    this.database.prepare("INSERT INTO activities VALUES (?, ?, ?, ?)")
      .run(randomUUID(), text, kind, new Date().toISOString());
    this.database.exec("DELETE FROM activities WHERE id NOT IN (SELECT id FROM activities ORDER BY createdAt DESC LIMIT 200)");
  }

  activities(): Activity[] {
    return this.database.prepare("SELECT * FROM activities ORDER BY createdAt DESC LIMIT 30").all() as unknown as Activity[];
  }

  saveReport(report: ResearchReport) {
    this.database.prepare("INSERT INTO reports VALUES (?, ?, ?)")
      .run(report.id, report.createdAt, JSON.stringify(report));
    this.addActivity(`Riset selesai: ${report.query}`, "research");
  }

  reports(): ResearchReport[] {
    return this.database.prepare("SELECT data FROM reports ORDER BY createdAt DESC LIMIT 50")
      .all().map((row) => JSON.parse(String(row.data)) as ResearchReport);
  }

  report(id: string): ResearchReport | null {
    const row = this.database.prepare("SELECT data FROM reports WHERE id = ?").get(id);
    return row ? JSON.parse(String(row.data)) as ResearchReport : null;
  }

  deleteReport(id: string) {
    this.database.prepare("DELETE FROM reports WHERE id = ?").run(id);
  }

  addDocument(name: string, text: string, bytes: number): DocumentRecord {
    const chunks = chunkText(text);
    if (!chunks.length) throw new Error("Dokumen tidak memiliki teks yang dapat dibaca.");
    const record: DocumentRecord = {
      id: randomUUID(), name, bytes, characters: text.length,
      chunks: chunks.length, createdAt: new Date().toISOString(),
    };
    this.transaction(() => {
      this.database.prepare("INSERT INTO documents VALUES (?, ?, ?, ?, ?, ?)")
        .run(record.id, name, bytes, record.characters, record.chunks, record.createdAt);
      const insert = this.database.prepare("INSERT INTO document_chunks (documentId, name, content) VALUES (?, ?, ?)");
      for (const chunk of chunks) insert.run(record.id, name, chunk);
    });
    this.addActivity(`Dokumen ditambahkan: ${name}`, "document");
    return record;
  }

  documents(): DocumentRecord[] {
    return this.database.prepare("SELECT * FROM documents ORDER BY createdAt DESC").all() as unknown as DocumentRecord[];
  }

  documentText(id: string): string | null {
    const rows = this.database.prepare("SELECT content FROM document_chunks WHERE documentId = ? ORDER BY rowid").all(id);
    return rows.length ? rows.map((row) => String(row.content)).join("\n\n") : null;
  }

  private deleteDependentReports(sourceId: string) {
    const rows = this.database.prepare("SELECT id, data FROM reports").all();
    for (const row of rows) {
      const report = JSON.parse(String(row.data)) as ResearchReport;
      if (report.sources.some((source) => source.documentId === sourceId)) {
        this.database.prepare("DELETE FROM reports WHERE id = ?").run(String(row.id));
      }
    }
  }

  deleteDocument(id: string) {
    this.transaction(() => {
      this.database.prepare("DELETE FROM document_chunks WHERE documentId = ?").run(id);
      this.database.prepare("DELETE FROM documents WHERE id = ?").run(id);
      this.deleteDependentReports(id);
    });
    this.addActivity("Dokumen dan laporan turunannya dihapus", "document");
  }

  addMemory(title: string, content: string): MemoryRecord {
    const memory: MemoryRecord = { id: randomUUID(), title, content, createdAt: new Date().toISOString() };
    this.transaction(() => {
      this.database.prepare("INSERT INTO memories VALUES (?, ?, ?, ?)")
        .run(memory.id, title, content, memory.createdAt);
      this.database.prepare("INSERT INTO memory_search (memoryId, title, content) VALUES (?, ?, ?)")
        .run(memory.id, title, content);
    });
    this.addActivity(`Memori disimpan: ${title}`, "memory");
    return memory;
  }

  memories(): MemoryRecord[] {
    return this.database.prepare("SELECT * FROM memories ORDER BY createdAt DESC").all() as unknown as MemoryRecord[];
  }

  deleteMemory(id: string) {
    this.transaction(() => {
      this.database.prepare("DELETE FROM memory_search WHERE memoryId = ?").run(id);
      this.database.prepare("DELETE FROM memories WHERE id = ?").run(id);
      this.deleteDependentReports(id);
    });
    this.addActivity("Memori dan laporan turunannya dihapus", "memory");
  }

  search(query: string, options: { documents: boolean; memory: boolean; limit: number }): Source[] {
    const match = ftsQuery(query);
    if (!match) return [];
    const accessedAt = new Date().toISOString();
    const sources: Source[] = [];
    if (options.documents) {
      const rows = this.database.prepare(`
        SELECT rowid, documentId, name, content FROM document_chunks
        WHERE document_chunks MATCH ? ORDER BY bm25(document_chunks) LIMIT ?
      `).all(match, options.limit);
      sources.push(...rows.map((row) => ({
        id: `document-${row.rowid}`, title: String(row.name), kind: "document" as const,
        excerpt: String(row.content), documentId: String(row.documentId), host: "Dokumen lokal", accessedAt,
      })));
    }
    if (options.memory) {
      const rows = this.database.prepare(`
        SELECT rowid, memoryId, title, content FROM memory_search
        WHERE memory_search MATCH ? ORDER BY bm25(memory_search) LIMIT ?
      `).all(match, options.limit);
      sources.push(...rows.map((row) => ({
        id: `memory-${row.rowid}`, title: String(row.title), kind: "memory" as const,
        excerpt: String(row.content).slice(0, 2400), documentId: String(row.memoryId), host: "Memori lokal", accessedAt,
      })));
    }
    return sources.slice(0, options.limit);
  }

  createApproval(approval: Approval) {
    this.database.prepare("INSERT INTO approvals (id, reportId, action, status, title, destination, preview, createdAt, resolvedAt, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(approval.id, approval.reportId, approval.action, approval.status, approval.title,
        approval.destination, approval.preview, approval.createdAt, approval.resolvedAt, approval.error);
    this.addActivity(`Menunggu persetujuan: ${approval.title}`, "approval");
  }

  approvals(): Approval[] {
    return this.database.prepare("SELECT * FROM approvals ORDER BY createdAt DESC LIMIT 100").all() as unknown as Approval[];
  }

  approval(id: string): Approval | null {
    return (this.database.prepare("SELECT * FROM approvals WHERE id = ?").get(id) as unknown as Approval) ?? null;
  }

  claimApproval(id: string): boolean {
    return this.database.prepare("UPDATE approvals SET status = 'running' WHERE id = ? AND status = 'pending'").run(id).changes === 1;
  }

  rejectApproval(id: string): boolean {
    const changed = this.database.prepare("UPDATE approvals SET status = 'rejected', resolvedAt = ? WHERE id = ? AND status = 'pending'")
      .run(new Date().toISOString(), id).changes === 1;
    if (changed) this.addActivity("Tindakan ditolak", "approval");
    return changed;
  }

  finishApproval(id: string, error: string | null = null) {
    this.database.prepare("UPDATE approvals SET status = ?, resolvedAt = ?, error = ? WHERE id = ? AND status = 'running'")
      .run(error ? "failed" : "completed", new Date().toISOString(), error, id);
    this.addActivity(error ? "Tindakan gagal; tidak diulang otomatis" : "Tindakan yang disetujui selesai", "approval");
  }

  clearAll() {
    this.transaction(() => {
      this.database.exec("DELETE FROM approvals; DELETE FROM reports; DELETE FROM document_chunks; DELETE FROM documents; DELETE FROM memory_search; DELETE FROM memories; DELETE FROM activities;");
    });
    this.database.exec("PRAGMA wal_checkpoint(TRUNCATE); VACUUM;");
  }

  close() {
    this.database.close();
  }
}