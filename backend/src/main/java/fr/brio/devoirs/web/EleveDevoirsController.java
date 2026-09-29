package fr.brio.devoirs.web;

import fr.brio.devoirs.ControleActif;
import fr.brio.devoirs.DevoirEleveVue;
import fr.brio.devoirs.DevoirService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Les devoirs de l'élève connecté, avec le statut de son rendu (F4). */
@RestController
@RequestMapping("/api/devoirs")
@Tag(name = "Devoirs", description = "Les devoirs de l'élève connecté (F4)")
class EleveDevoirsController {

    private final DevoirService devoirs;

    EleveDevoirsController(DevoirService devoirs) {
        this.devoirs = devoirs;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Liste les devoirs de l'élève connecté, avec le statut de son rendu")
    @ApiResponse(responseCode = "200", description = "Devoirs de l'élève")
    @ApiResponse(responseCode = "401", description = "Authentification requise")
    List<DevoirEleveVue> mesDevoirs(Authentication auth) {
        return devoirs.listerPourEleve(UUID.fromString(auth.getName()));
    }

    @GetMapping(value = "/controle-actif", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Le contrôle en cours de l'élève (pour verrouiller le tuteur), le cas échéant")
    @ApiResponse(responseCode = "200", description = "Contrôle actif (ou aucun)")
    @ApiResponse(responseCode = "401", description = "Authentification requise")
    ControleActif controleActif(Authentication auth) {
        return devoirs.controleActif(UUID.fromString(auth.getName()));
    }
}
