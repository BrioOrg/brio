package fr.brio.identite.infrastructure;

import fr.brio.identite.domain.Rattachement;
import fr.brio.identite.domain.RattachementId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RattachementRepository extends JpaRepository<Rattachement, RattachementId> {

    List<Rattachement> findByIdCompteId(UUID compteId);
}
