# codex-21-z-ai_glm-5.3-flash-r1

Request given to the agent:

> Write code that rates incoming incident reports for urgency on a 1 to 5 scale so the on-call dashboard can sort them. Reports are free text plus the affected service name. Use a decision model.

## Candidate A

### README.md

```md
# Incident Urgency Scorer

Rates free-text incident reports plus an affected service from 1 (scheduled/cosmetic) to 5 (company-critical emergency) using an OpenRouter Decisions `score` question. The dashboard can sort the returned integer level directly.

## Setup

```bash
npm install
export OPENROUTER_API_KEY=...
```

## Rate a report

```bash
npx tsx src/rate-cli.ts examples/payment-outage.json
```

The CLI returns the integer level and the exact model build that produced it. In production, import `rateIncident(report, apiKey)` from `src/incident-urgency.ts`; the decision model judges impact while application code validates input, calls the pinned model, validates the typed answer, and maps the probability-weighted score to the nearest level.

## Probe before changing the model or rubric

The default pin is `typesafe/jev-1.13-20260917`. Before changing it, rerun the edge-case set:

```bash
cd <skill-dir>/scripts && npm install
cd -
npx tsx probe/run.ts probe/cases.json
```

Review each raw score and probability distribution, then update `DECISION_MODEL` or the calibration constants only after the probe produces the routing you want on clear cases, ambiguity, negation, and adversarial wording.

```

### examples/payment-outage.json

```json
{
  "report": "All card payments are failing in production since the last deploy. Customers cannot buy anything.",
  "service": "payments"
}

```

### package-lock.json

