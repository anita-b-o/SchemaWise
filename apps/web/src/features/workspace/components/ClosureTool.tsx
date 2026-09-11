import { useEffect, useState } from "react";
import { buildClosureExplanation, type ClosureExplanation as ClosureExplanationModel } from "../../explanations/explanation-builders";
import type { AttributeDraft, ClosureState } from "../workspace-reducer";
import type { ValidationIssue } from "../workspace-validation";
import { Content, FormalReasoning } from "./EducationalAnalysis";
import { MathematicalNotation } from "./MathematicalNotation";

interface ClosureToolProps {
  readonly attributes: readonly AttributeDraft[];
  readonly issues: readonly ValidationIssue[];
  readonly state: ClosureState;
  readonly onCalculate: (selectedAttributes: readonly string[]) => void;
}

function ClosureExplanation({ model, selected, closure, lookup }: {
  readonly model: ClosureExplanationModel;
  readonly selected: readonly string[];
  readonly closure: readonly string[];
  readonly lookup: ReadonlyMap<string, string>;
}) {
  return (
    <>
      <div className="closure-result" aria-live="polite">
        <dl className="closure-result__summary">
          <div><dt>Selected set</dt><dd><MathematicalNotation value={{ kind: "attribute-set", ids: selected }} lookup={lookup} /></dd></div>
          <div><dt>Closure</dt><dd><MathematicalNotation value={{ kind: "closure-result", selectedIds: selected, closureIds: closure }} lookup={lookup} /></dd></div>
        </dl>
      </div>
      <details className="educational-disclosure closure-meaning">
        <summary>What does this mean?</summary>
        <div className="educational-disclosure__content">
          <p><Content tokens={model.educational.summary} lookup={lookup} /></p>
          {selected.length === 0 ? <p>The empty determinant can still determine attributes when the functional dependencies imply them.</p> : null}
          <dl className="closure-coverage">
            <div><dt>Determines</dt><dd><MathematicalNotation value={{ kind: "attribute-set", ids: model.determined }} lookup={lookup} /></dd></div>
            <div><dt>Does not determine</dt><dd>{model.missing.length === 0 ? "None" : <MathematicalNotation value={{ kind: "attribute-set", ids: model.missing }} lookup={lookup} />}</dd></div>
          </dl>
          <h3>Does this set determine every attribute in R?</h3>
          <p><strong>{model.determinesAllAttributes ? "Yes" : "No"}.</strong> {model.determinesAllAttributes
            ? "This closure contains every attribute in the analyzed relation, so the selected set is a superkey."
            : "This closure does not contain every attribute in the relation, so the selected set is not a superkey."}</p>
          <p>If a set is a superkey and no proper subset is also a superkey, then it is a candidate key. Closure establishes the superkey condition; this tool does not test that minimality condition.</p>
        </div>
      </details>
      {model.educational.formal ? (
        <details className="formal-reasoning closure-formal-reasoning">
          <summary>Formal reasoning</summary>
          <FormalReasoning content={model.educational.formal} lookup={lookup} />
        </details>
      ) : null}
    </>
  );
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
  const explanation = hasResult ? buildClosureExplanation(selectedSnapshot, state.data!, state.inputSnapshot!) : undefined;

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
          <p className="field-help">Select none to use the empty set as the starting set.</p>
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
          {explanation ? <ClosureExplanation model={explanation} selected={selectedSnapshot} closure={state.data!.closure} lookup={resultLookup} /> : null}
        </div>
      </details>
    </section>
  );
}
