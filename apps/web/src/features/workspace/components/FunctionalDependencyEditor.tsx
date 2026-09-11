import { useState } from "react";
import type { FunctionalDependencyDto } from "../../../api/schemawise-contracts";
import { formatFunctionalDependency } from "../schema-formatters";
import type { AttributeDraft } from "../workspace-reducer";
import { sameFunctionalDependency } from "../workspace-validation";

interface FunctionalDependencyEditorProps {
  readonly attributes: readonly AttributeDraft[];
  readonly dependencies: readonly FunctionalDependencyDto[];
  readonly onAdd: (dependency: FunctionalDependencyDto) => void;
  readonly onUpdate: (index: number, dependency: FunctionalDependencyDto) => void;
  readonly onRemove: (index: number) => void;
}

const MAX_DEPENDENCIES = 12;

interface ComposerState {
  readonly left: readonly string[];
  readonly right: readonly string[];
  readonly allowEmptyLeft: boolean;
  readonly allowEmptyRight: boolean;
  readonly editingIndex?: number;
}

const EMPTY_COMPOSER: ComposerState = { left: [], right: [], allowEmptyLeft: false, allowEmptyRight: false };

export function FunctionalDependencyEditor({ attributes, dependencies, onAdd, onUpdate, onRemove }: FunctionalDependencyEditorProps) {
  const [composer, setComposer] = useState<ComposerState>(EMPTY_COMPOSER);
  const [error, setError] = useState<string>();
  const lookup = new Map(attributes.map((attribute) => [attribute.id, attribute.name.trim() || "Unnamed attribute"]));
  const knownIds = new Set(attributes.map((attribute) => attribute.id));
  const left = composer.left.filter((id) => knownIds.has(id));
  const right = composer.right.filter((id) => knownIds.has(id));
  const atLimit = dependencies.length >= MAX_DEPENDENCIES && composer.editingIndex === undefined;

  function toggleSide(side: "left" | "right", id: string) {
    setError(undefined);
    setComposer((current) => {
      const selected = current[side];
      return { ...current, [side]: selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id] };
    });
  }

  function resetComposer() {
    setComposer(EMPTY_COMPOSER);
    setError(undefined);
  }

  function ordered(ids: readonly string[]) {
    const selected = new Set(ids);
    return attributes.filter((attribute) => selected.has(attribute.id)).map((attribute) => attribute.id);
  }

  function submitDependency() {
    if (left.length === 0 && !composer.allowEmptyLeft) {
      setError("Select at least one determinant, or allow an empty determinant in advanced options.");
      return;
    }
    if (right.length === 0 && !composer.allowEmptyRight) {
      setError("Select at least one dependent, or allow an empty dependent in advanced options.");
      return;
    }
    const dependency = { left: ordered(left), right: ordered(right) };
    const duplicate = dependencies.some((candidate, index) => index !== composer.editingIndex && sameFunctionalDependency(candidate, dependency));
    if (duplicate) {
      setError("This functional dependency already exists.");
      return;
    }
    if (composer.editingIndex === undefined) onAdd(dependency);
    else onUpdate(composer.editingIndex, dependency);
    resetComposer();
  }

  function editDependency(index: number) {
    const dependency = dependencies[index];
    if (!dependency) return;
    setComposer({ left: dependency.left, right: dependency.right, allowEmptyLeft: dependency.left.length === 0, allowEmptyRight: dependency.right.length === 0, editingIndex: index });
    setError(undefined);
  }

  return (
    <section className="editor-section" aria-labelledby="dependencies-heading">
      <div className="section-heading section-heading--counted">
        <div>
          <p className="section-number" aria-hidden="true">03</p>
          <h2 id="dependencies-heading">Functional dependencies</h2>
        </div>
        <p className="section-count">{dependencies.length} / {MAX_DEPENDENCIES}</p>
      </div>

      {dependencies.length > 0 ? (
        <ol className="dependency-list" aria-label="Defined functional dependencies">
          {dependencies.map((dependency, index) => {
            const notation = formatFunctionalDependency(dependency, lookup);
            return (
              <li key={`${dependency.left.join(".")}:${dependency.right.join(".")}:${index}`}>
                <code className="dependency-notation">{notation}</code>
                <div className="dependency-actions">
                  <button className="button button--quiet" type="button" onClick={() => editDependency(index)} aria-label={`Edit dependency ${notation}`}>Edit</button>
                  <button className="button button--quiet button--danger" type="button" onClick={() => onRemove(index)} aria-label={`Remove dependency ${notation}`} disabled={composer.editingIndex !== undefined}>Remove</button>
                </div>
              </li>
            );
          })}
        </ol>
      ) : <p className="empty-note">Describe how attribute values determine one another.</p>}

      <div className="dependency-composer" role="group" aria-labelledby="dependency-composer-heading">
        <div className="composer-heading">
          <h3 id="dependency-composer-heading">{composer.editingIndex === undefined ? "Add a dependency" : "Edit dependency"}</h3>
          <p>Select every attribute that belongs on each side.</p>
        </div>
        <div className="dependency-sides">
          <AttributeSide label="Determinant" side="left" attributes={attributes} selected={left} onToggle={toggleSide} />
          <span className="dependency-arrow" aria-hidden="true">→</span>
          <AttributeSide label="Dependent" side="right" attributes={attributes} selected={right} onToggle={toggleSide} />
        </div>

        <details className="advanced-options">
          <summary>Advanced dependency options</summary>
          <div className="advanced-options__controls">
            <label><input type="checkbox" checked={composer.allowEmptyLeft} onChange={(event) => { setError(undefined); setComposer((current) => ({ ...current, allowEmptyLeft: event.target.checked })); }} /> Allow empty determinant</label>
            <label><input type="checkbox" checked={composer.allowEmptyRight} onChange={(event) => { setError(undefined); setComposer((current) => ({ ...current, allowEmptyRight: event.target.checked })); }} /> Allow empty dependent</label>
          </div>
        </details>

        {error ? <p className="field-error composer-error" id="dependency-composer-error" role="alert">{error}</p> : null}
        {atLimit ? <p className="limit-note" id="dependency-limit" role="status">The 12 dependency limit has been reached. Edit or remove one to continue.</p> : null}
        <div className="button-row composer-actions">
          <button className="button button--primary" type="button" onClick={submitDependency} disabled={attributes.length === 0 || atLimit} aria-describedby={`${error ? "dependency-composer-error" : ""}${atLimit ? " dependency-limit" : ""}`.trim() || undefined}>{composer.editingIndex === undefined ? "Add dependency" : "Save changes"}</button>
          {composer.editingIndex !== undefined ? <button className="button button--secondary" type="button" onClick={resetComposer}>Cancel</button> : null}
        </div>
      </div>
    </section>
  );
}

interface AttributeSideProps {
  readonly label: string;
  readonly side: "left" | "right";
  readonly attributes: readonly AttributeDraft[];
  readonly selected: readonly string[];
  readonly onToggle: (side: "left" | "right", id: string) => void;
}

function AttributeSide({ label, side, attributes, selected, onToggle }: AttributeSideProps) {
  return (
    <fieldset className="attribute-selector">
      <legend>{label}</legend>
      {attributes.length === 0 ? <p>Add an attribute first.</p> : (
        <div className="attribute-options">
          {attributes.map((attribute, index) => {
            const displayName = attribute.name.trim() || `Attribute ${index + 1}`;
            return (
              <label key={attribute.id}>
                <input type="checkbox" checked={selected.includes(attribute.id)} onChange={() => onToggle(side, attribute.id)} />
                <span>{displayName}</span>
              </label>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
