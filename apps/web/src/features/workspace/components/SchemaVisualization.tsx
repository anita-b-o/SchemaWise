import { useId, useState } from "react";
import type {
  AnalysisResponseDto,
  BcnfDecompositionResponseDto,
  DependencyPreservationResponseDto,
  SchemaInputDto,
  ThirdNormalFormSynthesisResponseDto,
} from "../../../api/schemawise-contracts";
import { formatAttributeSet, formatFunctionalDependency, formatRelation } from "../schema-formatters";
import {
  buildAnalysisDiagramModel,
  buildBcnfDiagramModel,
  buildPreservationDiagramModel,
  buildSchemaDiagramModel,
  buildSynthesisDiagramModel,
  type AnalysisDiagramModel,
  type BcnfStepModel,
  type DiagramDependency,
  type DiagramViolation,
  type RelationDiagramModel,
} from "../schema-visualization-model";
import type { TransformationState } from "../workspace-reducer";

export type VisualizationMode = "schema" | "analysis" | "transformations";

interface SchemaVisualizationProps {
  readonly result: AnalysisResponseDto;
  readonly draftSnapshot: SchemaInputDto;
  readonly analyzedSnapshot: SchemaInputDto;
  readonly outOfDate: boolean;
  readonly synthesis: TransformationState<ThirdNormalFormSynthesisResponseDto>;
  readonly bcnf: TransformationState<BcnfDecompositionResponseDto>;
  readonly preservation: TransformationState<DependencyPreservationResponseDto>;
  readonly open: boolean;
  readonly mode: VisualizationMode;
  readonly selectedViolationId?: string | undefined;
  readonly onToggle: () => void;
  readonly onModeChange: (mode: VisualizationMode) => void;
  readonly onSelectViolation: (id: string) => void;
}

function lookupFor(model: RelationDiagramModel): ReadonlyMap<string, string> {
  return new Map(model.attributes.map((attribute) => [attribute.id, attribute.label]));
}

function spokenSet(ids: readonly string[], lookup: ReadonlyMap<string, string>): string {
  if (ids.length === 0) return "the empty set";
  return ids.map((id) => lookup.get(id) ?? `unknown attribute ${id}`).join(", ");
}

function DependencyRail({ dependency, lookup, selected = false, onSelect }: {
  readonly dependency: DiagramDependency;
  readonly lookup: ReadonlyMap<string, string>;
  readonly selected?: boolean;
  readonly onSelect?: (() => void) | undefined;
}) {
  const content = (
    <>
      <span className="diagram-determinant">
        <span className="diagram-node-kind">Determinant</span>
        <code title={formatAttributeSet(dependency.left, lookup)}>{formatAttributeSet(dependency.left, lookup)}</code>
      </span>
      <span className="diagram-connector" aria-hidden="true"><span>────</span><span>▶</span></span>
      <span className="diagram-dependent">
        <span className="diagram-node-kind">Dependent{dependency.right.length === 1 ? "" : "s"}</span>
        <code title={formatAttributeSet(dependency.right, lookup)}>{formatAttributeSet(dependency.right, lookup)}</code>
      </span>
      {dependency.source === "violation" ? <span className="diagram-evidence-tag">Violation evidence</span> : null}
      {dependency.source === "lost" ? <span className="diagram-evidence-tag diagram-evidence-tag--lost">Lost dependency</span> : null}
      <span className="visually-hidden">
        Functional dependency: {spokenSet(dependency.left, lookup)} functionally determines {spokenSet(dependency.right, lookup)}.
      </span>
    </>
  );

  return onSelect ? (
    <button
      className={`dependency-rail dependency-rail--interactive${selected ? " dependency-rail--selected" : ""}${dependency.source === "lost" ? " dependency-rail--lost" : ""}`}
      type="button"
      aria-pressed={selected}
      aria-label={`Select ${formatFunctionalDependency(dependency, lookup)}`}
      onClick={onSelect}
    >
      {content}
    </button>
  ) : (
    <div className={`dependency-rail${selected ? " dependency-rail--selected" : ""}${dependency.source === "lost" ? " dependency-rail--lost" : ""}`}>
      {content}
    </div>
  );
}

