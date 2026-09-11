import type { AnalysisResponseDto, SchemaInputDto } from "../../../api/schemawise-contracts";
import type { ContentToken, EducationalExplanation, FormalReasoningContent } from "../../explanations/educational-content";
import { buildCandidateKeyExplanation, buildEmptyPrimeAttributesExplanation, buildMinimalCoverExplanation, buildPrimeAttributeExplanation } from "../../explanations/explanation-builders";
import { MathematicalNotation } from "./MathematicalNotation";

interface EducationalResultProps {
  readonly result: AnalysisResponseDto;
  readonly snapshot: SchemaInputDto;
  readonly lookup: ReadonlyMap<string, string>;
}

function Content({ tokens, lookup }: { readonly tokens: readonly ContentToken[]; readonly lookup: ReadonlyMap<string, string> }) {
  return tokens.map((token, index) => token.kind === "text"
    ? <span key={index}>{token.value}</span>
    : <MathematicalNotation key={index} value={token} lookup={lookup} />);
}

function FormalReasoning({ content, lookup }: { readonly content: FormalReasoningContent; readonly lookup: ReadonlyMap<string, string> }) {
  return (
    <details className="formal-reasoning">
      <summary>Formal reasoning</summary>
      <div className="formal-reasoning__content">
        <p><strong>Rule.</strong> <Content tokens={content.rule} lookup={lookup} /></p>
        <p className="formal-reasoning__label"><strong>Evidence.</strong></p>
        <ul>
          {content.evidence.map((fact, index) => <li key={index}><Content tokens={fact.content} lookup={lookup} /></li>)}
        </ul>
        <p><strong>Conclusion.</strong> <Content tokens={content.conclusion} lookup={lookup} /></p>
      </div>
    </details>
  );
}

function Explanation({ explanation, lookup }: { readonly explanation: EducationalExplanation; readonly lookup: ReadonlyMap<string, string> }) {
  return (
    <div className="educational-explanation">
      <p><Content tokens={explanation.summary} lookup={lookup} /></p>
      {explanation.formal ? <FormalReasoning content={explanation.formal} lookup={lookup} /> : null}
    </div>
  );
}

export function CandidateKeysResult({ result, snapshot, lookup }: EducationalResultProps) {
  const explanations = result.candidateKeys.map((key) => buildCandidateKeyExplanation(key, result.candidateKeys.length, snapshot));
  return (
    <div className="key-fact">
      <h3>Candidate keys</h3>
      {result.candidateKeys.length === 0 ? <p className="empty-result">No candidate keys were returned.</p> : (
        <div className="notation-list">
          {result.candidateKeys.map((key, index) => <MathematicalNotation key={`${key.join(":")}:${index}`} value={{ kind: "attribute-set", ids: key }} lookup={lookup} />)}
        </div>
      )}
      <details className="educational-disclosure">
        <summary>Why {result.candidateKeys.length === 1 ? "is this a candidate key" : "are these candidate keys"}?</summary>
        <div className="educational-disclosure__content">
          <p>A candidate key is a minimal set of attributes that functionally determines every attribute in the relation.</p>
          {explanations.map((explanation, index) => <Explanation key={`${result.candidateKeys[index]?.join(":")}:${index}`} explanation={explanation} lookup={lookup} />)}
          {result.candidateKeys.length === 0 ? <p>The response contains an empty list of candidate keys. This is different from a candidate key that is the empty set.</p> : null}
        </div>
      </details>
    </div>
  );
}

export function PrimeAttributesResult({ result, lookup }: EducationalResultProps) {
  const explanations = result.primeAttributes.map((id) => buildPrimeAttributeExplanation(id, result.candidateKeys));
  const emptyExplanation = result.primeAttributes.length === 0 ? buildEmptyPrimeAttributesExplanation(result.candidateKeys) : undefined;
  return (
    <div className="key-fact">
      <h3>Prime attributes</h3>
      <MathematicalNotation value={{ kind: "attribute-set", ids: result.primeAttributes }} lookup={lookup} />
      <details className="educational-disclosure">
        <summary>Why {result.primeAttributes.length === 1 ? "is this attribute prime" : "are these attributes prime"}?</summary>
        <div className="educational-disclosure__content">
          <p>A prime attribute belongs to at least one candidate key.</p>
          {explanations.map((explanation, index) => <Explanation key={`${result.primeAttributes[index]}:${index}`} explanation={explanation} lookup={lookup} />)}
          {emptyExplanation ? <Explanation explanation={emptyExplanation} lookup={lookup} /> : null}
        </div>
      </details>
    </div>
  );
}

export function MinimalCoverResult({ result, lookup }: EducationalResultProps) {
  const explanation = buildMinimalCoverExplanation(result.minimalCover);
  return (
    <section className="analysis-section" aria-labelledby="minimal-cover-heading">
      <h3 id="minimal-cover-heading">Minimal cover</h3>
      {result.minimalCover.length === 0 ? <MathematicalNotation value={{ kind: "attribute-set", ids: [] }} lookup={lookup} /> : (
        <div className="notation-list">
          {result.minimalCover.map((dependency, index) => (
            <MathematicalNotation key={`${dependency.left.join(":")}:${dependency.right.join(":")}:${index}`} value={{ kind: "functional-dependency", dependency }} lookup={lookup} />
          ))}
        </div>
      )}
      <details className="educational-disclosure">
        <summary>Why is this a minimal cover?</summary>
        <div className="educational-disclosure__content">
          <Explanation explanation={explanation} lookup={lookup} />
        </div>
      </details>
    </section>
  );
}
