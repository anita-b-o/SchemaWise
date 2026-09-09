# Password security v1

Status: accepted design; no password library is installed by this document.

## Input policy

V1 accepts passphrases from 12 through 128 Unicode code points, inclusive. It
does not require uppercase letters, digits, symbols or mixtures of character
classes. Spaces and non-ASCII characters are allowed.

Passwords are interpreted exactly as supplied. The server does not trim,
case-fold, Unicode-normalize or silently truncate them. Values outside the range
are rejected as `400 INVALID_AUTH_REQUEST` before the hashing operation. The
HTTP body limit remains a separate transport defense. Breached-password lookup,
password strength scoring, reset and history are deferred.

The length range makes short guessing materially harder, supports memorable
passphrases and places a clear upper bound on hashing input and request abuse.
The UI may show guidance but the server policy is authoritative.

## Hash choice

Use Argon2id through the maintained `argon2` Node package. Argon2id is
memory-hard and combines resistance to data-dependent and data-independent
attacks. bcrypt is broadly deployed but has a 72-byte input trap and weaker
memory-hardness; scrypt is sound and available in Node core, but Argon2id
provides the preferred modern password-specific format and tuning model for this
service.

The repository declares Node `>=22`, matching the runtime floor required by
current `argon2` releases. CI and deployment must enforce that same supported
floor; the current local Node 22 runtime does not replace those checks. Pinning
an obsolete Argon2 package merely to retain Node 20 is not an acceptable
security trade.

Only a library-produced PHC-format Argon2id hash is persisted. It includes a
unique cryptographic salt and the algorithm version and work parameters. The
plaintext password is discarded after hashing and is never persisted. Login
uses the library verification operation; code does not compare derived strings
itself. Rehash-on-success may upgrade old parameters later.

## Parameter calibration

Final parameters must be benchmarked on the smallest production API instance
under expected concurrent login load; they must not be copied blindly from a
development laptop. The calibration target is approximately 100–250 ms per
verification while respecting the instance's concurrency and memory budget.

The initial benchmark candidate is:

```text
Argon2id v=19
memoryCost: 65536 KiB (64 MiB)
timeCost: 3
parallelism: 1
salt: 16 random bytes or more
hash: 32 bytes
```

This is a candidate baseline, not a frozen production value. Deployment
configuration may raise cost after measurement, but must enforce a reviewed
minimum and maximum so an attacker-controlled stored hash cannot demand
unbounded resources. Parameters are encoded in each hash, allowing gradual
rehash without a schema change.

## Verification and timing

For an existing user, login verifies against the stored hash. For an unknown
email, it verifies the supplied password against a valid dummy PHC hash created
with the deployed parameter class before returning the same
`INVALID_CREDENTIALS`. This prevents an immediate lookup-only path from making
account discovery trivial through timing. The dummy hash is configuration/code
data, not generated per request.

Rate limiting runs before expensive hashing. Verification errors and malformed
stored hashes fail closed and are reported as `AUTH_INTERNAL_ERROR`, not as a
credential distinction.

## Handling and observability

Auth request bodies must be redacted at the HTTP logger boundary. Passwords and
hashes must never appear in logs, traces, error details, analytics, metrics
labels, fixtures copied from real users or support tooling. Memory cannot be
perfectly erased in JavaScript, but references should be short-lived and never
retained in user/session domain objects beyond the hashing call.
