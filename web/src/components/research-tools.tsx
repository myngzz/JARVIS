import { FileArchive, Globe2, ListChecks, ShieldCheck } from "lucide-react";
import type { ActionKind, ResearchReport } from "@/lib/types";

export function ResearchTools({ report, disabled, browserConfigured, onAction }: {
  report: ResearchReport;
  disabled: boolean;
  browserConfigured: boolean;
  onAction: (action: ActionKind) => void;
}) {
  if (report.mode === "example") return null;
  const hasWeb = report.sources.some((source) => source.kind === "web" && source.url);
  return <div className="research-tools">
    {report.searchProvider && <div className="review-status"><Globe2 size={15} /><span>Penelusuran web: {report.searchProvider}</span></div>}
    {report.plan && <details className="research-plan">
      <summary><ListChecks size={17} /><span>Rencana riset</span><span>{report.plan.queries.length} pencarian</span></summary>
      <p>{report.plan.objective}</p>
      <ol>{report.plan.queries.map((query) => <li key={query}>{query}</li>)}</ol>
      <h3>Kriteria bukti</h3><ul>{report.plan.checks.map((check, index) => <li key={index}>{check}</li>)}</ul>
    </details>}
    {report.review && <div className="review-status"><ShieldCheck size={15} /><span>Ditinjau ulang oleh model</span>{report.review.removedFindings > 0 && <span>{report.review.removedFindings} temuan disisihkan</span>}</div>}
    <div className="research-automation" aria-label="Tindakan riset">
      <button className="button button-secondary" disabled={disabled || !hasWeb || !browserConfigured} onClick={() => onAction("browser_read")} title={!hasWeb ? "Laporan ini tidak memiliki sumber web" : "Ajukan pembacaan maksimal tiga sumber publik"}><Globe2 size={16} />Telusuri sumber</button>
      <button className="button button-secondary" disabled={disabled} onClick={() => onAction("archive_report")}><FileArchive size={16} />Arsipkan laporan</button>
      <span><ShieldCheck size={13} />Perlu persetujuan</span>
    </div>
  </div>;
}