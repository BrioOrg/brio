package fr.brio.devoirs.web;

import fr.brio.devoirs.ContenuPiece;
import fr.brio.devoirs.DevoirService;
import fr.brio.devoirs.PieceInfo;
import fr.brio.devoirs.PieceInvalideException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.io.IOException;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Dépôt et consultation des copies déposées sur un rendu (F5, ADR 0028). */
@RestController
@RequestMapping("/api/devoirs")
@Tag(name = "Devoirs", description = "Dépôt et consultation de copies (F5)")
class CopieController {

    private final DevoirService devoirs;

    CopieController(DevoirService devoirs) {
        this.devoirs = devoirs;
    }

    @PostMapping(
            value = "/{devoirId}/rendu/pieces",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Dépose une copie (photo/scan) sur son rendu")
    @ApiResponse(responseCode = "201", description = "Copie déposée")
    @ApiResponse(responseCode = "400", description = "Fichier invalide (format, taille, nombre)")
    @ApiResponse(responseCode = "401", description = "Authentification requise")
    ResponseEntity<PieceInfo> deposer(
            @PathVariable UUID devoirId,
            @RequestParam("fichier") MultipartFile fichier,
            Authentication auth) {
        byte[] contenu;
        try {
            contenu = fichier.getBytes();
        } catch (IOException e) {
            throw new PieceInvalideException("Fichier illisible.");
        }
        PieceInfo info =
                devoirs.deposerPiece(
                        UUID.fromString(auth.getName()),
                        devoirId,
                        contenu,
                        fichier.getContentType(),
                        fichier.getOriginalFilename());
        return ResponseEntity.status(HttpStatus.CREATED).body(info);
    }

    @GetMapping("/pieces/{pieceId}")
    @Operation(summary = "Sert une copie (élève auteur ou enseignant du devoir uniquement)")
    @ApiResponse(responseCode = "200", description = "Le fichier")
    @ApiResponse(responseCode = "403", description = "Accès refusé")
    @ApiResponse(responseCode = "404", description = "Pièce introuvable")
    ResponseEntity<byte[]> servir(@PathVariable UUID pieceId, Authentication auth) {
        ContenuPiece p = devoirs.chargerPiece(pieceId, UUID.fromString(auth.getName()));
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(p.contentType())).body(p.contenu());
    }
}
