# Evidence formats

## `aesrun/v1`

Private encrypted JSON bundle. Top-level fields identify the workspace, run, creation time, KDF parameters, wrapped key, and encrypted compressed payload. It is safe to upload only after encryption succeeds; it is not a public report.

## `aesreport/v1`

Sanitized public JSON report containing a report ID, run ID, title, concise summary, claim verdicts, and source title/URL/publisher triples. Provider evidence, source excerpts, memory state, event payloads, secrets, and signer data are excluded.

Public report creation requires a redaction preview and explicit confirmation. A share record can be revoked; revocation must also delete the public storage object.
