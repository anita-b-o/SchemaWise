import { SchemaWorkspace } from "./features/workspace/components/SchemaWorkspace";
import { AuthProvider } from "./features/auth/auth-context";

export function App() {
  return (
    <AuthProvider>
      <header className="site-header">
        <div className="shell site-header__inner">
          <a className="wordmark" href="/" aria-label="SchemaWise home">SchemaWise</a>
          <span className="site-header__context">Relational normalization</span>
        </div>
      </header>
      <main className="shell workspace-page">
        <div className="page-introduction">
          <p className="eyebrow">Schema workspace</p>
          <h1>Define a relation and its dependencies.</h1>
          <p>Model the facts your relation stores. SchemaWise will use this input to explain normalization step by step.</p>
        </div>
        <SchemaWorkspace />
      </main>
    </AuthProvider>
  );
}