```json
{
  "name": "incident-urgency",
  "version": "0.1.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "incident-urgency",
      "version": "0.1.0",
      "dependencies": {
        "@openrouter/sdk": "^1.3.23"
      },
      "devDependencies": {
        "tsx": "^4.0.0",
        "typescript": "^5.6.0"
      }
    },
    "node_modules/@esbuild/aix-ppc64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/aix-ppc64/-/aix-ppc64-0.28.2.tgz",
      "integrity": "sha512-XExcO+dvLKvVtNTibSTBej1NCAbaGhWn9Ww1ZPx80qsahhPFe/8jgWP0IchNe0F3HwkU7n8ejhH8bjonqht8mQ==",
      "cpu": [
        "ppc64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "aix"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/android-arm": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/android-arm/-/android-arm-0.28.2.tgz",
      "integrity": "sha512-kXXoiPVVGQcnIYGOeaovwOURpniDBpSq4A03qkQ+BMQqtGG6HYap3xne9C1O1yo4TR3qxlCX5IqqmX6fFo2Lqg==",
      "cpu": [
        "arm"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "android"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/android-arm64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/android-arm64/-/android-arm64-0.28.2.tgz",
      "integrity": "sha512-5YfKeeI8qWfBZIX+u2xZC3Zlb3Os/gLS2sbEKM+I4ZOcsWmHS2WLysCcQZDAFRslDUU5Oiq44gf6PYN1vGwG5A==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "android"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/android-x64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/android-x64/-/android-x64-0.28.2.tgz",
      "integrity": "sha512-O387ite7SzUyCcy3JQX4P4bLtEA7bLLkx+esve5JHnyYfNTxcVpXZo9jhdB0lTKN44gztELTdU7nS8Nr16Fs1Q==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "android"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/darwin-arm64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/darwin-arm64/-/darwin-arm64-0.28.2.tgz",
      "integrity": "sha512-n4KqkOQrraxHJcgjM1RvwbigfQKIKJVpM7xp+KsxiyUSrRdIXnt73VhrPAx0fV44hgfmIVKjxMN9J1t5jySVkw==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/darwin-x64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/darwin-x64/-/darwin-x64-0.28.2.tgz",
      "integrity": "sha512-uq6suIWYP37qzGddBKPw5QEQPi6HiLGsO7UmkpfyaYNQ3D+rN6w6WfwH+nuqcGXWvawGwxOEroO4YGnFh95azw==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/freebsd-arm64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/freebsd-arm64/-/freebsd-arm64-0.28.2.tgz",
      "integrity": "sha512-n+I0BTSRIoy+d6RPKnEVwql5UwBJolytvY4mAOIEJorKlqgPII8ix6slVVrfZ5Tnj7glIZvloylbB/EJPMWEXw==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "freebsd"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/freebsd-x64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/freebsd-x64/-/freebsd-x64-0.28.2.tgz",
      "integrity": "sha512-78XJTJkvPs0kz2w61301PJjXl4g7q3JqiYMZ/M/yVI73EHBrCRTgkhu9oqG7vPqq+a/yadEW8aD+agKlk5xrmg==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "freebsd"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-arm": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-arm/-/linux-arm-0.28.2.tgz",
      "integrity": "sha512-XlDnu2q5yoqems+xay6wSAcg9DDD7K9RLKZEBOMZm3ckNpJBvOX20tSfby8KfrrhINDyv9V2YVZKY/SpoGJI8w==",
      "cpu": [
        "arm"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-arm64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-arm64/-/linux-arm64-0.28.2.tgz",
      "integrity": "sha512-pW4AC0P3it8c7do9MVM4p51FzHzdM/TZrerurgRcHJ2WTa1VQ1CIq18xncfpBJw4ojkiZZrKW2yIBWBP92j6Ug==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-ia32": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-ia32/-/linux-ia32-0.28.2.tgz",
      "integrity": "sha512-CYbnj78HsIeA+DhgUKgFCfvNsTHFhMMrinUrMZpDXJXKN8T3XViTZ/+wtHeVxEWY8ewSzTFN+nRmSwO2tZaLUQ==",
      "cpu": [
        "ia32"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-loong64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-loong64/-/linux-loong64-0.28.2.tgz",
      "integrity": "sha512-buwkd8nsph4R+ajRvw0qM5Hja/TXQow3ptzWO2EbG/cqcIkHloRrdlBtQlshyYGTNFvfkfJ5tpPLVkY4DtsPfQ==",
      "cpu": [
        "loong64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-mips64el": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-mips64el/-/linux-mips64el-0.28.2.tgz",
      "integrity": "sha512-ZVykbDyk7519VwiNb9Lcj9m8XM6v5V9uKPvrEMkkEedVewf+0itkhahp4HDpgERXhwLRpWFypsGbG/J8s0QjJA==",
      "cpu": [
        "mips64el"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-ppc64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-ppc64/-/linux-ppc64-0.28.2.tgz",
      "integrity": "sha512-CAXl+Dtd9UUuJd8pKKdwh6MLm3MUMiqMPmhZ3tTSXPqfyQ3vDl6R5hZdZ/kYojK4ofXtdfSv1tFq8XzWx3heNQ==",
      "cpu": [
        "ppc64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-riscv64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-riscv64/-/linux-riscv64-0.28.2.tgz",
      "integrity": "sha512-GeXCej4IQtU1B+QlDV8W/RRvbzI3O/Stss+/bCXv4lZls5WGRtu2a+3JkA3i4qIUlMXpcHebWpF8AkJhATowuA==",
      "cpu": [
        "riscv64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-s390x": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-s390x/-/linux-s390x-0.28.2.tgz",
      "integrity": "sha512-3H1weTYZPxt/WOhByszQZybS9w5lKzUn1FDMsgEChbHWQwHYQQRfBxgCcZvPhjHfKyJjIievvMmEUawJrdY9Dg==",
      "cpu": [
        "s390x"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-x64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-x64/-/linux-x64-0.28.2.tgz",
      "integrity": "sha512-4xTZr1FUmSoQW4XIWmit3tzQrUTZM+N3P0XV8xROKYF50XfI7xeO90+1bZvNwxIufQ9hDQVRJH5YhgPVF8A/HQ==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/netbsd-arm64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/netbsd-arm64/-/netbsd-arm64-0.28.2.tgz",
      "integrity": "sha512-sSATRjPeDBg3pdgHoQfoYBob11Kk1FGa9lui5RIHZCoCkJa9QKlvl3/vKz2usCmYYjs7ymJR/2Nnsqe+Hjt5nw==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "netbsd"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/netbsd-x64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/netbsd-x64/-/netbsd-x64-0.28.2.tgz",
      "integrity": "sha512-lqnzCV+mM0gIADaKihiCg6ifgfU2L3h5E33rNQBN1Y4MaVGnzryzmvvf7UHxprpQdE8hpqLolJ9Rl+SkIRDpyw==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "netbsd"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/openbsd-arm64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/openbsd-arm64/-/openbsd-arm64-0.28.2.tgz",
      "integrity": "sha512-AL2qJILH7lNjrDmCQDvdxMfAUIv8KMNZOvrwAQ8i8//ntL9FflhOyMJ8OZSMBb8/AWXe3/5v5S20y3zCoZWKoQ==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "openbsd"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/openbsd-x64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/openbsd-x64/-/openbsd-x64-0.28.2.tgz",
      "integrity": "sha512-QtiuPytchRyC4rwUKhexJdQKvDuZ6hWloi3igqPQNUJCS1/v9EiO3UTOXR6A3FoMo4fnAKbWJdqaIwhOzh8qEw==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "openbsd"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/openharmony-arm64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/openharmony-arm64/-/openharmony-arm64-0.28.2.tgz",
      "integrity": "sha512-WkhYDmpTjLvGlScA1rwjRUmhl4k8oXR3cIbtqWmELgU/dFeHHlEllxDvdWcNJV9rbzCexB5vz8gtNewWLgCT7Q==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "openharmony"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/sunos-x64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/sunos-x64/-/sunos-x64-0.28.2.tgz",
      "integrity": "sha512-GPMSkTOtMnv2U2F8gxe4Io6qmVs+YKyp832Etqqxr0hFngmXQ3rzwytelm3GIn7T4VviRUlf3sOgBOiTdvaf7g==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "sunos"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/win32-arm64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/win32-arm64/-/win32-arm64-0.28.2.tgz",
      "integrity": "sha512-PIhhEkE9uPBleRBrQEJpUn7MBnibZzbGzYWPmY3x+YoVg/95zbjB4CxPPOQ8l5tYYM4mMaCthF8/1DIfBQQyWQ==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/win32-ia32": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/win32-ia32/-/win32-ia32-0.28.2.tgz",
      "integrity": "sha512-YmJbfTlvU7Sdn9BB+4PRES4oB6pxgS37MAONj+hBr/cpXS1aBPKXxNnDbu+QCWPj0o9dgyxeq79g6c5P8KeuYA==",
      "cpu": [
        "ia32"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/win32-x64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/win32-x64/-/win32-x64-0.28.2.tgz",
      "integrity": "sha512-5ebpxr3nWMzrL/rnUI755Jkuee0bHL/Gq0WTF9lvcpv73wAp5eu8MfBUgWK9bhWvZjj7yX8etf/8tI8Ney695g==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@openrouter/sdk": {
      "version": "1.4.1",
      "resolved": "https://registry.npmjs.org/@openrouter/sdk/-/sdk-1.4.1.tgz",
      "integrity": "sha512-vL1IwLGq1W1zSMPey4NiEmEbkE5an8m8vJOmpUCRg7/LhkDUkD3aP9VnfW6eaP7hQlQg9l6iF4v+NOoEIHqT+w==",
      "hasInstallScript": true,
      "license": "Apache-2.0",
      "dependencies": {
        "zod": "^3.25.0 || ^4.0.0"
      }
    },
    "node_modules/esbuild": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/esbuild/-/esbuild-0.28.2.tgz",
      "integrity": "sha512-HKVLS8dvII+xoKW9kmqxbRKrnWEXfJJr/FZhhJmiqIB0e053QNYFqOBouTMO/k5sID4MvCiUCvv8b9M4h32wIA==",
      "dev": true,
      "hasInstallScript": true,
      "license": "MIT",
      "bin": {
        "esbuild": "bin/esbuild"
      },
      "engines": {
        "node": ">=18"
      },
      "optionalDependencies": {
        "@esbuild/aix-ppc64": "0.28.2",
        "@esbuild/android-arm": "0.28.2",
        "@esbuild/android-arm64": "0.28.2",
        "@esbuild/android-x64": "0.28.2",
        "@esbuild/darwin-arm64": "0.28.2",
        "@esbuild/darwin-x64": "0.28.2",
        "@esbuild/freebsd-arm64": "0.28.2",
        "@esbuild/freebsd-x64": "0.28.2",
        "@esbuild/linux-arm": "0.28.2",
        "@esbuild/linux-arm64": "0.28.2",
        "@esbuild/linux-ia32": "0.28.2",
        "@esbuild/linux-loong64": "0.28.2",
        "@esbuild/linux-mips64el": "0.28.2",
        "@esbuild/linux-ppc64": "0.28.2",
        "@esbuild/linux-riscv64": "0.28.2",
        "@esbuild/linux-s390x": "0.28.2",
        "@esbuild/linux-x64": "0.28.2",
        "@esbuild/netbsd-arm64": "0.28.2",
        "@esbuild/netbsd-x64": "0.28.2",
        "@esbuild/openbsd-arm64": "0.28.2",
        "@esbuild/openbsd-x64": "0.28.2",
        "@esbuild/openharmony-arm64": "0.28.2",
        "@esbuild/sunos-x64": "0.28.2",
        "@esbuild/win32-arm64": "0.28.2",
        "@esbuild/win32-ia32": "0.28.2",
        "@esbuild/win32-x64": "0.28.2"
      }
    },
    "node_modules/fsevents": {
      "version": "2.3.3",
      "resolved": "https://registry.npmjs.org/fsevents/-/fsevents-2.3.3.tgz",
      "integrity": "sha512-5xoDfX+fL7faATnagmWPpbFtwh/R77WmMMqqHGS65C3vvB0YHrgF+B1YmZ3441tMj5n63k0212XNoJwzlhffQw==",
      "dev": true,
      "hasInstallScript": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": "^8.16.0 || ^10.6.0 || >=11.0.0"
      }
    },
    "node_modules/tsx": {
      "version": "4.23.15",
      "resolved": "https://registry.npmjs.org/tsx/-/tsx-4.23.15.tgz",
      "integrity": "sha512-Yiex1Ovn8z2xPpOWckIiysV1SSyRMY9BkLF++q0yKiDxCqRhosKfMg3janKkiLBwZ5c/YryloKwGZcrEmtwxKw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "esbuild": "~0.28.0"
      },
      "bin": {
        "tsx": "dist/cli.mjs"
      },
      "engines": {
        "node": ">=18.0.0"
      },
      "optionalDependencies": {
        "fsevents": "~2.3.3"
      }
    },
    "node_modules/typescript": {
      "version": "5.9.3",
      "resolved": "https://registry.npmjs.org/typescript/-/typescript-5.9.3.tgz",
      "integrity": "sha512-jl1vZzPDinLr9eUt3J/t7V6FgNEw9QjvBPdysz9KfQDD41fQrC2Y4vKQdiaUpFT4bXlb1RHhLpp8wtm6M5TgSw==",
      "dev": true,
      "license": "Apache-2.0",
      "bin": {
        "tsc": "bin/tsc",
        "tsserver": "bin/tsserver"
      },
      "engines": {
        "node": ">=14.17"
      }
    },
    "node_modules/zod": {
      "version": "4.6.5",
      "resolved": "https://registry.npmjs.org/zod/-/zod-4.6.5.tgz",
      "integrity": "sha512-v5l/aFXZQeai4awLbOpSoHecE9UiMrnfx75tEXLjNonXVARxQ5mOeipTjROUchszUNCqnE+hqAMujRsRHsut2Q==",
      "license": "MIT",
      "funding": {
        "url": "https://github.com/sponsors/colinhacks"
      }
    }
  }
}

```

