package fr.brio.identite;

import fr.brio.identite.domain.Compte;
import fr.brio.identite.infrastructure.CompteRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Service
public class CompteService {

    private final CompteRepository comptes;

    public CompteService(CompteRepository comptes) {
        this.comptes = comptes;
    }

    @Transactional(readOnly = true)
    public Optional<Compte> findById(UUID id) {
        return comptes.findById(id);
    }

    @Transactional
    public Compte save(Compte compte) {
        return comptes.save(compte);
    }
}
