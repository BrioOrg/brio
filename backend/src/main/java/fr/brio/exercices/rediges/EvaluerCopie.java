package fr.brio.exercices.rediges;

import java.util.UUID;

record EvaluerCopie(UUID exerciceId, int version, UUID eleveId) {}
