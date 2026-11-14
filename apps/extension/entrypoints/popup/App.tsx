import { PRODUCT_NAME } from '@promptknight/shared';

export default function App() {
  return (
    <main>
      <span className="badge">Development preview</span>
      <h1>{PRODUCT_NAME}</h1>
      <p className="tagline">Local-first protection for sensitive text</p>
      <p className="notice">
        Foundation only. Paste protection is not active yet.
      </p>
    </main>
  );
}
