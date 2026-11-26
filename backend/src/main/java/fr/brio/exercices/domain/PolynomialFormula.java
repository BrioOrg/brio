package fr.brio.exercices.domain;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** A bounded polynomial in x, with exact rational coefficients. */
public final class PolynomialFormula {

    private static final int MAX_LENGTH = 512;
    private static final int MAX_DEPTH = 32;
    private static final int MAX_DEGREE = 16;
    private static final int MAX_LITERAL_LENGTH = 32;
    private static final int MAX_COEFFICIENT_BITS = 512;

    private static final PolynomialFormula ONE = constant(Rational.ONE);
    private static final PolynomialFormula X = new PolynomialFormula(List.of(Rational.ZERO, Rational.ONE));

    private final List<Rational> coefficients;

    private PolynomialFormula(List<Rational> coefficients) {
        int size = coefficients.size();
        while (size > 1 && coefficients.get(size - 1).isZero()) {
            size--;
        }
        this.coefficients = List.copyOf(coefficients.subList(0, size));
    }

    public enum ErrorKind {
        SYNTAX,
        UNSUPPORTED
    }

    public static final class FormulaException extends IllegalArgumentException {

        private final ErrorKind kind;

        private FormulaException(ErrorKind kind, String message) {
            super(message);
            this.kind = kind;
        }

        public ErrorKind kind() {
            return kind;
        }
    }

    public static PolynomialFormula parse(String input) {
        if (input == null || input.isBlank()) {
            throw syntax("Missing expression");
        }
        if (input.length() > MAX_LENGTH) {
            throw unsupported("Expression is too long");
        }

        Parser parser = new Parser(input.replace("{,}", ","));
        PolynomialFormula result = parser.expression(0);
        parser.expect(TokenKind.END);
        return result;
    }

    @Override
    public boolean equals(Object value) {
        return value instanceof PolynomialFormula other && coefficients.equals(other.coefficients);
    }

    @Override
    public int hashCode() {
        return coefficients.hashCode();
    }

    private static PolynomialFormula constant(Rational value) {
        return new PolynomialFormula(List.of(value));
    }

    private int degree() {
        return coefficients.size() - 1;
    }

    private Rational coefficient(int index) {
        return index <= degree() ? coefficients.get(index) : Rational.ZERO;
    }

    private PolynomialFormula add(PolynomialFormula other) {
        int degree = Math.max(degree(), other.degree());
        List<Rational> result = new ArrayList<>(degree + 1);
        for (int index = 0; index <= degree; index++) {
            result.add(coefficient(index).add(other.coefficient(index)));
        }
        return new PolynomialFormula(result);
    }

    private PolynomialFormula negate() {
        return new PolynomialFormula(coefficients.stream().map(Rational::negate).toList());
    }

    private PolynomialFormula multiply(PolynomialFormula other) {
        if (isZero() || other.isZero()) {
            return constant(Rational.ZERO);
        }

        int degree = degree() + other.degree();
        if (degree > MAX_DEGREE) {
            throw unsupported("Polynomial degree is too high");
        }

        List<Rational> result = new ArrayList<>(Collections.nCopies(degree + 1, Rational.ZERO));
        for (int left = 0; left < coefficients.size(); left++) {
            for (int right = 0; right < other.coefficients.size(); right++) {
                Rational product = coefficients.get(left).multiply(other.coefficients.get(right));
                result.set(left + right, result.get(left + right).add(product));
            }
        }
        return new PolynomialFormula(result);
    }

    private PolynomialFormula divide(PolynomialFormula divisor) {
        if (divisor.degree() != 0 || divisor.isZero()) {
            throw unsupported("A divisor must be a non-zero constant");
        }
        Rational reciprocal = divisor.coefficient(0).reciprocal();
        return new PolynomialFormula(coefficients.stream()
                .map(coefficient -> coefficient.multiply(reciprocal))
                .toList());
    }

    private PolynomialFormula power(PolynomialFormula exponent) {
        Rational value = exponent.coefficient(0);
        if (exponent.degree() != 0
                || !value.denominator().equals(BigInteger.ONE)
                || value.numerator().signum() < 0
                || value.numerator().compareTo(BigInteger.valueOf(MAX_DEGREE)) > 0) {
            throw unsupported("A power must be a small non-negative integer");
        }
        int power = value.numerator().intValueExact();
        if (isZero() && power == 0) {
            throw unsupported("Zero to the power of zero is outside the supported domain");
        }
        PolynomialFormula result = ONE;
        for (int index = 0; index < power; index++) {
            result = result.multiply(this);
        }
        return result;
    }

