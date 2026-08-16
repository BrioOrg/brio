package fr.brio.system.web;

import fr.brio.system.api.PingResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Instant;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@Tag(name = "Système", description = "Endpoints techniques exposés par le produit")
class SystemController {

    @GetMapping(value = "/ping", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Vérifie que l'API est joignable et renvoie les métadonnées de version")
    PingResponse ping() {
        return new PingResponse("ok", "0.0.1-SNAPSHOT", Instant.now());
    }
}
