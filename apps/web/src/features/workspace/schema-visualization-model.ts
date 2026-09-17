import type {
  AnalysisResponseDto,
  AttributeSetDto,
  BcnfDecompositionResponseDto,
  DependencyPreservationResponseDto,
  FunctionalDependencyDto,
  SchemaInputDto,
  SynthesizedRelationSource,
  ThirdNormalFormSynthesisResponseDto,
} from "../../api/schemawise-contracts";

export interface DiagramAttribute {
  readonly id: string;
  readonly label: string;
  readonly prime: boolean;
}

export interface DiagramDependency {
  readonly id: string;
  readonly left: AttributeSetDto;
  readonly right: AttributeSetDto;
  readonly source: "explicit" | "violation" | "lost";
  readonly violationId?: string;
}

export interface RelationDiagramModel {
  readonly relationName: string;
  readonly attributes: readonly DiagramAttribute[];
  readonly dependencies: readonly DiagramDependency[];
}

export interface DiagramCandidateKey {
  readonly id: string;
  readonly attributes: AttributeSetDto;
}

export type NormalFormKind = "2NF" | "3NF" | "BCNF";

export interface DiagramViolation {
  readonly id: string;
  readonly normalForm: NormalFormKind;
  readonly determinant: AttributeSetDto;
  readonly dependent: string;
  readonly candidateKey?: AttributeSetDto;
  readonly dependency: DiagramDependency;
}

export interface AnalysisDiagramModel extends RelationDiagramModel {
  readonly candidateKeys: readonly DiagramCandidateKey[];
  readonly violations: readonly DiagramViolation[];
}

export interface SynthesisRelationModel {
  readonly id: string;
  readonly attributes: AttributeSetDto;
  readonly source: SynthesizedRelationSource;
}

export interface SynthesisDiagramModel {
  readonly original: RelationDiagramModel;
  readonly relations: readonly SynthesisRelationModel[];
  readonly addedCandidateKey: AttributeSetDto | null;
}

export interface BcnfStepModel {
  readonly id: string;
  readonly index: number;
  readonly source: AttributeSetDto;
  readonly sourceIsOriginal: boolean;
  readonly violation: DiagramDependency;
  readonly result: readonly [AttributeSetDto, AttributeSetDto];
}

export interface BcnfDiagramModel {
  readonly original: RelationDiagramModel;
  readonly finalRelations: readonly AttributeSetDto[];
  readonly steps: readonly BcnfStepModel[];
}

export interface PreservationDiagramModel {
  readonly preserved: boolean;
  readonly lostDependencies: readonly DiagramDependency[];
}

function baseRelation(snapshot: SchemaInputDto, primeAttributes: AttributeSetDto = []): RelationDiagramModel {
  const prime = new Set(primeAttributes);
  return {
    relationName: snapshot.relation.name,
    attributes: snapshot.relation.attributes.map((attribute) => ({
      id: attribute.id,
      label: attribute.name,
      prime: prime.has(attribute.id),
    })),
    dependencies: snapshot.functionalDependencies.map((dependency, index) => dependencyModel(dependency, `explicit:${index}`, "explicit")),
  };
}

function dependencyModel(
  dependency: FunctionalDependencyDto,
  id: string,
  source: DiagramDependency["source"],
  violationId?: string,
): DiagramDependency {
  return {
    id,
    left: [...dependency.left],
    right: [...dependency.right],
    source,
    ...(violationId ? { violationId } : {}),
  };
}

function sameAttributeSet(left: AttributeSetDto, right: AttributeSetDto): boolean {
  if (left.length !== right.length) return false;
  const rightIds = new Set(right);
  return left.every((id) => rightIds.has(id));
}

export function violationSelectionId(normalForm: NormalFormKind, index: number): string {
  return `${normalForm.toLowerCase()}:${index}`;
}

export function buildSchemaDiagramModel(snapshot: SchemaInputDto): RelationDiagramModel {
  return baseRelation(snapshot);
}

export function buildAnalysisDiagramModel(snapshot: SchemaInputDto, result: AnalysisResponseDto): AnalysisDiagramModel {
  const relation = baseRelation(snapshot, result.primeAttributes);
  const violations: DiagramViolation[] = [];

  result.normalForms.second.violations.forEach((violation, index) => {
    const id = violationSelectionId("2NF", index);
    violations.push({
      id,
      normalForm: "2NF",
      candidateKey: [...violation.candidateKey],
      determinant: [...violation.determinant],
      dependent: violation.dependent,
      dependency: dependencyModel(
        { left: violation.determinant, right: [violation.dependent] },
        `violation:${id}`,
        "violation",
        id,
      ),
    });
  });
  result.normalForms.third.violations.forEach((violation, index) => {
    const id = violationSelectionId("3NF", index);
    violations.push({
      id,
      normalForm: "3NF",
      determinant: [...violation.determinant],
      dependent: violation.dependent,
      dependency: dependencyModel(
        { left: violation.determinant, right: [violation.dependent] },
        `violation:${id}`,
        "violation",
        id,
      ),
    });
  });
  result.normalForms.bcnf.violations.forEach((violation, index) => {
    const id = violationSelectionId("BCNF", index);
    violations.push({
      id,
      normalForm: "BCNF",
      determinant: [...violation.determinant],
      dependent: violation.dependent,
      dependency: dependencyModel(
        { left: violation.determinant, right: [violation.dependent] },
        `violation:${id}`,
        "violation",
        id,
      ),
    });
  });

  return {
    ...relation,
    candidateKeys: result.candidateKeys.map((attributes, index) => ({ id: `candidate-key:${index}`, attributes: [...attributes] })),
    violations,
  };
}

export function buildSynthesisDiagramModel(
  snapshot: SchemaInputDto,
  result: ThirdNormalFormSynthesisResponseDto,
): SynthesisDiagramModel {
  return {
    original: baseRelation(snapshot),
    relations: result.relations.map((relation, index) => ({
      id: `synthesis-relation:${index}`,
      attributes: [...relation.attributes],
      source: relation.source,
    })),
    addedCandidateKey: result.addedCandidateKey === null ? null : [...result.addedCandidateKey],
  };
}

export function buildBcnfDiagramModel(
  snapshot: SchemaInputDto,
  result: BcnfDecompositionResponseDto,
): BcnfDiagramModel {
  const originalIds = snapshot.relation.attributes.map((attribute) => attribute.id);
  return {
    original: baseRelation(snapshot),
    finalRelations: result.relations.map((relation) => [...relation.attributes]),
    steps: result.steps.map((step, index) => {
      const id = `bcnf-step:${index}`;
      return {
        id,
        index,
        source: [...step.source],
        sourceIsOriginal: sameAttributeSet(step.source, originalIds),
        violation: dependencyModel(
          { left: step.violation.determinant, right: [step.violation.dependent] },
          `bcnf-violation:${index}`,
          "violation",
        ),
        result: [[...step.result[0]], [...step.result[1]]],
      };
    }),
  };
}

export function buildPreservationDiagramModel(result: DependencyPreservationResponseDto): PreservationDiagramModel {
  return {
    preserved: result.preserved,
    lostDependencies: result.lostDependencies.map((dependency, index) => dependencyModel(dependency, `lost:${index}`, "lost")),
  };
}
