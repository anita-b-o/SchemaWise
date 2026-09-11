export type ConceptId =
  | "functional-dependency"
  | "determinant"
  | "attribute-closure"
  | "superkey"
  | "candidate-key"
  | "primary-key"
  | "prime-attribute"
  | "partial-dependency"
  | "transitive-dependency"
  | "minimal-cover"
  | "1nf"
  | "2nf"
  | "3nf"
  | "bcnf"
  | "lossless-join"
  | "dependency-preservation";

export interface ConceptDefinition {
  readonly id: ConceptId;
  readonly term: string;
  readonly definition: string;
  readonly optionalNote?: string;
}

export const CONCEPT_DEFINITIONS: readonly ConceptDefinition[] = [
  { id: "functional-dependency", term: "Functional dependency", definition: "A constraint stating that equal determinant values require equal values for the dependent attributes." },
  { id: "determinant", term: "Determinant", definition: "The attribute set on the left side of a functional dependency." },
  { id: "attribute-closure", term: "Attribute closure", definition: "All attributes functionally determined by a starting attribute set under the functional dependencies." },
  { id: "superkey", term: "Superkey", definition: "An attribute set whose closure contains every attribute in the relation." },
  { id: "candidate-key", term: "Candidate key", definition: "A minimal superkey: it determines every attribute in the relation, and no proper subset does.", optionalNote: "SchemaWise discovers candidate keys; it does not select a primary key." },
  { id: "primary-key", term: "Primary key", definition: "One candidate key selected by database design as the principal key.", optionalNote: "SchemaWise does not select a primary key." },
  { id: "prime-attribute", term: "Prime attribute", definition: "An attribute that belongs to at least one candidate key.", optionalNote: "Prime does not mean primary-key attribute." },
  { id: "partial-dependency", term: "Partial dependency", definition: "A dependency in which a non-prime attribute depends on a proper subset of a candidate key." },
  { id: "transitive-dependency", term: "Transitive dependency", definition: "A dependency in which an attribute depends on another attribute through an intermediate determinant.", optionalNote: "SchemaWise applies the formal 3NF rule rather than using this label as a general 3NF test." },
  { id: "minimal-cover", term: "Minimal cover", definition: "An equivalent set of functional dependencies with singleton right sides, no extraneous left-side attributes, and no redundant dependencies." },
  { id: "1nf", term: "First normal form (1NF)", definition: "A condition requiring relation values to be atomic within the chosen relational model.", optionalNote: "SchemaWise assumes 1NF; it does not calculate it from functional dependencies." },
  { id: "2nf", term: "Second normal form (2NF)", definition: "Under the 1NF assumption, a relation is in 2NF when no non-prime attribute depends on a proper subset of a candidate key." },
  { id: "3nf", term: "Third normal form (3NF)", definition: "A relation is in 3NF when, for every non-trivial functional dependency, the determinant is a superkey or every dependent attribute is prime." },
  { id: "bcnf", term: "Boyce–Codd normal form (BCNF)", definition: "A relation is in BCNF when every determinant of a non-trivial functional dependency is a superkey.", optionalNote: "Unlike 3NF, BCNF has no prime-attribute exception." },
  { id: "lossless-join", term: "Lossless join", definition: "A decomposition is lossless when joining the decomposed relations reconstructs the original relation without introducing spurious information." },
  { id: "dependency-preservation", term: "Dependency preservation", definition: "A decomposition preserves dependencies when the original constraints can be enforced through dependencies on the decomposed relations without joining them.", optionalNote: "Not preserved does not mean that data was lost; lossless join is a separate property." },
];

export const CONCEPT_DEFINITIONS_BY_ID: Readonly<Record<ConceptId, ConceptDefinition>> = Object.fromEntries(
  CONCEPT_DEFINITIONS.map((definition) => [definition.id, definition]),
) as Record<ConceptId, ConceptDefinition>;