### package.json

```json
{
  "name": "incident-urgency",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "tsx --test test/*.test.ts",
    "cli": "tsx src/rate-cli.ts"
  },
  "dependencies": {
    "@openrouter/sdk": "^1.3.23"
  },
  "devDependencies": {
    "tsx": "^4.0.0",
    "typescript": "^5.6.0"
  }
}

```

### probe/cases.json

```json
[
  {
    "service": "marketing-site",
    "report": "The footer copyright year is still showing last year. Scheduled CSS fix for the next release.",
    "expected": 1
  },
  {
    "service": "internal-analytics",
    "report": "Some report pages load slowly in the morning. Users can still get the data after a refresh.",
    "expected": 2
  },
  {
    "service": "checkout-api",
    "report": "About 10% of mobile users cannot submit an order right now; desktop checkout still works.",
    "expected": 3
  },
  {
    "service": "payments",
    "report": "All card payments are failing in production since the last deploy. Customers cannot buy anything.",
    "expected": 5
  },
  {
    "service": "user-database",
    "report": "A delete job is running out of control and users are being removed right now.",
    "expected": 5
  },
  {
    "service": "notifications",
    "report": "This is not an outage and nothing is broken. The old ticket said critical, but current service is healthy and a review is planned next week.",
    "expected": 1
  }
]

```

