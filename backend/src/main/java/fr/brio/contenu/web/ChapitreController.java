package fr.brio.contenu.web;

import fr.brio.contenu.ChapitreRef;
import fr.brio.contenu.ContenuService;
import fr.brio.contenu.api.CatalogueNiveauDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.net.URI;
import java.util.List;
import org.springframework.http.HttpStatus;
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

    @GetMapping(value = "/catalogue", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
            summary = "Catalogue des chapitres publiés",
            description = "Retourne l'arbre complet niveau → matière → chapitres. Les données d'évaluation ne sont jamais incluses."
    )
    @ApiResponse(responseCode = "200", description = "Catalogue retourné")
    ResponseEntity<List<CatalogueNiveauDto>> getCatalogue() {
        return ResponseEntity.ok(contenuService.getCatalogue());
    }

    @GetMapping(value = "/chapitres/{niveau}/{matiere}/{slug}", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
            summary = "Récupère un chapitre par triplet niveau/matière/slug",
            description = "Retourne le contenu du chapitre. Les réponses correctes des exercices ne sont jamais incluses."
    )
    @ApiResponse(responseCode = "200", description = "Chapitre trouvé")
    @ApiResponse(responseCode = "404", description = "Chapitre introuvable")
    ResponseEntity<Object> getChapitreByTriplet(
            @PathVariable String niveau,
            @PathVariable String matiere,
            @PathVariable String slug) {
        return contenuService.findChapitreByTriplet(niveau, matiere, slug)
                .<ResponseEntity<Object>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping(value = "/chapitres/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
            summary = "Redirige vers le chemin canonique triplet (308)",
            description = "L'ancien endpoint par identifiant émet une redirection 308 permanente vers /api/chapitres/{niveau}/{matiere}/{slug}."
    )
    @ApiResponse(responseCode = "308", description = "Redirection permanente vers le chemin triplet")
    @ApiResponse(responseCode = "404", description = "Chapitre introuvable")
    ResponseEntity<Void> redirectChapitre(@PathVariable String id) {
        return contenuService.findChapitreRef(id)
                .map(ChapitreRef::toTripletUri)
                .<ResponseEntity<Void>>map(location -> ResponseEntity
                        .status(HttpStatus.PERMANENT_REDIRECT)
                        .location(location)
                        .build())
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
