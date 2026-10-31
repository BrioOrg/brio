package fr.brio.social.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Le seul endpoint qui répond quand la Communauté est désactivée : il dit au serveur web s'il doit
 * afficher l'onglet (ADR 0035 §10). Hors de {@code /api/communaute}, où rien ne doit répondre, et
 * public : un booléen, que le serveur web lit sans avoir à transmettre de session.
 */
@RestController
@Tag(name = "Communauté")
class ReglageCommunauteController {

    private final boolean active;

    ReglageCommunauteController(@Value("${brio.communaute.active:false}") boolean active) {
        this.active = active;
    }

    @GetMapping(value = "/api/reglages/communaute", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Savoir si la Communauté est active")
    ReglageCommunaute lire() {
        return new ReglageCommunaute(active);
    }
}
