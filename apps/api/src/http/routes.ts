import type { FastifyInstance } from "fastify";
import {
  analyzeDependencyPreservationUseCase,
  analyzeSchema,
  calculateClosure,
  decomposeBoyceCodd,
  synthesizeThirdNormalForm,
} from "../application/use-cases.js";
import type { DependencyPreservationRequestDto, SchemaAnalysisRequestDto } from "../contracts/dtos.js";

export interface HttpUseCases {
  readonly analyzeSchema: (input: SchemaAnalysisRequestDto) => unknown;
  readonly calculateClosure: (input: SchemaAnalysisRequestDto & { readonly attributes: readonly string[] }) => unknown;
  readonly synthesizeThirdNormalForm: (input: SchemaAnalysisRequestDto) => unknown;
  readonly decomposeBoyceCodd: (input: SchemaAnalysisRequestDto) => unknown;
  readonly analyzeDependencyPreservation: (input: DependencyPreservationRequestDto) => unknown;
}

export const defaultHttpUseCases: HttpUseCases = {
  analyzeSchema,
  calculateClosure,
  synthesizeThirdNormalForm,
  decomposeBoyceCodd,
  analyzeDependencyPreservation: analyzeDependencyPreservationUseCase,
};

export function registerRoutes(server: FastifyInstance, useCases: HttpUseCases = defaultHttpUseCases): void {
  server.post("/api/v1/analysis", async (request) => useCases.analyzeSchema(request.body as SchemaAnalysisRequestDto));
  server.post("/api/v1/closure", async (request) => useCases.calculateClosure(request.body as SchemaAnalysisRequestDto & { readonly attributes: readonly string[] }));
  server.post("/api/v1/synthesis/3nf", async (request) => useCases.synthesizeThirdNormalForm(request.body as SchemaAnalysisRequestDto));
  server.post("/api/v1/decomposition/bcnf", async (request) => useCases.decomposeBoyceCodd(request.body as SchemaAnalysisRequestDto));
  server.post("/api/v1/analysis/dependency-preservation", async (request) => useCases.analyzeDependencyPreservation(request.body as DependencyPreservationRequestDto));
}
