package fr.brio.system.web;

import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.context.annotation.Profile;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Refuses startup on non-local profiles if HTTP Basic Auth is active in any filter chain.
 * Guards against accidental removal of @Profile("local") from the localHttpBasicChain bean.
 */
@Component
@Profile("!local")
class BasicAuthGuard implements SmartInitializingSingleton {

    private final List<SecurityFilterChain> chains;

    BasicAuthGuard(List<SecurityFilterChain> chains) {
        this.chains = chains;
    }

    @Override
    public void afterSingletonsInstantiated() {
        chains.stream()
                .flatMap(c -> c.getFilters().stream())
                .filter(f -> f instanceof BasicAuthenticationFilter)
                .findAny()
                .ifPresent(f -> {
                    throw new IllegalStateException(
                            "HTTP Basic Auth is active outside the 'local' profile. " +
                            "Startup refused — dev/dev credentials must not reach production.");
                });
    }
}
