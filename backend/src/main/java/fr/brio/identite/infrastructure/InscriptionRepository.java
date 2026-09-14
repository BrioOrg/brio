package fr.brio.identite.infrastructure;

import fr.brio.identite.domain.Inscription;
import fr.brio.identite.domain.InscriptionId;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InscriptionRepository extends JpaRepository<Inscription, InscriptionId> {}
