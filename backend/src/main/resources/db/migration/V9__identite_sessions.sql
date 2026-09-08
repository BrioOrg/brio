-- Audit log only — not the session store (in-memory HttpSession, or Redis when triggered).
-- Append-only; rows are never deleted on logout, only on retention-policy expiry.
CREATE TABLE identite.sessions (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    compte_id       UUID        NOT NULL,   -- identite.comptes ID (no cross-schema FK per ADR 0007)
    cree_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    expire_at       TIMESTAMPTZ NOT NULL,
    ip_tronquee     VARCHAR(32),            -- last octet stripped for IPv4; last 64 bits for IPv6
    user_agent_hash VARCHAR(64)             -- SHA-256 hex, never stored in clear
);
