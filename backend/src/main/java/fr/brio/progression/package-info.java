// progression only consumes other modules' events/DTOs through their published api
// (ADR 0022 "jamais d'appel sortant"). Declaring the allowlist keeps that explicit
// and lets ModularityTests catch any accidental reach into internals.
@org.springframework.modulith.ApplicationModule(
        allowedDependencies = {"exercices :: api", "contenu :: api"})
package fr.brio.progression;