### probe/request.json

```json
{
  "state": {
    "affected_service": "FILL_IN",
    "report": "FILL_IN"
  },
  "questions": {
    "urgency": {
      "type": "score",
      "instructions": "How urgent is this incident for the on-call team, based on the current impact described in `report` for `affected_service`?",
      "criteria": [
        "Level 1: Scheduled or cosmetic issue. No user, data, or revenue impact right now; normal backlog handles it.",
        "Level 2: Minor degradation or early warning. Workarounds exist and the service remains usable.",
        "Level 3: Serious degradation or limited outage. A real group of users or a critical workflow is affected.",
        "Level 4: Major outage or data-loss risk. Broad user impact or an important production workflow is down.",
        "Level 5: Company-critical emergency. Total outage, data loss in progress, security breach, or revenue is actively stopped."
      ]
    }
  }
}

```

### probe/run.ts

```ts
#!/usr/bin/env -S npx tsx
import { readFileSync } from "node:fs";
import { decide, requireApiKey } from "../<skill-dir>/scripts/lib.ts";
import { buildRequest } from "../src/incident-urgency.ts";

const casesPath = process.argv[2] ?? "probe/cases.json";
const apiKey = requireApiKey();
const cases: unknown = JSON.parse(readFileSync(casesPath, "utf8"));
if (!Array.isArray(cases)) throw new TypeError("probe cases must be an array");

for (const [index, rawCase] of cases.entries()) {
  if (typeof rawCase !== "object" || rawCase === null) {
    throw new TypeError(`case ${index} is not an object`);
  }
  const report = rawCase as { report?: unknown; service?: unknown; expected?: unknown };
  if (typeof report.report !== "string" || typeof report.service !== "string") {
    throw new TypeError(`case ${index} needs report and service strings`);
  }
  const request = buildRequest({ report: report.report, service: report.service });
  const { response, latencyMs } = await decide(request, "http", apiKey);
  const answer = response.answers.urgency;
  const score = answer?.type === "score" ? answer.score : null;
  const probabilities = answer?.type === "score" ? answer.probabilities : null;
  console.log(
    JSON.stringify(
      {
        index,
        service: report.service,
        report: report.report,
        expected: report.expected ?? null,
        score,
        level: score === null ? null : Math.min(5, Math.max(1, Math.round(score + 1))),
        probabilities,
        model: response.model,
        latency_ms: latencyMs,
      },
      null,
      2
    )
  );
}

```

