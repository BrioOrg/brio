package fr.brio.identite.infrastructure;

import fr.brio.identite.domain.CodeClasse;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface CodeClasseRepository extends JpaRepository<CodeClasse, UUID> {

    Optional<CodeClasse> findByCodeHash(String codeHash);

    Optional<CodeClasse> findByClasseId(UUID classeId);

    void deleteByClasseId(UUID classeId);
}
