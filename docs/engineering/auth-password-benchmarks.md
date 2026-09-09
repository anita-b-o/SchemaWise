# Authentication password benchmark

Measured on 2026-09-09 with Node v22.22.1 on an AMD Ryzen 7 7735HS. The
isolated development benchmark performs one warm-up of each operation followed
by seven sequential samples. It is not part of the unit-test suite.

Run it with:

```sh
npm run bench:auth --workspace @schemawise/api
```

## Parameters and result

The initial candidate remained inside the approximate 100–250 ms target, so it
was retained without adjustment: Argon2id v19, 65,536 KiB (64 MiB), time cost
3, parallelism 1, 32-byte hash and 16-byte random salt.

| Operation | Min (ms) | Median (ms) | Max (ms) |
| --- | ---: | ---: | ---: |
| hash | 153.87 | 168.41 | 173.70 |
| verify success | 146.20 | 164.34 | 188.28 |
| verify failure (existing user, wrong password) | 153.61 | 169.53 | 192.62 |
| dummyVerify (nonexistent email path) | 155.69 | 162.40 | 175.24 |

The invalid-login observations both executed Argon2id and had similar medians;
there was no order-of-magnitude lookup-only timing gap. This is an observation,
not a constant-time guarantee or an SLA.

Production must recalibrate on the smallest deployed API hardware, including
expected concurrent authentication load and its aggregate memory budget.
Recalibration is also required whenever instance hardware or runtime changes.
