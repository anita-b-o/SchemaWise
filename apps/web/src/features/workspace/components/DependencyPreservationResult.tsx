import type { DependencyPreservationResponseDto, SchemaInputDto } from "../../../api/schemawise-contracts";
import { formatFunctionalDependency } from "../schema-formatters";

interface DependencyPreservationResultProps {
  readonly result: DependencyPreservationResponseDto;
  readonly snapshot: SchemaInputDto;
}

export function DependencyPreservationResult({ result, snapshot }: DependencyPreservationResultProps) {
  const lookup = new Map(snapshot.relation.attributes.map((attribute) => [attribute.id, attribute.name]));

  return (
    <section className="preservation-result" aria-labelledby="preservation-result-heading">
      <h5 id="preservation-result-heading">Dependency preservation</h5>
      <p className={result.preserved ? "property-status property-status--positive" : "property-status property-status--negative"}>
        {result.preserved ? "✓ Preserved" : "× Not preserved"}
      </p>
      {result.preserved ? (
        <p>All dependencies from the minimal cover remain derivable from the projected dependencies of the decomposition.</p>
      ) : (
        <div className="dependency-result-group">
          <strong>Lost dependencies</strong>
          <div className="notation-list">
            {result.lostDependencies.map((dependency, index) => <code key={`${dependency.left.join(":")}:${dependency.right.join(":")}:${index}`}>{formatFunctionalDependency(dependency, lookup)}</code>)}
          </div>
        </div>
      )}
      {result.preservedDependencies.length > 0 ? (
        <details className="result-disclosure">
          <summary>Preserved dependencies</summary>
          <div className="notation-list">
            {result.preservedDependencies.map((dependency, index) => <code key={`${dependency.left.join(":")}:${dependency.right.join(":")}:${index}`}>{formatFunctionalDependency(dependency, lookup)}</code>)}
          </div>
        </details>
      ) : null}
    </section>
  );
}
