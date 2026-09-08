package fr.brio.identite.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

interface SessionAuditRepository extends JpaRepository<SessionAudit, UUID> {}
