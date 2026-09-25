export default function AppLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    </div>
  );
}
