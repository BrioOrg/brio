package fr.brio.identite.api;

public interface EmailSender {

    /**
     * Sends the initial parental consent request to the legal guardian.
     * The confirmation URL must point to the frontend consent page (not /api/).
     */
    void sendConsentEmail(String to, String confirmationUrl);

    /**
     * Sent after confirmation: acknowledges the account is active and gives the
     * parent a link to revoke consent at any time.
     */
    void sendConsentConfirmationEmail(String to, String revocationUrl);
}
