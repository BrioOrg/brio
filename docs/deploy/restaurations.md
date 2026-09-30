# Restore log

ADR 0024 §7: a backup is only proven by a restore. Every restore performed on the
private environment to prove the backups work is recorded here, newest first.
Procedure: [README.md § 11](README.md#11-the-dated-restore-).

| Date | Snapshot restored | What was checked | Result | By |
|---|---|---|---|---|
| 2026-09-30 | `avant-restauration-20260930-095806.dump` | A second student account created after the snapshot can no longer log in; the first student account (signup with parental consent through Mailpit) still logs in. | OK | Pierce |
