import { PageHeader } from "@/components/layout/page-header";
import { PreferenceListEditor } from "@/components/mcc-finder/preference-list-editor";

export default function MccFinderListPage() {
  return (
    <div className="page">
      <PageHeader
        kicker="MCC All India Quota · NEET PG 2026"
        title="My preference list"
        description="OBC and Open rows stay labelled as printed. Reorder this list yourself. It is stored in this browser and is separate from the Maharashtra choice list."
      />
      <PreferenceListEditor />
    </div>
  );
}
