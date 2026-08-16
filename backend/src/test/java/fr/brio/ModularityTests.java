package fr.brio;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

class ModularityTests {

    private final ApplicationModules modules = ApplicationModules.of(BrioBackendApplication.class);

    @Test
    void verifyModuleBoundaries() {
        modules.verify();
    }
}
