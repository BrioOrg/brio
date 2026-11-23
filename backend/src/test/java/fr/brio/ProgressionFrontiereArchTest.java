package fr.brio;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import org.junit.jupiter.api.Test;

/**
 * The one exception to « progression n'appelle personne » stays bounded (ADR 0050 §2, amending
 * ADR 0022 §3): only {@code progression.web} may read {@code CoursAccesApi}, and progression never
 * depends on identite. Writes stay fed by events only.
 */
class ProgressionFrontiereArchTest {

    private static final JavaClasses CLASSES = new ClassFileImporter()
            .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
            .importPackages("fr.brio.progression");

    @Test
    void onlyTheWebLayerOfProgressionReadsCourseAccess() {
        noClasses().that().resideInAPackage("fr.brio.progression..")
                .and().resideOutsideOfPackage("fr.brio.progression.web..")
                .should().dependOnClassesThat().haveFullyQualifiedName("fr.brio.contenu.api.CoursAccesApi")
                .check(CLASSES);
    }

    @Test
    void progressionNeverDependsOnIdentite() {
        noClasses().that().resideInAPackage("fr.brio.progression..")
                .should().dependOnClassesThat().resideInAPackage("fr.brio.identite..")
                .check(CLASSES);
    }
}
