package fr.brio.identite.infrastructure;

import fr.brio.identite.domain.Inscription;
import fr.brio.identite.domain.InscriptionId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface InscriptionRepository extends JpaRepository<Inscription, InscriptionId> {
    List<Inscription> findByIdClasseId(UUID classeId);

    List<Inscription> findByIdCompteId(UUID compteId);

    /** Levels of a student's active classes, most recent class first. */
    @Query("""
            select c.niveauCode
            from Inscription i, Classe c
            where c.id = i.id.classeId
              and i.id.compteId = :compteId
              and i.roleDansClasse = 'eleve'
              and c.statut = fr.brio.identite.domain.StatutClasse.active
            order by c.createdAt desc
            """)
    List<String> niveauxDesClassesActives(@Param("compteId") UUID compteId);

    /** The same levels for several students at once, most recent class first for each. */
    @Query("""
            select i.id.compteId as compteId, c.niveauCode as niveau
            from Inscription i, Classe c
            where c.id = i.id.classeId
              and i.id.compteId in :compteIds
              and i.roleDansClasse = 'eleve'
              and c.statut = fr.brio.identite.domain.StatutClasse.active
            order by c.createdAt desc
            """)
    List<NiveauDeClasse> niveauxDesClassesActives(@Param("compteIds") Collection<UUID> compteIds);

    interface NiveauDeClasse {
        UUID getCompteId();

        String getNiveau();
    }
}
