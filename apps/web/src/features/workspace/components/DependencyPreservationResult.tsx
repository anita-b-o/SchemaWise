import type { DependencyPreservationResponseDto, SchemaInputDto } from "../../../api/schemawise-contracts";
import { buildDependencyPreservationExplanation } from "../../explanations/explanation-builders";
import { Content, TransformationReasoning } from "./EducationalAnalysis";
import { MathematicalNotation } from "./MathematicalNotation";

interface DependencyPreservationResultProps {
  readonly result: DependencyPreservationResponseDto;
  readonly snapshot: SchemaInputDto;
}

export function DependencyPreservationResult({ result, snapshot }: DependencyPreservationResultProps) {
  const lookup = new Map(snapshot.relation.attributes.map((attribute) => [attribute.id, attribute.name]));
  const explanation = buildDependencyPreservationExplanation(result);

  return (
    <section className="preservation-result" aria-labelledby="preservation-result-heading">
      <h5 id="preservation-result-heading">Dependency preservation</h5>
      <p className={result.preserved ? "property-status property-status--positive" : "property-status property-status--negative"}>
        {result.preserved ? "✓ Preserved" : "× Not preserved"}
      </p>
      <p className="property-provenance"><strong>Observed / checked result</strong></p>
      {!result.preserved ? (
        <div className="dependency-result-group">
          <strong>Lost dependencies</strong>
          <ul className="dependency-evidence-list">
            {result.lostDependencies.map((dependency, index) => (
              <li key={`${dependency.left.join(":")}:${dependency.right.join(":")}:${index}`}>
                <MathematicalNotation value={{ kind: "functional-dependency", dependency }} lookup={lookup} />
                <p>This dependency is not implied by the union of the projected dependencies of the decomposition.</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <details className="result-disclosure educational-disclosure">
        <summary>What does this result mean?</summary>
        <div className="educational-disclosure__content">
          <p><Content tokens={explanation.summary} lookup={lookup} /></p>
        </div>
      </details>
      {result.preservedDependencies.length > 0 ? (
        <details className="result-disclosure">
          <summary>Preserved dependencies</summary>
          <p>These dependencies remain enforceable through the decomposed relations. A dependency may follow transitively from the combined projections; it does not need to appear directly in one final relation.</p>
          <div className="notation-list">
            {result.preservedDependencies.map((dependency, index) => <MathematicalNotation key={`${dependency.left.join(":")}:${dependency.right.join(":")}:${index}`} value={{ kind: "functional-dependency", dependency }} lookup={lookup} />)}
          </div>
        </details>
      ) : null}
      <details className="result-disclosure formal-reasoning-disclosure">
        <summary>Formal reasoning</summary>
        <TransformationReasoning explanation={explanation} lookup={lookup} />
      </details>
    </section>
  );
}
