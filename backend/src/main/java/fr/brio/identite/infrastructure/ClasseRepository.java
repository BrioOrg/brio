package fr.brio.identite.infrastructure;

import fr.brio.identite.domain.Classe;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ClasseRepository extends JpaRepository<Classe, UUID> {}
