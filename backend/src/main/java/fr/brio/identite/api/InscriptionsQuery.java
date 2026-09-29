package fr.brio.identite.api;

import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Published query port for a student's class memberships. Other modules reference
 * students and classes by ID only (ADR 0007) — this is how {@code contenu} answers
 * "which classes is this student in?" to gate access to a teacher course's portées,
 * without reaching into identite's internals.
 */
public interface InscriptionsQuery {

    /**
     * The IDs of the classes the given account is enrolled in <b>as a student</b>
     * ({@code role_dans_classe = 'eleve'}). Empty when the account is in no class
     * (or is a teacher only). Never {@code null}.
     */
    Set<UUID> classesDeLEleve(UUID compteId);

    /**
     * The élève roster of a class: every account enrolled as a student
     * ({@code role_dans_classe = 'eleve'}), with its per-class display name and a homonyme flag.
     * Empty when the class has no students (or does not exist). Never {@code null}.
     *
     * <p>Authorisation is the caller's responsibility — this port does not check who asks (the
     * {@code devoirs} module verifies the teacher owns the class before using it).
     */
    List<InscriptionInfo> elevesDeLaClasse(UUID classeId);
}
