package fr.brio.contenu.infrastructure;

import org.springframework.boot.ExitCodeGenerator;

class IngestionFailedException extends RuntimeException implements ExitCodeGenerator {

    IngestionFailedException(String message) {
        super(message);
    }

    @Override
    public int getExitCode() {
        return 1;
    }
}
