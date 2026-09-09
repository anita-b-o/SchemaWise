export interface PersistedAttribute {
  readonly id: string;
  readonly name: string;
}

export interface PersistedRelation {
  readonly name: string;
  readonly attributes: readonly PersistedAttribute[];
}

export interface PersistedFunctionalDependency {
  readonly left: readonly string[];
  readonly right: readonly string[];
}

export interface PersistedSchema {
  readonly schemaVersion: 1;
  readonly relation: PersistedRelation;
  readonly functionalDependencies: readonly PersistedFunctionalDependency[];
}

export interface Project {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly schema: PersistedSchema;
  readonly revision: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ProjectSummary {
  readonly id: string;
  readonly name: string;
  readonly relationName: string;
  readonly attributeCount: number;
  readonly functionalDependencyCount: number;
  readonly revision: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ProjectReplacement {
  readonly name: string;
  readonly schema: PersistedSchema;
}

export interface NewProject extends ProjectReplacement {
  readonly id: string;
}
