package fr.brio.identite.infrastructure;

import fr.brio.identite.api.EmailSender;
import fr.brio.identite.domain.DemandeConsentement;
import jakarta.mail.MessagingException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

/**
 * SMTP e-mail sender — the implementation for every profile but `local` and `test`
 * (ADR 0024 §6). The SMTP server comes from `spring.mail.*`: Mailpit on the private
 * environment, an EU provider at publication. Without `spring.mail.host` Spring
 * creates no `JavaMailSender`, so a misconfigured instance refuses to start.
 *
 * Plain text only: the recipient is a parent, the content is a link and two
 * sentences, and plain text renders the same in every mail client.
 */
@Component
@Profile("!local & !test")
class SmtpEmailSender implements EmailSender {

    private final JavaMailSender mailSender;
    private final String from;

    SmtpEmailSender(JavaMailSender mailSender, @Value("${brio.mail.from}") String from) {
        this.mailSender = mailSender;
        this.from = from;
    }

    @Override
    public void sendConsentEmail(String to, String confirmationUrl) {
        send(to, "Brio — autorisez le compte de votre enfant", """
                Bonjour,

                Un compte élève vient d'être créé sur Brio avec votre adresse e-mail comme \
                responsable légal. Il restera inactif tant que vous ne l'aurez pas autorisé.

                Pour autoriser ce compte, ouvrez ce lien :
                %s

                Ce lien ne fonctionne qu'une fois et expire dans %d jours.

                Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : \
                le compte ne sera pas activé.

                L'équipe Brio
                """.formatted(confirmationUrl, DemandeConsentement.TOKEN_TTL.toDays()));
    }

    @Override
    public void sendConsentConfirmationEmail(String to, String revocationUrl) {
        send(to, "Brio — le compte de votre enfant est activé", """
                Bonjour,

                Merci : vous avez autorisé le compte de votre enfant sur Brio. \
                Il est maintenant actif.

                Vous pouvez retirer cette autorisation à tout moment en ouvrant ce lien ; \
                le compte sera alors immédiatement suspendu :
                %s

                Conservez ce message.

                L'équipe Brio
                """.formatted(revocationUrl));
    }

    private void send(String to, String subject, String text) {
        var message = mailSender.createMimeMessage();
        try {
            var helper = new MimeMessageHelper(message, "UTF-8");
            helper.setFrom(from);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(text);
        } catch (MessagingException e) {
            throw new MailSendException("Could not build e-mail", e);
        }
        mailSender.send(message);
    }
}
