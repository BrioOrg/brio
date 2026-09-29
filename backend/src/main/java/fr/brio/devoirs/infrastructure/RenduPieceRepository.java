package fr.brio.devoirs.infrastructure;

import fr.brio.devoirs.domain.RenduPiece;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RenduPieceRepository extends JpaRepository<RenduPiece, UUID> {

    List<RenduPiece> findByRenduIdOrderByOrdreAsc(UUID renduId);

    int countByRenduId(UUID renduId);
}
