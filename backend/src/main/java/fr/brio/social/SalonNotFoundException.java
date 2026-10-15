package fr.brio.social;

import java.util.UUID;

/** Levée quand un salon de classe est introuvable. */
public class SalonNotFoundException extends RuntimeException {

    public SalonNotFoundException(UUID salonId) {
        super("Salon introuvable : " + salonId);
    }
}
