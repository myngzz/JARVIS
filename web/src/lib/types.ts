export type SourceKind = "web" | "document" | "memory";

export interface Source {
  id: string;
  title: string;
  kind: SourceKind;
  excerpt: string;
  host: string;
  url?: string;
  image?: string;
  documentId?: string;
  accessedAt: string;
}

export interface Finding {
  heading: string;
  text: string;
  sourceIds: string[];
  kind: "source" | "analysis" | "gap";
}

export interface ResearchReport {
  id: string;
  query: string;
  title: string;
  summary: string;
  findings: Finding[];
  sources: Source[];
  mode: "extractive" | "cloud" | "example";
  provider: string;
  warnings: string[];
  createdAt: string;
  durationMs: number;
}

export interface ResearchInput {
  query: string;
  web: boolean;
  documents: boolean;
  memory: boolean;
  depth: "quick" | "deep";
  useAi: boolean;
  cloudConsent: boolean;
}

export interface DocumentRecord {
  id: string;
  name: string;
  bytes: number;
  characters: number;
  chunks: number;
  createdAt: string;
}

export interface MemoryRecord {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

export type ActionKind = "save_memory" | "export_markdown" | "send_webhook";
export type ApprovalStatus = "pending" | "running" | "completed" | "rejected" | "failed";

export interface Approval {
  id: string;
  reportId: string;
  action: ActionKind;
  status: ApprovalStatus;
  title: string;
  destination: string;
  preview: string;
  createdAt: string;
  resolvedAt: string | null;
  error: string | null;
}

export interface Activity {
  id: string;
  text: string;
  kind: "research" | "document" | "memory" | "approval";
  createdAt: string;
}

export interface ProviderConfig {
  aiConfigured: boolean;
  model: string;
  webProvider: "Wikipedia" | "Tavily";
  webhookConfigured: boolean;
  webhookDestination: string | null;
}

export interface Workspace {
  reports: ResearchReport[];
  documents: DocumentRecord[];
  memories: MemoryRecord[];
  approvals: Approval[];
  activities: Activity[];
  config: ProviderConfig;
}

export interface ResearchProgress {
  stage: "search" | "sources" | "compose" | "save";
  message: string;
  count?: number;
}