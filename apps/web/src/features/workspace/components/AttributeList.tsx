import { useEffect, useRef, useState } from "react";
import type { AttributeDraft } from "../workspace-reducer";
import type { ValidationIssue } from "../workspace-validation";

interface AttributeListProps {
  readonly attributes: readonly AttributeDraft[];
  readonly dependencyReferenceCounts: ReadonlyMap<string, number>;
  readonly issues: readonly ValidationIssue[];
  readonly onAdd: (attribute: AttributeDraft) => void;
  readonly onRename: (id: string, name: string) => void;
  readonly onRemove: (id: string) => void;
}

const MAX_ATTRIBUTES = 6;

function createAttribute(): AttributeDraft {
  return { id: `attr_${crypto.randomUUID()}`, name: "" };
}

export function AttributeList({ attributes, dependencyReferenceCounts, issues, onAdd, onRename, onRemove }: AttributeListProps) {
  const [pendingRemoval, setPendingRemoval] = useState<string>();
  const [newAttributeId, setNewAttributeId] = useState<string>();
  const [touchedIds, setTouchedIds] = useState<ReadonlySet<string>>(() => new Set());
  const newestInput = useRef<HTMLInputElement>(null);
  const atLimit = attributes.length >= MAX_ATTRIBUTES;

  useEffect(() => {
    if (newAttributeId && attributes.some((attribute) => attribute.id === newAttributeId)) {
      newestInput.current?.focus();
      setNewAttributeId(undefined);
    }
  }, [attributes, newAttributeId]);

  function addAttribute() {
    const attribute = createAttribute();
    setNewAttributeId(attribute.id);
    onAdd(attribute);
  }

  function requestRemoval(attribute: AttributeDraft) {
    const references = dependencyReferenceCounts.get(attribute.id) ?? 0;
    if (references === 0) {
      onRemove(attribute.id);
      return;
    }
    setPendingRemoval(attribute.id);
  }

  return (
    <section className="editor-section" aria-labelledby="attributes-heading">
      <div className="section-heading section-heading--counted">
        <div>
          <p className="section-number" aria-hidden="true">02</p>
          <h2 id="attributes-heading">Attributes</h2>
        </div>
        <p className="section-count">{attributes.length} / {MAX_ATTRIBUTES}</p>
      </div>

      {attributes.length === 0 ? <p className="empty-note">Add the columns that belong to this relation.</p> : null}
      <div className="attribute-list">
        {attributes.map((attribute, index) => {
          const issue = issues.find((candidate) => candidate.field === `attribute:${attribute.id}`);
          const error = touchedIds.has(attribute.id) || attribute.name.length > 0 ? issue : undefined;
          const errorId = `attribute-${attribute.id}-error`;
          const references = dependencyReferenceCounts.get(attribute.id) ?? 0;
          const isPending = pendingRemoval === attribute.id;
          const displayName = attribute.name.trim() || `Attribute ${index + 1}`;
          return (
            <div className="attribute-row" key={attribute.id}>
              <div className="attribute-row__controls">
                <div className="field attribute-name-field">
                  <label className="visually-hidden" htmlFor={`attribute-${attribute.id}`}>Attribute {index + 1} name</label>
                  <input
                    ref={newAttributeId === attribute.id ? newestInput : undefined}
                    id={`attribute-${attribute.id}`}
                    type="text"
                    maxLength={120}
                    value={attribute.name}
                    aria-describedby={error ? errorId : undefined}
                    aria-invalid={error ? "true" : undefined}
                    placeholder={`Attribute ${index + 1} name`}
                    onChange={(event) => onRename(attribute.id, event.target.value)}
                    onBlur={() => setTouchedIds((current) => new Set(current).add(attribute.id))}
                  />
                  {error ? <p className="field-error" id={errorId} role="alert">{error.message}</p> : null}
                </div>
                <button className="button button--quiet button--danger" type="button" onClick={() => requestRemoval(attribute)} aria-label={`Remove attribute ${displayName}`}>Remove</button>
              </div>
              <details className="advanced-details">
                <summary>Advanced</summary>
                <div className="technical-id">
                  <label htmlFor={`attribute-id-${attribute.id}`}>Technical ID</label>
                  <input id={`attribute-id-${attribute.id}`} type="text" readOnly value={attribute.id} />
                </div>
              </details>
              {isPending ? (
                <div className="inline-confirmation" role="alert" aria-label={`Confirm removal of ${displayName}`}>
                  <p>Removing “{displayName}” will also remove {references} {references === 1 ? "dependency" : "dependencies"}.</p>
                  <div className="button-row">
                    <button className="button button--secondary" type="button" onClick={() => setPendingRemoval(undefined)}>Cancel</button>
                    <button className="button button--danger-solid" type="button" onClick={() => { onRemove(attribute.id); setPendingRemoval(undefined); }}>Remove attribute</button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <button className="button button--secondary add-button" type="button" onClick={addAttribute} disabled={atLimit}>Add attribute</button>
      {atLimit ? <p className="limit-note" role="status">The 6 attribute limit has been reached.</p> : null}
    </section>
  );
}
