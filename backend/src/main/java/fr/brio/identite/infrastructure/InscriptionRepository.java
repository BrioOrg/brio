package fr.brio.identite.infrastructure;

import fr.brio.identite.domain.Inscription;
import fr.brio.identite.domain.InscriptionId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface InscriptionRepository extends JpaRepository<Inscription, InscriptionId> {
    List<Inscription> findByIdClasseId(UUID classeId);

    List<Inscription> findByIdCompteId(UUID compteId);
}
