import {
  Attribute,
  AttributeSet,
  FunctionalDependency,
  Relation,
  analyzeBoyceCoddNormalForm,
  analyzeDependencyPreservation,
  analyzeSecondNormalForm,
  analyzeThirdNormalForm,
  attributeClosure,
  decomposeToBoyceCoddNormalForm,
  findCandidateKeys,
  findMinimalCover,
  findPrimeAttributes,
  projectFunctionalDependencies,
  synthesizeThirdNormalForm,
} from "../dist/index.js";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const sizes = [6, 8, 10, 12];
const repetitions = 3;
const warmups = 1;
const childTimeoutMs = 250;
const operations = [
  ["closure", (relation, fds) => attributeClosure(relation.attributes, fds)],
  ["findCandidateKeys", (relation, fds) => findCandidateKeys(relation, fds)],
  ["analyzeThirdNormalForm", (relation, fds) => analyzeThirdNormalForm(relation, fds)],
  ["analyzeBoyceCoddNormalForm", (relation, fds) => analyzeBoyceCoddNormalForm(relation, fds)],
  ["projectFunctionalDependencies", (relation, fds) => projectFunctionalDependencies(relation, fds, relation.attributes)],
  ["synthesizeThirdNormalForm", (relation, fds) => synthesizeThirdNormalForm(relation, fds)],
  ["decomposeToBoyceCoddNormalForm", (relation, fds) => decomposeToBoyceCoddNormalForm(relation, fds)],
  ["analyzeDependencyPreservation", (relation, fds, decomposition) => analyzeDependencyPreservation(relation, fds, decomposition)],
  ["analysis-aggregate", (relation, fds) => {
    findCandidateKeys(relation, fds);
    findPrimeAttributes(relation, fds);
    findMinimalCover(relation, fds);
    analyzeSecondNormalForm(relation, fds);
    analyzeThirdNormalForm(relation, fds);
    analyzeBoyceCoddNormalForm(relation, fds);
  }],
];
const primitiveOperations = operations.slice(0, -1);

function makeAttributes(size) {
  return Array.from({ length: size }, (_, index) => Attribute.create(`a${index}`, `A${index}`));
}

function fd(attributes, left, right) {
  return FunctionalDependency.create(
    new AttributeSet(left.map((index) => attributes[index])),
    new AttributeSet(right.map((index) => attributes[index])),
  );
}

function scenario(family, size) {
  const attributes = makeAttributes(size);
  const relation = Relation.create(`R_${family}_${size}`, new AttributeSet(attributes));
  const dependencies = [];

  if (family === "chain") {
    for (let index = 0; index < size - 1; index += 1) dependencies.push(fd(attributes, [index], [index + 1]));
  } else if (family === "cycle") {
    const cycleSize = Math.min(3, size);
    for (let index = 0; index < cycleSize; index += 1) dependencies.push(fd(attributes, [index], [(index + 1) % cycleSize]));
    for (let index = cycleSize; index < size - 1; index += 1) dependencies.push(fd(attributes, [index], [index + 1]));
  } else if (family === "multiple-keys") {
    const targets = Array.from({ length: size - 2 }, (_, index) => index + 2);
    dependencies.push(fd(attributes, [0, 1], targets), fd(attributes, [0, 2], targets), fd(attributes, [1, 2], targets));
  } else if (family === "composite") {
    for (let index = 2; index < size; index += 1) dependencies.push(fd(attributes, [0, 1], [index]));
    for (let index = 3; index < size; index += 1) dependencies.push(fd(attributes, [1, 2], [index]));
    for (let index = 4; index < size; index += 1) dependencies.push(fd(attributes, [0, 2], [index]));
  } else if (family === "dense") {
    const max = Math.min(40, size * (size - 1));
    for (let leftSize = 1; leftSize <= 2 && dependencies.length < max; leftSize += 1) {
      for (let start = 0; start < size && dependencies.length < max; start += 1) {
        const left = leftSize === 1 ? [start] : [start, (start + 1) % size];
        const right = (start + leftSize + 1) % size;
        if (!left.includes(right)) dependencies.push(fd(attributes, left, [right]));
      }
    }
  }

  const decomposition = [];
  for (let index = 0; index < size - 1; index += 1) decomposition.push(new AttributeSet([attributes[index], attributes[index + 1]]));
  decomposition.push(new AttributeSet([attributes[size - 1]]));
  return { relation, dependencies, decomposition };
}

function measure(operation, family, size) {
  const output = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--worker", family, size, operation[0]], {
    encoding: "utf8", timeout: childTimeoutMs, maxBuffer: 1024 * 1024,
  });
  if (output.error?.code === "ETIMEDOUT" || output.signal === "SIGTERM") return { status: "exceeded-benchmark-window", windowMs: childTimeoutMs };
  if (output.status !== 0) return { status: "failed", detail: output.stderr.trim().slice(0, 200) };
  return JSON.parse(output.stdout);
}

if (process.argv[2] === "--worker") {
  const [, , , family, rawSize, operationName] = process.argv;
  const size = Number(rawSize);
  const { relation, dependencies, decomposition } = scenario(family, size);
  const operation = operations.find(([name]) => name === operationName);
  const run = operation?.[1];
  if (run === undefined) throw new Error(`Unknown operation ${operationName}`);
  for (let index = 0; index < warmups; index += 1) run(relation, dependencies, decomposition);
  const samples = [];
  for (let index = 0; index < repetitions; index += 1) {
    const start = process.hrtime.bigint(); run(relation, dependencies, decomposition);
    samples.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  samples.sort((left, right) => left - right);
  console.log(JSON.stringify({ minMs: samples[0], medianMs: samples[1], maxMs: samples[2] }));
  process.exit(0);
}

const rows = [];
for (const family of ["chain", "cycle", "composite", "multiple-keys", "dense"]) {
  for (const size of sizes) {
    const { relation, dependencies, decomposition } = scenario(family, size);
    for (const operation of primitiveOperations) {
      const result = measure(operation, family, size);
      rows.push({ family, attributes: size, fds: dependencies.length, operation: operation[0], ...result });
      console.log(JSON.stringify(rows.at(-1)));
    }
  }
}

// These are deliberately called as part of the aggregate estimate, not timed as
// a new public operation. The sequence mirrors the future /analysis use case.
for (const family of ["chain", "multiple-keys", "dense"]) {
  for (const size of sizes) {
    const result = measure(["analysis-aggregate"], family, size);
    console.log(JSON.stringify({ family, attributes: size, fds: scenario(family, size).dependencies.length, operation: "analysis-aggregate", ...result }));
  }
}
