package fr.brio.contenu.web;

import java.util.UUID;

/** Identifier of a freshly created draft, for the client to keep editing/publishing against. */
record CoursCreeResponse(UUID coursId) {
}
