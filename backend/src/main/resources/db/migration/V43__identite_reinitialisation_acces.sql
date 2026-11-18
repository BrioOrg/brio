-- Teacher-led access reset of a student's existing account (ADR 0036, #364).
-- The server replaces the password hash with the hash of a one-time provisional password,
-- valid 7 days; the student must choose their own password at the first login.

ALTER TABLE identite.comptes
    ADD COLUMN doit_changer_mot_de_passe          BOOLEAN     NOT NULL DEFAULT false,
    -- When the provisional password stops working (reset time + 7 days).
    ADD COLUMN mot_de_passe_provisoire_expire_le  TIMESTAMPTZ,
    -- Set at the first successful login with it, by a conditional UPDATE: single use.
    ADD COLUMN mot_de_passe_provisoire_utilise_le TIMESTAMPTZ,
    -- The last reset, kept after the change so the student is told about it (ADR 0036 §8):
    -- when, and by which kind of adult. Never the adult's identity (that is in the audit trail).
    ADD COLUMN acces_reinitialise_le              TIMESTAMPTZ,
    ADD COLUMN acces_reinitialise_par             TEXT,
    ADD CONSTRAINT provisoire_date
        CHECK (NOT doit_changer_mot_de_passe OR mot_de_passe_provisoire_expire_le IS NOT NULL),
    ADD CONSTRAINT acces_reinitialise_par_valeur
        CHECK (acces_reinitialise_par IS NULL OR acces_reinitialise_par IN ('enseignant', 'admin_brio'));

-- Audit trail of resets, also the counter of their rate limit. Never the password, its hash,
-- nor the student's IP. IDs only (no FK to other tables, as elsewhere in identite — ADR 0007).
CREATE TABLE identite.reinitialisations_acces (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    compte_id     UUID        NOT NULL,   -- the student whose access was reset
    par_compte_id UUID        NOT NULL,   -- the adult (teacher or admin_brio) who reset it
    classe_id     UUID,                   -- the class through which the teacher was allowed;
                                          -- NULL for an admin_brio reset outside any class
    cree_le       TIMESTAMPTZ NOT NULL DEFAULT now(),
    expire_le     TIMESTAMPTZ NOT NULL
);

CREATE INDEX reinitialisations_acces_par_compte ON identite.reinitialisations_acces (par_compte_id, cree_le);
CREATE INDEX reinitialisations_acces_compte ON identite.reinitialisations_acces (compte_id, cree_le);
