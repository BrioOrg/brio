package fr.brio.identite.infrastructure;

import fr.brio.identite.api.EmailSender;
import fr.brio.identite.domain.ConsentementDonne;
import fr.brio.identite.domain.DemandeConsentementEmise;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

/**
 * Sends the consent e-mails once the publishing transaction has committed. A failed
 * send is logged and leaves the publication incomplete in `event_publication`,
 * instead of rolling back a signup or a confirmation that already happened.
 */
@Component
class ConsentementEmailListener {

    private final EmailSender emailSender;

    ConsentementEmailListener(EmailSender emailSender) {
        this.emailSender = emailSender;
    }

    @ApplicationModuleListener
    void onDemandeConsentementEmise(DemandeConsentementEmise evenement) {
        emailSender.sendConsentEmail(evenement.destinataire(), evenement.lienConfirmation());
    }

    @ApplicationModuleListener
    void onConsentementDonne(ConsentementDonne evenement) {
        emailSender.sendConsentConfirmationEmail(evenement.destinataire(), evenement.lienRevocation());
    }
}