function RelationDiagram({ model, label, description, selectedAttributes = [], mutedAttributes = [], determinant = [], dependent, dependencies = model.dependencies, selectedDependencyId, onSelectDependency }: {
  readonly model: RelationDiagramModel;
  readonly label: string;
  readonly description: string;
  readonly selectedAttributes?: readonly string[] | undefined;
  readonly mutedAttributes?: readonly string[] | undefined;
  readonly determinant?: readonly string[] | undefined;
  readonly dependent?: string | undefined;
  readonly dependencies?: readonly DiagramDependency[];
  readonly selectedDependencyId?: string | undefined;
  readonly onSelectDependency?: ((dependency: DiagramDependency) => void) | undefined;
}) {
  const headingId = useId();
  const descriptionId = useId();
  const lookup = lookupFor(model);
  const selected = new Set(selectedAttributes);
  const muted = new Set(mutedAttributes);
  const determinantIds = new Set(determinant);

  return (
    <section className="relation-diagram" aria-labelledby={headingId} aria-describedby={descriptionId}>
      <div className="diagram-title-row">
        <h4 id={headingId}>{label}</h4>
        <code>{model.relationName || "Unnamed relation"}</code>
      </div>
      <p id={descriptionId} className="diagram-description">{description}</p>
      <div className="relation-node" aria-label={`Relation ${model.relationName || "unnamed"}`}>
        <span className="relation-node__label">Relation</span>
        {model.attributes.length === 0 ? <p className="diagram-empty">No attributes in this relation.</p> : (
          <ul className="diagram-attributes" aria-label="Relation attributes">
            {model.attributes.map((attribute) => {
              const roles = [
                selected.has(attribute.id) ? "Key" : undefined,
                determinantIds.has(attribute.id) ? "Determinant" : undefined,
                dependent === attribute.id ? "Dependent" : undefined,
                attribute.prime ? "Prime" : undefined,
              ].filter(Boolean);
              return (
                <li
                  key={attribute.id}
                  className={`attribute-node${selected.has(attribute.id) ? " attribute-node--key" : ""}${determinantIds.has(attribute.id) ? " attribute-node--determinant" : ""}${dependent === attribute.id ? " attribute-node--dependent" : ""}${muted.has(attribute.id) ? " attribute-node--muted" : ""}`}
                  title={attribute.label}
                >
                  <span className="attribute-node__name">{attribute.label || "Unnamed attribute"}</span>
                  {roles.length > 0 ? <span className="attribute-node__roles">{roles.join(" · ")}</span> : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="dependency-diagram" aria-label="Functional dependencies">
        <h5>Functional dependencies</h5>
        {dependencies.length === 0 ? <p className="diagram-empty">No functional dependencies to display.</p> : (
          <ol className="dependency-rails">
            {dependencies.map((dependency) => (
              <li key={dependency.id}>
                <DependencyRail
                  dependency={dependency}
                  lookup={lookup}
                  selected={selectedDependencyId === dependency.id}
                  onSelect={onSelectDependency ? () => onSelectDependency(dependency) : undefined}
                />
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function SchemaMode({ snapshot, outOfDate }: { readonly snapshot: SchemaInputDto; readonly outOfDate: boolean }) {
  const model = buildSchemaDiagramModel(snapshot);
  return (
    <RelationDiagram
      model={model}
      label="Draft schema"
      description={`${outOfDate ? "Current draft, distinct from the historical analysis below. " : "Current draft. "}This input view keeps every entered dependency intact, including multi-attribute right-hand sides.`}
    />
  );
}

function AnalysisMode({ snapshot, result, selectedViolationId, onSelectViolation }: {
  readonly snapshot: SchemaInputDto;
  readonly result: AnalysisResponseDto;
  readonly selectedViolationId?: string | undefined;
  readonly onSelectViolation: (id: string) => void;
}) {
  const model = buildAnalysisDiagramModel(snapshot, result);
  const [selectedKeyId, setSelectedKeyId] = useState<string>();
  const selectedKey = model.candidateKeys.find((key) => key.id === selectedKeyId);
  const selectedViolation = model.violations.find((violation) => violation.id === selectedViolationId);
  const violationCandidateKey = selectedViolation?.normalForm === "2NF" ? selectedViolation.candidateKey : undefined;
  const selectedAttributes = selectedKey?.attributes ?? violationCandidateKey;
  const focusedIds = selectedKey?.attributes ?? (selectedViolation
    ? [...new Set([...(violationCandidateKey ?? selectedViolation.determinant), selectedViolation.dependent])]
    : []);
  const focused = new Set(focusedIds);
  const muted = focusedIds.length === 0 ? [] : model.attributes.filter((attribute) => !focused.has(attribute.id)).map((attribute) => attribute.id);
  const visibleDependencies = selectedViolation
    ? [selectedViolation.dependency]
    : model.dependencies;

  function chooseKey(id: string) {
    setSelectedKeyId((current) => current === id ? undefined : id);
  }

  function selectViolation(violation: DiagramViolation) {
    setSelectedKeyId(undefined);
    onSelectViolation(violation.id);
  }

  return (
    <div className="analysis-diagram-view">
      <div className="diagram-control-group" aria-label="Candidate keys">
        <span className="diagram-control-label">Candidate keys</span>
        {model.candidateKeys.length === 0 ? <span className="diagram-control-empty">None returned</span> : model.candidateKeys.map((key) => (
          <button key={key.id} type="button" className="diagram-choice" aria-pressed={selectedKeyId === key.id} onClick={() => chooseKey(key.id)}>
            Candidate key {formatAttributeSet(key.attributes, lookupFor(model))}
          </button>
        ))}
      </div>
      <div className="diagram-control-group" aria-label="Normal form violations">
        <span className="diagram-control-label">Violation evidence</span>
        {model.violations.length === 0 ? <span className="diagram-control-empty">No violations returned</span> : model.violations.map((violation) => (
          <button key={violation.id} type="button" className="diagram-choice" aria-pressed={selectedViolationId === violation.id} onClick={() => selectViolation(violation)}>
            {violation.normalForm}: {formatFunctionalDependency(violation.dependency, lookupFor(model))}
          </button>
        ))}
      </div>
      <RelationDiagram
        model={model}
        label="Analyzed schema"
        description="Historical analysis view. Candidate keys, prime attributes and violation evidence come directly from the analysis response."
        selectedAttributes={selectedAttributes}
        mutedAttributes={muted}
        determinant={selectedViolation?.determinant}
        dependent={selectedViolation?.dependent}
        dependencies={visibleDependencies}
        selectedDependencyId={selectedViolation?.dependency.id}
        onSelectDependency={selectedViolation ? () => onSelectViolation(selectedViolation.id) : undefined}
      />
      <div className="diagram-legend" aria-label="Diagram legend">
        <span><i className="legend-swatch legend-swatch--key" aria-hidden="true" /> Key selection</span>
        <span><i className="legend-swatch legend-swatch--prime" aria-hidden="true" /> Prime attribute (also labeled on the node)</span>
        <span><i className="legend-swatch legend-swatch--violation" aria-hidden="true" /> Selected violation evidence</span>
      </div>
      {selectedViolation?.normalForm === "2NF" ? (
        <p className="diagram-selection-summary">
          <strong>2NF evidence:</strong> candidate key {formatAttributeSet(selectedViolation.candidateKey ?? [], lookupFor(model))}; partial determinant {formatAttributeSet(selectedViolation.determinant, lookupFor(model))}; dependent non-prime attribute {lookupFor(model).get(selectedViolation.dependent) ?? selectedViolation.dependent}.
        </p>
      ) : selectedViolation ? (
        <p className="diagram-selection-summary"><strong>{selectedViolation.normalForm} evidence:</strong> determinant {formatAttributeSet(selectedViolation.determinant, lookupFor(model))}; dependent {lookupFor(model).get(selectedViolation.dependent) ?? selectedViolation.dependent}.</p>
      ) : null}
    </div>
  );
}

function RelationSetNode({ label, ids, lookup, annotation, active = false }: {
  readonly label: string;
  readonly ids: readonly string[];
  readonly lookup: ReadonlyMap<string, string>;
  readonly annotation?: string | undefined;
  readonly active?: boolean;
}) {
  return (
    <div className={`relation-set-node${active ? " relation-set-node--active" : ""}`}>
      <span>{label}</span>
      <code title={formatAttributeSet(ids, lookup)}>{formatAttributeSet(ids, lookup)}</code>
      {annotation ? <small>{annotation}</small> : null}
    </div>
  );
}

function SynthesisDiagram({ snapshot, result }: { readonly snapshot: SchemaInputDto; readonly result: ThirdNormalFormSynthesisResponseDto }) {
  const model = buildSynthesisDiagramModel(snapshot, result);
  const lookup = lookupFor(model.original);
  return (
    <section className="transformation-diagram" aria-label="3NF synthesis diagram">
      <h4>3NF synthesis</h4>
      <p className="diagram-description">One synthesis operation produces a set of relations; this is not a decomposition tree.</p>
      <RelationSetNode label="Original relation" ids={model.original.attributes.map((attribute) => attribute.id)} lookup={lookup} />
      <div className="transformation-arrow" aria-hidden="true">↓ <span>3NF synthesis</span></div>
      <p className="visually-hidden">The original relation is transformed by 3NF synthesis into the following relations.</p>
      <div className="synthesis-relations">
        {model.relations.map((relation, index) => (
          <RelationSetNode
            key={relation.id}
            label={`Relation ${index + 1}`}
            ids={relation.attributes}
            lookup={lookup}
            annotation={relation.source === "candidate-key" ? "Candidate-key source" : "Minimal-cover source"}
          />
        ))}
      </div>
      <p className="diagram-guarantee"><strong>Guaranteed by this algorithm:</strong> final relations are in 3NF by construction · Dependency preserving · Lossless join.</p>
    </section>
  );
}

function BcnfStep({ step, lookup, selected, onSelect }: {
  readonly step: BcnfStepModel;
  readonly lookup: ReadonlyMap<string, string>;
  readonly selected: boolean;
  readonly onSelect: () => void;
}) {
  return (
    <li>
      <button className={`bcnf-step${selected ? " bcnf-step--selected" : ""}`} type="button" aria-pressed={selected} onClick={onSelect}>
        <span className="bcnf-step__heading">Step {step.index + 1}</span>
        <RelationSetNode label={step.sourceIsOriginal ? "Original source" : "Source relation"} ids={step.source} lookup={lookup} active={selected} />
        <span className="bcnf-step__connector" aria-hidden="true">↓</span>
        <span className="bcnf-step__violation">Violation <code>{formatFunctionalDependency(step.violation, lookup)}</code></span>
        <span className="bcnf-step__branch" aria-hidden="true">┌────────┴────────┐</span>
        <span className="bcnf-step__results">
          <RelationSetNode label="Result one" ids={step.result[0]} lookup={lookup} active={selected} />
          <RelationSetNode label="Result two" ids={step.result[1]} lookup={lookup} active={selected} />
        </span>
        <span className="visually-hidden">Step {step.index + 1}: source {spokenSet(step.source, lookup)} is split using violating functional dependency {spokenSet(step.violation.left, lookup)} functionally determines {spokenSet(step.violation.right, lookup)}, producing relations {spokenSet(step.result[0], lookup)} and {spokenSet(step.result[1], lookup)}.</span>
      </button>
    </li>
  );
}

function BcnfDiagram({ snapshot, result }: { readonly snapshot: SchemaInputDto; readonly result: BcnfDecompositionResponseDto }) {
  const model = buildBcnfDiagramModel(snapshot, result);
  const lookup = lookupFor(model.original);
  const [selectedStepId, setSelectedStepId] = useState(model.steps[0]?.id);
  return (
    <section className="transformation-diagram" aria-label="BCNF decomposition diagram">
      <h4>BCNF decomposition</h4>
      <p className="diagram-description">Ordered split sequence from the response. Select one step to emphasize its source, violating dependency and two results.</p>
      {model.steps.length === 0 ? <p className="diagram-empty">No decomposition steps were returned.</p> : (
        <ol className="bcnf-step-list">
          {model.steps.map((step) => <BcnfStep key={step.id} step={step} lookup={lookup} selected={selectedStepId === step.id} onSelect={() => setSelectedStepId(step.id)} />)}
        </ol>
      )}
      <div className="diagram-final-relations">
        <strong>Final relations</strong>
        <div>{model.finalRelations.map((ids, index) => <RelationSetNode key={`${ids.join(":")}:${index}`} label={`Final ${index + 1}`} ids={ids} lookup={lookup} />)}</div>
      </div>
      <p className="diagram-guarantee"><strong>Lossless join</strong> is guaranteed by the decomposition algorithm. <strong>Dependency preservation</strong> is a separate checked property.</p>
    </section>
  );
}

function PreservationDiagram({ snapshot, result }: { readonly snapshot: SchemaInputDto; readonly result: DependencyPreservationResponseDto }) {
  const model = buildPreservationDiagramModel(result);
  const relation = buildSchemaDiagramModel(snapshot);
  return (
    <section className="transformation-diagram preservation-diagram" aria-label="Dependency preservation diagram">
      <h4>Dependency preservation</h4>
      <p className={`property-status ${model.preserved ? "property-status--positive" : "property-status--negative"}`}>{model.preserved ? "✓ Preserved" : "× Not preserved"}</p>
      {model.preserved ? <p className="diagram-description">The checked response reports no lost dependencies.</p> : (
        <RelationDiagram
          model={relation}
          label="Lost dependency evidence"
          description="These dependencies are reported as lost by the preservation response. The DTO does not identify a single responsible leaf relation. Lost dependency does not mean lost data."
          dependencies={model.lostDependencies}
        />
      )}
    </section>
  );
}

function TransformationsMode({ snapshot, synthesis, bcnf, preservation }: {
  readonly snapshot: SchemaInputDto;
  readonly synthesis: TransformationState<ThirdNormalFormSynthesisResponseDto>;
  readonly bcnf: TransformationState<BcnfDecompositionResponseDto>;
  readonly preservation: TransformationState<DependencyPreservationResponseDto>;
}) {
  const hasTransformations = Boolean(synthesis.data || bcnf.data || preservation.data);
  if (!hasTransformations) return <p className="diagram-empty-state">No transformation has been generated yet. Use the transformation actions below, then return to this view.</p>;
  return (
    <div className="transformation-diagrams">
      {synthesis.data ? <SynthesisDiagram snapshot={snapshot} result={synthesis.data} /> : <p className="diagram-empty-state">3NF synthesis has not been generated.</p>}
      {bcnf.data ? <BcnfDiagram snapshot={snapshot} result={bcnf.data} /> : <p className="diagram-empty-state">BCNF decomposition has not been generated.</p>}
      {preservation.data ? <PreservationDiagram snapshot={snapshot} result={preservation.data} /> : bcnf.data ? <p className="diagram-empty-state">Dependency preservation has not been checked.</p> : null}
    </div>
  );
}

export function SchemaVisualization({ result, draftSnapshot, analyzedSnapshot, outOfDate, synthesis, bcnf, preservation, open, mode, selectedViolationId, onToggle, onModeChange, onSelectViolation }: SchemaVisualizationProps) {
  const panelId = useId();
  const modes: readonly { id: VisualizationMode; label: string }[] = [
    { id: "schema", label: "Schema" },
    { id: "analysis", label: "Analysis" },
    { id: "transformations", label: "Transformations" },
  ];
  return (
    <section className="schema-visualization" aria-labelledby={`${panelId}-heading`}>
      <button className="schema-visualization__toggle" type="button" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
        <span><span className="eyebrow">Diagram</span><strong id={`${panelId}-heading`}>Visualize schema</strong></span>
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open ? (
        <div id={panelId} className="schema-visualization__content">
          <p className="schema-visualization__intro">A presentation of existing schema and analysis evidence. The diagram does not calculate normalization results.</p>
          <div className="diagram-mode-switch" role="group" aria-label="Diagram mode">
            {modes.map((item) => <button key={item.id} type="button" aria-pressed={mode === item.id} onClick={() => onModeChange(item.id)}>{item.label}</button>)}
          </div>
          <div className="diagram-mode-panel" aria-live="polite">
            {mode === "schema" ? <SchemaMode snapshot={draftSnapshot} outOfDate={outOfDate} /> : null}
            {mode === "analysis" ? <AnalysisMode snapshot={analyzedSnapshot} result={result} selectedViolationId={selectedViolationId} onSelectViolation={onSelectViolation} /> : null}
            {mode === "transformations" ? <TransformationsMode snapshot={analyzedSnapshot} synthesis={synthesis} bcnf={bcnf} preservation={preservation} /> : null}
          </div>
          {outOfDate && mode !== "schema" ? <p className="diagram-stale-note">Out of date: this diagram remains tied to {formatRelation(analyzedSnapshot)}, not the current draft.</p> : null}
        </div>
      ) : null}
    </section>
  );
}
