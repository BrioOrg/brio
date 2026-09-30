-- An adult account's e-mail is now a login (#184): it must identify a single account.
-- Case-insensitive, and only where an e-mail exists (élève accounts carry none).

CREATE UNIQUE INDEX comptes_email_unique
    ON identite.comptes (lower(email))
    WHERE email IS NOT NULL;
