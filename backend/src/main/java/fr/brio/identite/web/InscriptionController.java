package fr.brio.identite.web;

import fr.brio.identite.CompteService;
import fr.brio.identite.api.CompteInfo;
import fr.brio.identite.api.InscriptionEleveEnAttenteInfo;
import fr.brio.identite.api.InscriptionEleveRequest;
import fr.brio.identite.api.InscriptionEnseignantRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
class InscriptionController {

    private final CompteService compteService;

    InscriptionController(CompteService compteService) {
        this.compteService = compteService;
    }

    @PostMapping("/comptes")
    ResponseEntity<CompteInfo> inscrireEnseignant(@RequestBody @Valid InscriptionEnseignantRequest req) {
        CompteInfo created = compteService.creerEnseignant(
                req.identifiantConnexion(),
                req.motDePasse(),
                req.nom(),
                req.email());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PostMapping("/comptes/eleve")
    ResponseEntity<InscriptionEleveEnAttenteInfo> inscrireEleve(
            @RequestBody @Valid InscriptionEleveRequest req) {
        InscriptionEleveEnAttenteInfo created = compteService.inscrireEleve(
                req.niveauDeclare(), req.motDePasse(), req.emailParent());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}
