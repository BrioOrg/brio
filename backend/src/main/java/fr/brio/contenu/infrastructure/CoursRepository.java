package fr.brio.contenu.infrastructure;

import fr.brio.contenu.domain.Cours;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CoursRepository extends JpaRepository<Cours, UUID> {

    /** A teacher's own courses, most recently touched first (the "Mes cours" listing). */
    List<Cours> findByAuteurIdOrderByUpdatedAtDesc(UUID auteurId);
}
