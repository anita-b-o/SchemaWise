import { useState } from "react";
import type { ValidationIssue } from "../workspace-validation";

interface RelationEditorProps {
  readonly name: string;
  readonly issues: readonly ValidationIssue[];
  readonly onChange: (name: string) => void;
}

export function RelationEditor({ name, issues, onChange }: RelationEditorProps) {
  const [touched, setTouched] = useState(false);
  const error = touched ? issues.find((issue) => issue.field === "relationName") : undefined;

  return (
    <section className="editor-section" aria-labelledby="relation-heading">
      <div className="section-heading">
        <div>
          <p className="section-number" aria-hidden="true">01</p>
          <h2 id="relation-heading">Relation</h2>
        </div>
        <p>Name the table or relation you want to examine.</p>
      </div>
      <div className="field field--measure">
        <label htmlFor="relation-name">Relation name</label>
        <input
          id="relation-name"
          name="relationName"
          type="text"
          maxLength={120}
          value={name}
          aria-describedby={`relation-name-help${error ? " relation-name-error" : ""}`}
          aria-invalid={error ? "true" : undefined}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="e.g. Enrollment"
        />
        <p className="field-help" id="relation-name-help">Up to 120 characters. This is the display name, not a technical ID.</p>
        {error ? <p className="field-error" id="relation-name-error" role="alert">{error.message}</p> : null}
      </div>
    </section>
  );
}
