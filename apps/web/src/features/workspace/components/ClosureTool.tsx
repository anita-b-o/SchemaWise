import { useEffect, useState } from "react";
import { formatClosure } from "../schema-formatters";
import type { AttributeDraft, ClosureState } from "../workspace-reducer";
import type { ValidationIssue } from "../workspace-validation";

interface ClosureToolProps {
  readonly attributes: readonly AttributeDraft[];
  readonly issues: readonly ValidationIssue[];
  readonly state: ClosureState;
  readonly onCalculate: (selectedAttributes: readonly string[]) => void;
}

export function ClosureTool({ attributes, issues, state, onCalculate }: ClosureToolProps) {
  const [selected, setSelected] = useState<readonly string[]>([]);
  const knownIds = new Set(attributes.map((attribute) => attribute.id));
  const currentSelected = selected.filter((id) => knownIds.has(id));
  const isLoading = state.status === "loading";
  const lookup = (snapshot: ClosureState["inputSnapshot"]) => new Map((snapshot?.relation.attributes ?? []).map((attribute) => [attribute.id, attribute.name.trim() || "Unnamed attribute"]));
  const errorMessage = state.error instanceof Error && state.error.name === "SchemaWiseApiError" && "kind" in state.error && state.error.kind === "network"
    ? "We couldn't reach SchemaWise. Check your connection and try again."
    : "The API could not calculate this closure. Review the schema and try again.";

  useEffect(() => {
    setSelected((current) => current.filter((id) => knownIds.has(id)));
  }, [attributes]);

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  const hasResult = state.data !== undefined && state.inputSnapshot !== undefined && state.selectedAttributes !== undefined;
  const selectedSnapshot = state.selectedAttributes ?? [];
  const resultLookup = lookup(state.inputSnapshot);
  const startingNotation = formatClosure(selectedSnapshot, resultLookup);
  const resultText = hasResult ? `${startingNotation === "∅" ? "∅" : startingNotation.slice(1, -1)}⁺ = ${formatClosure(state.data!.closure, resultLookup)}` : "";

  return (
    <section className="closure-tool" aria-labelledby="closure-tool-heading">
      <details>
        <summary>Tools</summary>
        <div className="closure-tool__content">
          <div className="section-heading">
            <div>
              <p className="section-number" aria-hidden="true">04</p>
              <h2 id="closure-tool-heading">Attribute closure</h2>
            </div>
            <p>Select a set of attributes to calculate its closure under the current functional dependencies.</p>
          </div>
          <p className="field-help"><code>X⁺</code> is calculated from the current draft. Select none to calculate the valid empty set, written mathematically as empty set.</p>
          <fieldset className="closure-attributes">
            <legend>Starting attributes</legend>
            <div className="attribute-options">
              {attributes.map((attribute) => (
                <label key={attribute.id}>
                  <input type="checkbox" checked={currentSelected.includes(attribute.id)} onChange={() => toggle(attribute.id)} />
                  <span>{attribute.name.trim() || "Unnamed attribute"}</span>
                </label>
              ))}
            </div>
            {attributes.length === 0 ? <p className="empty-note">Add attributes to choose a starting set.</p> : null}
          </fieldset>
          <button className="button button--primary" type="button" onClick={() => onCalculate(currentSelected)} disabled={issues.length > 0}>
            {isLoading ? "Calculating…" : hasResult ? "Calculate again" : "Calculate closure"}
          </button>
          {issues.length > 0 ? <p className="closure-help">Resolve the schema issues before calculating closure. A prior analysis is not required.</p> : null}
          {isLoading ? <p className="closure-status" role="status">Calculating closure…</p> : null}
          {state.outOfDate ? <div className="stale-notice closure-stale" role="status"><strong>Closure result is out of date</strong><p>The draft has changed since this calculation. Calculate again to update it.</p></div> : null}
          {state.status === "error" ? <div className="analysis-error closure-error" role="alert"><strong>Closure calculation failed</strong><p>{errorMessage}</p></div> : null}
          {hasResult ? <p className="closure-result" aria-live="polite"><code>{resultText}</code></p> : null}
        </div>
      </details>
    </section>
  );
}
