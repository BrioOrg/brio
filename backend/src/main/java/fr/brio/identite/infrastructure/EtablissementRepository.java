package fr.brio.identite.infrastructure;

import fr.brio.identite.domain.Etablissement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface EtablissementRepository extends JpaRepository<Etablissement, UUID> {}
