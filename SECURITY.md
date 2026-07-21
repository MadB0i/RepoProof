# Security Policy

## Local-Only Design

RepoProof is designed to be **100% local-first**. All analysis is performed on your machine using static pattern matching. RepoProof does **not**:

- Send your source code or repository contents anywhere
- Make network requests or API calls during scanning
- Collect telemetry, usage data, or analytics
- Phone home or communicate with any external service

The only network-adjacent operation is the `$schema` URL in configuration files, which is used for IDE validation and is entirely optional.

## Reporting a Vulnerability

If you discover a security vulnerability in RepoProof, please report it by [opening an issue](https://github.com/anomalyco/repoproof/issues). We will respond promptly and work to address verified vulnerabilities.

Please do **not** submit vulnerabilities involving hardcoded secrets found by RepoProof in your own repositories — that is the intended function of the tool. Instead, remove those secrets and rotate any compromised credentials.

## Supported Versions

| Version      | Supported |
| ------------ | --------- |
| 1.x (latest) | ✅        |
| < 1.0        | ❌        |

## Safe Harbor

We consider security research and responsible disclosure to be protected activity. If you report a vulnerability in good faith, we will not pursue legal action.
