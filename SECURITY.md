# Security

`agent-which` is a local CLI. It does not call external APIs, execute instruction files, or upload repository content.

## Reporting

Please report security issues by opening a private advisory on GitHub when available, or by contacting the maintainer directly.

## Scope

Security-relevant issues include:

- reading files outside the requested repository root
- executing untrusted workspace content
- leaking environment variables or secret values

Instruction quality and prompt-injection detection are out of scope for this tool.
