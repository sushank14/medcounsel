import { DisclaimerBanner } from "@/components/layout/disclaimer-banner";

export default function DisclaimerPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">Disclaimer & Legal</h1>
      <DisclaimerBanner />
      <div className="prose prose-slate space-y-4 text-sm text-slate-700">
        <section className="card p-6">
          <h2 className="text-lg font-semibold">Counselling Assistance Only</h2>
          <p>
            MedCounsel AI is a counselling assistance platform. Predictions, fit labels, and
            suggestions are estimates based on historical and available counselling data. They do
            not guarantee admission to any college or specialty.
          </p>
        </section>
        <section className="card p-6">
          <h2 className="text-lg font-semibold">Verify with Official Authorities</h2>
          <p>
            Candidates must independently verify eligibility, fees, deadlines, seat availability,
            bond terms, stipend, and counselling rules with the official counselling authority
            (MCC, state CET cells, or respective college).
          </p>
        </section>
        <section className="card p-6">
          <h2 className="text-lg font-semibold">Official Data Only</h2>
          <p>
            Cutoffs and college listings use verified MCC and state counselling sources where
            available. Colleges without official cutoff data may show seat or fee information
            only, or may not appear in search results.
          </p>
        </section>
        <section className="card p-6">
          <h2 className="text-lg font-semibold">Rank Type Awareness</h2>
          <p>
            All India Rank (AIR) and State Merit List (SML) ranks are not interchangeable.
            Maharashtra state counselling uses SML ranks. MCC AIQ uses AIR. The platform labels
            rank types explicitly on every result.
          </p>
        </section>
      </div>
    </div>
  );
}
