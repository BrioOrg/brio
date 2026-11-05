package fr.brio.identite.infrastructure;

import fr.brio.identite.api.ProfilEleve;
import fr.brio.identite.api.ProfilsElevesQuery;
import fr.brio.identite.domain.RoleCompte;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class ProfilsElevesQueryImpl implements ProfilsElevesQuery {

    private final CompteRepository comptes;
    private final InscriptionRepository inscriptions;

    ProfilsElevesQueryImpl(CompteRepository comptes, InscriptionRepository inscriptions) {
        this.comptes = comptes;
        this.inscriptions = inscriptions;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, ProfilEleve> profils(Set<UUID> compteIds) {
        if (compteIds.isEmpty()) {
            return Map.of();
        }
        // Most recent class first, so the first level kept is the one CompteInfo shows.
        Map<UUID, String> niveauxDeClasse = new HashMap<>();
        for (InscriptionRepository.NiveauDeClasse n : inscriptions.niveauxDesClassesActives(compteIds)) {
            niveauxDeClasse.putIfAbsent(n.getCompteId(), n.getNiveau());
        }
        return comptes.findAllById(compteIds).stream()
                .filter(c -> c.getRole() == RoleCompte.eleve)
                .collect(Collectors.toMap(
                        c -> c.getId(),
                        c -> new ProfilEleve(
                                c.getPseudonyme(),
                                niveauxDeClasse.getOrDefault(c.getId(), c.getNiveauDeclare()))));
    }
}
