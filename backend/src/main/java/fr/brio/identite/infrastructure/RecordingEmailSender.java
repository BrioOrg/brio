package fr.brio.identite.infrastructure;

import fr.brio.identite.api.EmailSender;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * In-memory email sender for local dev and tests. It grows without bound, so it must
 * never back a long-running instance: every other profile gets {@link SmtpEmailSender}
 * (ADR 0024 §6).
 */
@Component
@Profile({"local", "test"})
public class RecordingEmailSender implements EmailSender {

    public record SentEmail(String to, String kind, String url) {}

    private final List<SentEmail> sent = Collections.synchronizedList(new ArrayList<>());

    @Override
    public void sendConsentEmail(String to, String confirmationUrl) {
        sent.add(new SentEmail(to, "consent-request", confirmationUrl));
    }

    @Override
    public void sendConsentConfirmationEmail(String to, String revocationUrl) {
        sent.add(new SentEmail(to, "consent-confirmed", revocationUrl));
    }

    public List<SentEmail> getSent() {
        return List.copyOf(sent);
    }

    public void clear() {
        sent.clear();
    }
}
