package fr.brio.contenu;

import java.net.URI;

public record ChapitreRef(String niveauCode, String matiereCode, String slug) {

    public URI toTripletUri() {
        return URI.create("/api/chapitres/" + niveauCode + "/" + matiereCode + "/" + slug);
    }
}
