import { performance } from "node:perf_hooks";
import { cpus } from "node:os";
import { Argon2idPasswordHasher, ARGON2ID_PARAMETERS } from "../dist/auth/crypto/argon2id-password-hasher.js";

const SAMPLE_COUNT = 7;
const password = "SchemaWise benchmark passphrase 🔐";
const hasher = new Argon2idPasswordHasher();

async function duration(operation) {
  const start = performance.now();
  await operation();
  return performance.now() - start;
}

function summary(samples) {
  const sorted = [...samples].sort((left, right) => left - right);
  return { min: sorted[0], median: sorted[Math.floor(sorted.length / 2)], max: sorted.at(-1) };
}

async function sample(operation) {
  const samples = [];
  for (let index = 0; index < SAMPLE_COUNT; index += 1) samples.push(await duration(operation));
  return summary(samples);
}

const verificationHash = await hasher.hash(password);
await hasher.hash(password);
await hasher.verify(verificationHash, password);
await hasher.verify(verificationHash, `${password}!`);
await hasher.dummyVerify(password);

const results = {
  hash: await sample(() => hasher.hash(password)),
  "verify success": await sample(() => hasher.verify(verificationHash, password)),
  "verify failure": await sample(() => hasher.verify(verificationHash, `${password}!`)),
  dummyVerify: await sample(() => hasher.dummyVerify(password)),
};

console.log(`Node ${process.version}`);
console.log(`CPU ${cpus()[0]?.model ?? "unknown"}`);
console.log(`Parameters ${JSON.stringify(ARGON2ID_PARAMETERS)}`);
console.log(`Samples ${SAMPLE_COUNT} after one warm-up per operation`);
console.table(Object.fromEntries(Object.entries(results).map(([name, values]) => [name, {
  "min ms": values.min.toFixed(2),
  "median ms": values.median.toFixed(2),
  "max ms": values.max.toFixed(2),
}])));
