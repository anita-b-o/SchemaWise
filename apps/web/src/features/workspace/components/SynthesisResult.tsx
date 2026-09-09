import type { SchemaInputDto, ThirdNormalFormSynthesisResponseDto } from "../../../api/schemawise-contracts";
import { formatAttributeSet, formatFunctionalDependency } from "../schema-formatters";
import { synthesizedRelationSourceLabel, TRANSFORMATION_COPY } from "../transformation-explanations";

interface SynthesisResultProps {
  readonly result: ThirdNormalFormSynthesisResponseDto;
  readonly snapshot: SchemaInputDto;
}

export function SynthesisResult({ result, snapshot }: SynthesisResultProps) {
  const lookup = new Map(snapshot.relation.attributes.map((attribute) => [attribute.id, attribute.name]));

  return (
    <section className="transformation-result" aria-labelledby="synthesis-result-heading">
      <h4 id="synthesis-result-heading">3NF synthesis</h4>
      <ol className="relation-result-list">
        {result.relations.map((relation, index) => (
          <li key={`${relation.attributes.join(":")}:${index}`}>
            <span className="relation-result-label">Relation {index + 1}</span>
            <code>{formatAttributeSet(relation.attributes, lookup)}</code>
            <span className="relation-source">{synthesizedRelationSourceLabel(relation.source)}</span>
          </li>
        ))}
      </ol>

      {result.addedCandidateKey !== null ? (
        <div className="candidate-key-addition">
          <strong>Additional candidate-key relation</strong>
          <code>{formatAttributeSet(result.addedCandidateKey, lookup)}</code>
          <p>This relation was added because none of the synthesized relations contained a candidate key of the original relation.</p>
        </div>
      ) : null}

      <details className="result-disclosure">
        <summary>Minimal cover used</summary>
        {result.minimalCover.length === 0 ? <code>∅</code> : (
          <div className="notation-list">
            {result.minimalCover.map((dependency, index) => <code key={`${dependency.left.join(":")}:${dependency.right.join(":")}:${index}`}>{formatFunctionalDependency(dependency, lookup)}</code>)}
          </div>
        )}
      </details>

      <div className="guarantee-note">
        <strong>3NF synthesis guarantees</strong>
        <p>{TRANSFORMATION_COPY.synthesisGuarantee}</p>
      </div>
    </section>
  );
}
