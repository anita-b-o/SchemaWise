import type { SchemaInputDto, ThirdNormalFormSynthesisResponseDto } from "../../../api/schemawise-contracts";
import { buildThirdNormalFormSynthesisExplanation } from "../../explanations/explanation-builders";
import { synthesizedRelationSourceLabel } from "../transformation-explanations";
import { Content, TransformationReasoning } from "./EducationalAnalysis";
import { MathematicalNotation } from "./MathematicalNotation";

interface SynthesisResultProps {
  readonly result: ThirdNormalFormSynthesisResponseDto;
  readonly snapshot: SchemaInputDto;
}

export function SynthesisResult({ result, snapshot }: SynthesisResultProps) {
  const lookup = new Map(snapshot.relation.attributes.map((attribute) => [attribute.id, attribute.name]));
  const explanation = buildThirdNormalFormSynthesisExplanation(result, snapshot);

  return (
    <section className="transformation-result" aria-labelledby="synthesis-result-heading">
      <h5 id="synthesis-result-heading">3NF synthesis</h5>
      <ol className="relation-result-list">
        {result.relations.map((relation, index) => (
          <li key={`${relation.attributes.join(":")}:${index}`}>
            <span className="relation-result-label">Relation {index + 1}</span>
            <MathematicalNotation value={{ kind: "attribute-set", ids: relation.attributes }} lookup={lookup} />
            <span className="relation-source">{synthesizedRelationSourceLabel(relation.source)}</span>
          </li>
        ))}
      </ol>

      {result.addedCandidateKey !== null ? (
        <div className="candidate-key-addition">
          <strong>Additional candidate-key relation</strong>
          <MathematicalNotation value={{ kind: "attribute-set", ids: result.addedCandidateKey }} lookup={lookup} />
          <p>No synthesized relation contained a candidate key, so the synthesis added a relation containing this candidate key.</p>
        </div>
      ) : null}

      <details className="result-disclosure educational-disclosure">
        <summary>Why were these relations created?</summary>
        <div className="educational-disclosure__content">
          <p><Content tokens={explanation.summary} lookup={lookup} /></p>
          <p>{result.addedCandidateKey === null
            ? "No additional candidate-key relation was required."
            : "The response identifies the additional candidate-key relation shown above."}</p>
        </div>
      </details>

      <details className="result-disclosure">
        <summary>Minimal cover used</summary>
        <p>This is the minimal cover used as the basis for the synthesis.</p>
        {result.minimalCover.length === 0 ? <code>∅</code> : (
          <div className="notation-list">
            {result.minimalCover.map((dependency, index) => <MathematicalNotation key={`${dependency.left.join(":")}:${dependency.right.join(":")}:${index}`} value={{ kind: "functional-dependency", dependency }} lookup={lookup} />)}
          </div>
        )}
      </details>

      <div className="guarantee-note">
        <strong>Guaranteed by this algorithm</strong>
        <p>Final relations are in 3NF by construction · Dependency preserving · Lossless join</p>
      </div>
      <details className="result-disclosure formal-reasoning-disclosure">
        <summary>Formal reasoning</summary>
        <TransformationReasoning explanation={explanation} lookup={lookup} />
      </details>
    </section>
  );
}