    private boolean isZero() {
        return degree() == 0 && coefficient(0).isZero();
    }

    private static FormulaException syntax(String message) {
        return new FormulaException(ErrorKind.SYNTAX, message);
    }

    private static FormulaException unsupported(String message) {
        return new FormulaException(ErrorKind.UNSUPPORTED, message);
    }

    private record Rational(BigInteger numerator, BigInteger denominator) {

        private static final Rational ZERO = new Rational(BigInteger.ZERO, BigInteger.ONE);
        private static final Rational ONE = new Rational(BigInteger.ONE, BigInteger.ONE);

        private Rational {
            if (denominator.signum() < 0) {
                numerator = numerator.negate();
                denominator = denominator.negate();
            }
            BigInteger divisor = numerator.gcd(denominator);
            numerator = numerator.divide(divisor);
            denominator = denominator.divide(divisor);
            if (numerator.abs().bitLength() > MAX_COEFFICIENT_BITS
                    || denominator.bitLength() > MAX_COEFFICIENT_BITS) {
                throw unsupported("Polynomial coefficient is too large");
            }
        }

        private static Rational decimal(String value) {
            if (value.length() > MAX_LITERAL_LENGTH) {
                throw unsupported("Numeric literal is too long");
            }
            BigDecimal decimal = new BigDecimal(value);
            return new Rational(decimal.unscaledValue(), BigInteger.TEN.pow(decimal.scale()));
        }

        private Rational add(Rational other) {
            return new Rational(
                    numerator.multiply(other.denominator).add(other.numerator.multiply(denominator)),
                    denominator.multiply(other.denominator));
        }

        private Rational negate() {
            return new Rational(numerator.negate(), denominator);
        }

        private Rational multiply(Rational other) {
            return new Rational(numerator.multiply(other.numerator), denominator.multiply(other.denominator));
        }

        private Rational reciprocal() {
            return new Rational(denominator, numerator);
        }

        private boolean isZero() {
            return numerator.signum() == 0;
        }
    }

    private enum TokenKind {
        NUMBER,
        X,
        PLUS,
        MINUS,
        TIMES,
        DIVIDE,
        POWER,
        LEFT_PAREN,
        RIGHT_PAREN,
        LEFT_BRACE,
        RIGHT_BRACE,
        FRACTION,
        END
    }

    private static final class Parser {

        private final String input;
        private int offset;
        private TokenKind current;
        private String numericLiteral;

        private Parser(String input) {
            this.input = input;
            advance();
        }

        private PolynomialFormula expression(int depth) {
            PolynomialFormula result = product(depth);
            while (current == TokenKind.PLUS || current == TokenKind.MINUS) {
                boolean subtract = current == TokenKind.MINUS;
                advance();
                PolynomialFormula next = product(depth);
                result = result.add(subtract ? next.negate() : next);
            }
            return result;
        }

        private PolynomialFormula product(int depth) {
            PolynomialFormula result = unary(depth);
            while (true) {
                if (take(TokenKind.TIMES) || startsImplicitFactor()) {
                    result = result.multiply(unary(depth));
                } else if (take(TokenKind.DIVIDE)) {
                    result = result.divide(unary(depth));
                } else {
                    return result;
                }
            }
        }

        private boolean startsImplicitFactor() {
            return switch (current) {
                case X, LEFT_PAREN, LEFT_BRACE, FRACTION -> true;
                default -> false;
            };
        }

        private PolynomialFormula unary(int depth) {
            if (depth > MAX_DEPTH) {
                throw unsupported("Expression is too deeply nested");
            }
            if (take(TokenKind.PLUS)) {
                return unary(depth + 1);
            }
            if (take(TokenKind.MINUS)) {
                return unary(depth + 1).negate();
            }
            PolynomialFormula base = atom(depth);
            return take(TokenKind.POWER) ? base.power(unary(depth + 1)) : base;
        }

        private PolynomialFormula atom(int depth) {
            if (current == TokenKind.NUMBER) {
                Rational number = Rational.decimal(numericLiteral);
                advance();
                return constant(number);
            }
            if (take(TokenKind.X)) {
                return X;
            }
            if (take(TokenKind.LEFT_PAREN)) {
                return group(depth, TokenKind.RIGHT_PAREN);
            }
            if (take(TokenKind.LEFT_BRACE)) {
                return group(depth, TokenKind.RIGHT_BRACE);
            }
            if (take(TokenKind.FRACTION)) {
                expect(TokenKind.LEFT_BRACE);
                PolynomialFormula numerator = group(depth, TokenKind.RIGHT_BRACE);
                expect(TokenKind.LEFT_BRACE);
                return numerator.divide(group(depth, TokenKind.RIGHT_BRACE));
            }
            throw syntax("Expected an expression");
        }

