package fr.brio.system.web;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.core.convert.support.GenericConversionService;
import org.springframework.core.serializer.support.DeserializingConverter;
import org.springframework.core.serializer.support.SerializationFailedException;
import org.springframework.core.serializer.support.SerializingConverter;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;
import org.springframework.session.config.SessionRepositoryCustomizer;
import org.springframework.session.jdbc.JdbcIndexedSessionRepository;
import org.springframework.session.security.SpringSessionBackedSessionRegistry;

/**
 * Persistent session store (ADR 0034): Spring Session JDBC, tables in {@code identite}
 * (Flyway V38). Spring Boot's auto-configuration creates the repository and the filter;
 * this class only adds what it does not.
 */
@Configuration(proxyBeanMethods = false)
class SessionStoreConfig {

    /**
     * Session attributes are Java-serialised. A deploy that changes a serialised class
     * (a Spring Security upgrade, typically) leaves rows the new code cannot read: the
     * default converter then throws on every request carrying such a cookie. Read an
     * unreadable attribute as absent instead, so the student is simply logged out —
     * the "session expirée" path of #279 — rather than shown an error.
     */
    @Bean
    SessionRepositoryCustomizer<JdbcIndexedSessionRepository> tolerantSessionDeserialization() {
        ClassLoader classLoader = SessionStoreConfig.class.getClassLoader();
        return repository -> repository.setConversionService(conversionService(classLoader));
    }

    /**
     * Concurrent-session control ({@code maximumSessions} in {@link SecurityConfig}) must
     * count the sessions in the shared store: Spring Security's default registry is an
     * in-memory map, empty after every restart.
     */
    @Bean
    <S extends Session> SpringSessionBackedSessionRegistry<S> sessionRegistry(
            FindByIndexNameSessionRepository<S> sessions) {
        return new SpringSessionBackedSessionRegistry<>(sessions);
    }

    static GenericConversionService conversionService(ClassLoader classLoader) {
        var conversion = new GenericConversionService();
        conversion.addConverter(Object.class, byte[].class, new SerializingConverter());
        conversion.addConverter(byte[].class, Object.class,
                new TolerantDeserializingConverter(new DeserializingConverter(classLoader)));
        return conversion;
    }

    static final class TolerantDeserializingConverter implements Converter<byte[], Object> {

        private static final Logger log = LoggerFactory.getLogger(TolerantDeserializingConverter.class);

        private final Converter<byte[], Object> delegate;

        TolerantDeserializingConverter(Converter<byte[], Object> delegate) {
            this.delegate = delegate;
        }

        @Override
        public Object convert(byte[] source) {
            try {
                return delegate.convert(source);
            } catch (SerializationFailedException e) {
                // Never log the bytes: they hold the security context.
                log.warn("Unreadable session attribute ignored, the user will log in again: {}",
                        e.getMostSpecificCause().toString());
                return null;
            }
        }
    }
}
