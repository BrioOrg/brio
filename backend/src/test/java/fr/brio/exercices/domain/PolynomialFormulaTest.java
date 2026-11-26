package fr.brio.exercices.domain;

import static fr.brio.exercices.domain.PolynomialFormula.ErrorKind.SYNTAX;
import static fr.brio.exercices.domain.PolynomialFormula.ErrorKind.UNSUPPORTED;
import static fr.brio.exercices.domain.PolynomialFormula.parse;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

import fr.brio.exercices.domain.PolynomialFormula.FormulaException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class PolynomialFormulaTest {

    @Test
    void shouldAcceptEquivalentFormsOfAPolynomialDerivative() {
        PolynomialFormula derivative = parse("2x+2");

        assertThat(parse("2(x+1)")).isEqualTo(derivative);
        assertThat(parse("2\\times \\left(x+1\\right)")).isEqualTo(derivative);
        assertThat(parse("(x+1)+(x+1)")).hasSameHashCodeAs(derivative).isEqualTo(derivative);
        assertThat(parse("2(x-1)")).isNotEqualTo(derivative);
    }

    @Test
    void shouldCompareRationalAndDecimalCoefficientsExactly() {
        assertThat(parse("\\frac{3x+3}{6}")).isEqualTo(parse("0,5x + .5"));
        assertThat(parse("2{,}5\\cdot x + ,25")).isEqualTo(parse("5/2x + 1/4"));
        assertThat(parse("0.1x + 0.2x")).isEqualTo(parse("0.3x"));
        assertThat(parse("0,3333333333333333x")).isNotEqualTo(parse("x/3"));
    }

    @Test
    void shouldRespectSignedPowersAndExpandProducts() {
        assertThat(parse("-x^2")).isEqualTo(parse("0-x^{2}")).isNotEqualTo(parse("(-x)^2"));
        assertThat(parse("(2x-1)^2")).isEqualTo(parse("4x^2 - 4x + 1"));
        assertThat(parse("x^2^3")).isEqualTo(parse("x^8"));
        assertThat(parse("x(x+1)-x^2-x")).isEqualTo(parse("0"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "  ", "x+", "(x+1", "{x+1)", "x***2", "2 3", "2,", "?", "\\frac{1}", "\\left x"})
    void shouldRejectMalformedNotationAsSyntax(String input) {
        assertThat(assertThrows(FormulaException.class, () -> parse(input)).kind()).isEqualTo(SYNTAX);
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "sin(x)",
        "\\sqrt{x}",
        "\\int x",
        "y+2",
        "x^(-1)",
        "x^{1/2}",
        "x^x",
        "x/(x+1)",
        "x/x",
        "x/(2-2)",
        "0^0",
        "x^{17}",
        "(x^9)(x^8)",
        "x=2"
    })
    void shouldDistinguishExpressionsOutsideThePolynomialDomain(String input) {
        assertThat(assertThrows(FormulaException.class, () -> parse(input)).kind())
                .isEqualTo(UNSUPPORTED);
    }

    @Test
    void shouldBoundExpressionLengthDepthAndCoefficientGrowth() {
        for (String input : new String[] {
            "x+".repeat(256) + "x",
            "(".repeat(33) + "x" + ")".repeat(33),
            "1".repeat(33),
            "(99999999999999999999999999999999)^16"
        }) {
            assertThat(assertThrows(FormulaException.class, () -> parse(input)).kind())
                    .isEqualTo(UNSUPPORTED);
        }
    }
}