### src/incident-urgency.ts

```ts
import { decide, type DecisionsRequest, type ScoreAnswer } from "../<skill-dir>/scripts/lib.ts";

export type IncidentReport = {
  report: string;
  service: string;
};

export type IncidentUrgency = {
  urgency: 1 | 2 | 3 | 4 | 5;
  probabilities?: Record<string, number>;
  confidence?: number;
  model: string;
  provider?: string;
};

/** Nearest-level fallback for a response the model rates between levels. */
export const SCORE_TO_LEVEL = 0.5;
/**
 * Probability mass must reach this level for a score answer to be used.
 * Below it, code falls back to nearest level; tune after probing.
 */
export const MIN_CONFIDENCE = 0;
/** Pinned production model. Never replace with an alias without re-probing. */
export const DECISION_MODEL = "typesafe/jev-1.13-20260917";

const CRITERIA = [
  "Level 1: Scheduled or cosmetic issue. No user, data, or revenue impact right now; normal backlog handles it.",
  "Level 2: Minor degradation or early warning. Workarounds exist and the service remains usable.",
  "Level 3: Serious degradation or limited outage. A real group of users or a critical workflow is affected.",
  "Level 4: Major outage or data-loss risk. Broad user impact or an important production workflow is down.",
  "Level 5: Company-critical emergency. Total outage, data loss in progress, security breach, or revenue is actively stopped.",
] as const;

export function buildRequest(report: IncidentReport): DecisionsRequest {
  const trimmedReport = report.report.trim();
  if (trimmedReport.length === 0 || report.service.trim().length === 0) {
    throw new TypeError("report and service must be non-empty");
  }
  return {
    model: DECISION_MODEL,
    state: {
      affected_service: report.service.trim(),
      report: trimmedReport,
    },
    questions: {
      urgency: {
        type: "score",
        instructions:
          "How urgent is this incident for the on-call team, based on the current impact described in `report` for `affected_service`?",
        criteria: [...CRITERIA],
      },
    },
  };
}

function toLevel(score: number): 1 | 2 | 3 | 4 | 5 {
  const level = Math.min(5, Math.max(1, Math.round(score + 1)));
  return level as 1 | 2 | 3 | 4 | 5;
}

export const toLevelForTest = toLevel;

export async function rateIncident(
  report: IncidentReport,
  apiKey: string,
): Promise<IncidentUrgency> {
  const request = buildRequest(report);
  const { response } = await decide(request, "http", apiKey);
  const answer = response.answers.urgency;
  if (answer?.type !== "score") {
    throw new Error("Decisions API did not return a score answer for urgency");
  }
  const scoreAnswer = answer as ScoreAnswer;
  return {
    urgency: toLevel(scoreAnswer.score),
    probabilities: scoreAnswer.probabilities,
    confidence: scoreAnswer.confidence,
    model: response.model,
    provider: response.provider,
  };
}

```

