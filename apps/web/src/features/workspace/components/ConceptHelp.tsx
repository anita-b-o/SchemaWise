import { useId, useState } from "react";
import { CONCEPT_DEFINITIONS, CONCEPT_DEFINITIONS_BY_ID, type ConceptId } from "../../explanations/concept-definitions";

interface ConceptHelpProps {
  readonly concept: ConceptId;
  readonly label?: string;
}

function ConceptDefinitionContent({ concept }: { readonly concept: ConceptId }) {
  const entry = CONCEPT_DEFINITIONS_BY_ID[concept];
  return (
    <>
      <strong>{entry.term}</strong>
      <p>{entry.definition}</p>
      {entry.optionalNote ? <p className="concept-help__note">{entry.optionalNote}</p> : null}
    </>
  );
}

export function ConceptHelp({ concept, label }: ConceptHelpProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const entry = CONCEPT_DEFINITIONS_BY_ID[concept];

  return (
    <div className="concept-help">
      <button
        className="concept-help__trigger"
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((current) => !current)}
      >
        {label ?? `What is ${entry.term}?`}
      </button>
      {open ? (
        <div className="concept-help__definition" id={id} role="region" aria-label={`${entry.term} definition`}>
          <ConceptDefinitionContent concept={concept} />
        </div>
      ) : null}
    </div>
  );
}

export function ConceptGlossary() {
  return (
    <section className="analysis-section concept-reference" aria-labelledby="concept-reference-heading">
      <details>
        <summary id="concept-reference-heading">Concept reference <span className="concept-reference__count">16 concepts</span></summary>
        <p className="section-help">Concise definitions for the terms used across analysis and tools.</p>
        <dl className="concept-reference__list">
          {CONCEPT_DEFINITIONS.map((entry) => (
            <div key={entry.id}>
              <dt>{entry.term}</dt>
              <dd>{entry.definition}{entry.optionalNote ? <span>{entry.optionalNote}</span> : null}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}
