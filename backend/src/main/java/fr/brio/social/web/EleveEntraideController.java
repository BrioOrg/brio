package fr.brio.social.web;

import fr.brio.social.EntraideService;
import fr.brio.social.FilDetail;
import fr.brio.social.FilVue;
import fr.brio.social.NouveauFil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Entraide côté membre d'une classe (élève ou enseignant). ADR 0023. */
@RestController
@RequestMapping("/api/entraide")
@Tag(name = "Entraide", description = "Fils de question attachés à un chapitre ou un exercice")
class EleveEntraideController {

    private final EntraideService entraide;

    EleveEntraideController(EntraideService entraide) {
        this.entraide = entraide;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Lister les fils d'un chapitre ou d'un exercice dans une classe")
    List<FilVue> lister(
            @RequestParam String portee,
            @RequestParam String ref,
            @RequestParam UUID classeId,
            @AuthenticationPrincipal UserDetails principal) {
        return entraide.listerFils(moi(principal), portee, ref, classeId);
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Ouvrir un fil (poser une question)")
    ResponseEntity<Map<String, UUID>> ouvrir(
            @Valid @RequestBody OuvrirFilRequest req, @AuthenticationPrincipal UserDetails principal) {
        UUID id = entraide.ouvrirFil(
                moi(principal),
                new NouveauFil(req.portee(), req.porteeRef(), req.classeId(), req.titre(), req.question()));
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", id));
    }

    @GetMapping(value = "/{filId}", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Détailler un fil et ses messages (garde anti-triche appliquée)")
    FilDetail consulter(@PathVariable UUID filId, @AuthenticationPrincipal UserDetails principal) {
        return entraide.consulterFil(filId, moi(principal));
    }

    @PostMapping(value = "/{filId}/reponses",
            consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Répondre dans un fil")
    ResponseEntity<Map<String, UUID>> repondre(
            @PathVariable UUID filId,
            @Valid @RequestBody RepondreRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        UUID id = entraide.repondre(filId, moi(principal), req.corps());
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", id));
    }

    @PostMapping("/{filId}/messages/{messageId}/utile")
    @Operation(summary = "Retenir une réponse comme utile (auteur du fil uniquement)")
    ResponseEntity<Void> marquerUtile(
            @PathVariable UUID filId,
            @PathVariable UUID messageId,
            @AuthenticationPrincipal UserDetails principal) {
        entraide.marquerUtile(filId, messageId, moi(principal));
        return ResponseEntity.noContent().build();
    }

    @PostMapping(value = "/messages/{messageId}/signalement", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Signaler un message au modérateur de la classe")
    ResponseEntity<Void> signaler(
            @PathVariable UUID messageId,
            @RequestBody(required = false) SignalerRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        entraide.signaler(messageId, moi(principal), req == null ? null : req.motif());
        return ResponseEntity.noContent().build();
    }

    private static UUID moi(UserDetails principal) {
        return UUID.fromString(principal.getUsername());
    }
}
