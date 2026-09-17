# Schema visualization presentation model v1.3

## Boundary

The model is ephemeral and pure:

```text
typed response DTO + immutable analyzed snapshot (+ current draft for Schema mode)
                                  ↓
                         presentation builder
                                  ↓
                       semantic HTML/CSS diagram
```

It is not persisted, sent to the API or stored in the workspace reducer. It contains no mathematical derivation.

## Implemented models

- `RelationDiagramModel`: relation label, ordered attribute nodes and entered dependencies.
- `AnalysisDiagramModel`: the relation model plus returned candidate keys, returned prime membership and exact 2NF/3NF/BCNF violation records.
- `SynthesisDiagramModel`: original relation, returned relations, their returned `source`, and `addedCandidateKey`.
- `BcnfDiagramModel`: final relations and ordered returned split steps (`source`, `violation`, result pair).
- `PreservationDiagramModel`: checked status and returned lost dependencies.

`DiagramDependency` retains `left` and `right` as attribute sets. A composite LHS is never flattened. `[]` remains the explicit empty determinant. Draft dependencies retain an RHS with multiple IDs; violation evidence uses the DTO's single `dependent` field.

## Permitted presentation operations

- map IDs to historical snapshot names;
- preserve DTO order;
- label items by array position;
- membership for key/prime/highlight styling;
- equality of attribute sets to label a BCNF source as the original relation;
- select, mute and highlight already-known evidence.

## Prohibited operations

The builders do not calculate attribute closure, superkeys, candidate keys, prime attributes, minimal covers, normal forms, FD projection, 3NF synthesis, BCNF decomposition, dependency preservation, `F+` or lossless join. Guarantees shown in the UI reuse the existing contractual copy; they are not described as diagram verification.

## Stale-state rule

- Schema mode receives the current draft snapshot and is explicitly labeled `Draft schema`.
- Analysis and Transformations receive only `analysis.inputSnapshot` and the responses generated from it.
- Editing the draft cannot rename or remove nodes in historical analysis/transformation diagrams.

## Selection

Violation selection is local to `AnalysisResults`. It synchronizes the existing textual violation item and analysis diagram without changing the mathematical reducer or project dirty state. Candidate-key and BCNF-step selections stay local to their respective diagram components.