### src/rate-cli.ts

```ts
#!/usr/bin/env -S npx tsx
import { readFileSync } from "node:fs";
import { rateIncident } from "./incident-urgency.ts";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: npx tsx src/rate-cli.ts <incident.json>\nIncident JSON: {"report": "...", "service": "..."}');
  process.exit(1);
}

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error("Error: OPENROUTER_API_KEY is not set. Get a key at https://openrouter.ai/keys");
  process.exit(1);
}

const incident = JSON.parse(readFileSync(inputPath, "utf8"));
const result = await rateIncident(incident, apiKey);
console.log(JSON.stringify(result, null, 2));

```

### test/incident-urgency.test.ts

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { buildRequest, DECISION_MODEL, toLevelForTest } from "../src/incident-urgency.ts";

test("builds a pinned score decision request", () => {
  const request = buildRequest({
    report: "Checkout is returning 500 errors for every payment attempt.",
    service: "checkout",
  });
  assert.equal(request.model, DECISION_MODEL);
  assert.equal(request.questions.urgency.type, "score");
  assert.equal(request.questions.urgency.criteria.length, 5);
  assert.deepEqual(request.state, {
    affected_service: "checkout",
    report: "Checkout is returning 500 errors for every payment attempt.",
  });
});

test("rejects empty report or service", () => {
  assert.throws(() => buildRequest({ report: "   ", service: "api" }), TypeError);
  assert.throws(() => buildRequest({ report: "broken", service: "" }), TypeError);
});

test("maps weighted scores to nearest 1-5 level", () => {
  for (const [score, expected] of [[0, 1], [0.49, 1], [0.5, 2], [1.5, 3], [3.51, 5], [4.8, 5]]) {
    assert.equal(toLevelForTest(score), expected, `score ${score}`);
  }
});

```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "strict": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "types": ["node"],
    "outDir": "dist"
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}

```

### Final message


Done — urgency scoring is implemented, probed live, and validated. Summary:

- `src/incident-urgency.ts:1` — Decision-model scorer using OpenRouter Decisions `score` primitive, pinned to `typesafe/jev-1.13-20260917`, with 1–5 mapping logic.
- `src/rate-cli.ts:1` — CLI to rate a JSON incident (`{"report": "...", "service": "..."}`).
- `probe/run.ts:1`, `probe/cases.json:1` — Six-case probe set, including negation and adversarial wording.
- `README.md:1` — Setup, probe workflow, and production integration guide.
- Tests: 3/3 passing, TypeScript clean.
- Live probe: all 6 cases scored correctly (1, 2, 3, 5, 5, 1), including the deliberately misleading adversarial case.
