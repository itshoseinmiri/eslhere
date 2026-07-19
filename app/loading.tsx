export default function Loading() {
  return (
    <div className="app-loading" role="status" aria-label="Loading ESL Here">
      <div className="app-loading-bars" aria-hidden="true">
        <span className="app-loading-bar" />
        <span className="app-loading-bar" />
        <span className="app-loading-bar" />
      </div>
    </div>
  );
}
