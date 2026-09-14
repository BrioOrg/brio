package fr.brio.identite.web;

import fr.brio.identite.ClasseService;
import fr.brio.identite.api.CreerEtablissementRequest;
import fr.brio.identite.api.EtablissementInfo;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/etablissements")
class EtablissementController {

    private final ClasseService classeService;

    EtablissementController(ClasseService classeService) {
        this.classeService = classeService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    EtablissementInfo creer(@Valid @RequestBody CreerEtablissementRequest req) {
        return classeService.creerEtablissement(
                req.nom(), req.uai(), req.type(),
                req.conventionSigneeLe(), req.conventionReference());
    }
}
