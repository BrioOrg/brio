package fr.brio.contenu.web;

import fr.brio.contenu.ContenuService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@Tag(name = "Contenu", description = "Accès aux chapitres de cours")
class ChapitreController {

    private final ContenuService contenuService;

    ChapitreController(ContenuService contenuService) {
        this.contenuService = contenuService;
    }

    @GetMapping(value = "/chapitres/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
            summary = "Récupère un chapitre par identifiant",
            description = "Retourne le contenu du chapitre. Les réponses correctes des exercices ne sont jamais incluses."
    )
    @ApiResponse(responseCode = "200", description = "Chapitre trouvé")
    @ApiResponse(responseCode = "404", description = "Chapitre introuvable")
    ResponseEntity<Object> getChapitre(@PathVariable String id) {
        return contenuService.findChapitre(id)
                .<ResponseEntity<Object>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