        private PolynomialFormula group(int depth, TokenKind close) {
            PolynomialFormula value = expression(depth + 1);
            expect(close);
            return value;
        }

        private boolean take(TokenKind kind) {
            if (current != kind) {
                return false;
            }
            advance();
            return true;
        }

        private void expect(TokenKind kind) {
            if (!take(kind)) {
                throw syntax("Unexpected token");
            }
        }

        private void advance() {
            do {
                skipWhitespace();
                current = nextToken();
            } while (current == null);
        }

        private TokenKind nextToken() {
            if (offset == input.length()) {
                return TokenKind.END;
            }
            char character = input.charAt(offset++);
            return switch (character) {
                case 'x' -> TokenKind.X;
                case '+' -> TokenKind.PLUS;
                case '-', '−' -> TokenKind.MINUS;
                case '*', '×', '·' -> TokenKind.TIMES;
                case '/', '÷' -> TokenKind.DIVIDE;
                case '^' -> TokenKind.POWER;
                case '(' -> TokenKind.LEFT_PAREN;
                case ')' -> TokenKind.RIGHT_PAREN;
                case '{' -> TokenKind.LEFT_BRACE;
                case '}' -> TokenKind.RIGHT_BRACE;
                case '\\' -> latexCommand();
                default -> literal(character);
            };
        }

        private TokenKind literal(char first) {
            if (digit(first) || isSeparator(first)) {
                return number(first);
            }
            if (Character.isLetter(first) || "=<>|!√∫≤≥≠[]".indexOf(first) >= 0) {
                throw unsupported("Only polynomial expressions in x are supported");
            }
            throw syntax("Unknown symbol");
        }

        private TokenKind number(char first) {
            int start = offset - 1;
            if (digit(first)) {
                skipDigits();
                if (offset < input.length() && isSeparator(input.charAt(offset))) {
                    offset++;
                    requireFractionalDigits();
                }
            } else {
                requireFractionalDigits();
            }
            numericLiteral = input.substring(start, offset).replace(',', '.');
            return TokenKind.NUMBER;
        }

        private void requireFractionalDigits() {
            int start = offset;
            skipDigits();
            if (offset == start) {
                throw syntax("Missing fractional digits");
            }
        }

        private void skipDigits() {
            while (offset < input.length() && digit(input.charAt(offset))) {
                offset++;
            }
        }

        private TokenKind latexCommand() {
            int start = offset;
            while (offset < input.length() && Character.isLetter(input.charAt(offset))) {
                offset++;
            }
            if (offset == start) {
                if (offset < input.length() && ",;! :".indexOf(input.charAt(offset)) >= 0) {
                    offset++;
                    return null;
                }
                throw syntax("Incomplete LaTeX command");
            }
            String command = input.substring(start, offset);
            return switch (command) {
                case "frac", "dfrac", "tfrac" -> TokenKind.FRACTION;
                case "cdot", "times" -> TokenKind.TIMES;
                case "div" -> TokenKind.DIVIDE;
                case "left" -> latexParenthesis('(', TokenKind.LEFT_PAREN);
                case "right" -> latexParenthesis(')', TokenKind.RIGHT_PAREN);
                default -> throw unsupported("LaTeX command outside the polynomial domain");
            };
        }

        private TokenKind latexParenthesis(char parenthesis, TokenKind kind) {
            skipWhitespace();
            if (offset < input.length() && input.charAt(offset) == parenthesis) {
                offset++;
                return kind;
            }
            if (offset < input.length() && "|[\\]".indexOf(input.charAt(offset)) >= 0) {
                throw unsupported("LaTeX delimiter outside the polynomial domain");
            }
            throw syntax("Missing LaTeX parenthesis");
        }

        private void skipWhitespace() {
            while (offset < input.length()
                    && (Character.isWhitespace(input.charAt(offset)) || Character.isSpaceChar(input.charAt(offset)))) {
                offset++;
            }
        }

        private static boolean digit(char character) {
            return character >= '0' && character <= '9';
        }

        private static boolean isSeparator(char character) {
            return character == ',' || character == '.';
        }
    }
}
