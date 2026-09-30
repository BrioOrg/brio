package fr.brio.identite.api;

import java.util.UUID;

/**
 * What anyone may know about an établissement: enough to pick it in a list. The UAI and
 * the convention fields stay on {@link EtablissementInfo}, for administrators.
 */
public record EtablissementPublicInfo(UUID id, String nom, String type) {}
