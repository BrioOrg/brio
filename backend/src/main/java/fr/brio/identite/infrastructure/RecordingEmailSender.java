package fr.brio.identite.infrastructure;

import fr.brio.identite.api.EmailSender;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * In-memory email sender for local dev and tests.
 * Replace with an SMTP-backed implementation when a provider is chosen (EU data
 * residency required — see plan note in issue #60).
 */
@Component
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
