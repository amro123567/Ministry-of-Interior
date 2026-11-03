package com.moi.cts.config;

import com.moi.cts.security.AppUserDetailsService;
import com.moi.cts.security.JwtAuthFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Value("${cts.cors.allowed-origins}")
    private String allowedOrigins;

    private final AppUserDetailsService userDetailsService;
    private final JwtAuthFilter jwtAuthFilter;

    public SecurityConfig(AppUserDetailsService userDetailsService, JwtAuthFilter jwtAuthFilter) {
        this.userDetailsService = userDetailsService;
        this.jwtAuthFilter = jwtAuthFilter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of(allowedOrigins.split(",")));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            // No / expired / invalid token -> 401 ("sign in again"). Without this entry point Spring
            // answers 403, which clients cannot tell apart from "signed in but not allowed".
            .exceptionHandling(eh -> eh.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/actuator/health").permitAll()
                // Permission-based, not role-name-based: whichever roles
                // happen to be granted USER_VIEW/USER_MANAGE (seeded as
                // ADMIN+MANAGER / ADMIN respectively in DataSeeder) get
                // access -- nothing here hardcodes "ADMIN" or "MANAGER".
                .requestMatchers(HttpMethod.GET, "/api/users/**").hasAuthority("USER_VIEW")
                .requestMatchers("/api/users/**").hasAuthority("USER_MANAGE")
                .requestMatchers("/api/roles/**").hasAuthority("USER_MANAGE")
                // Previously unrestricted at this layer (only hidden from
                // the nav by the frontend) -- now genuinely enforced here
                // too, closing that gap.
                .requestMatchers("/api/audit/**").hasAuthority("AUDIT_VIEW")
                .requestMatchers("/api/reports/**").hasAuthority("REPORTS_VIEW")
                // Reading the citizen registry stays open to any authenticated
                // user (falls through to anyRequest().authenticated() below,
                // same as /offices and /document-types) -- but registering a
                // new citizen or correcting a lineage link is a real
                // civil-registry write, so it needs its own permission rather
                // than inheriting the read gate. Granted to ADMIN/MANAGER/
                // OFFICER, not VIEWER, in DataSeeder.
                .requestMatchers(HttpMethod.POST, "/api/citizens/**").hasAuthority("CITIZEN_MANAGE")
                .requestMatchers(HttpMethod.PATCH, "/api/citizens/**").hasAuthority("CITIZEN_MANAGE")
                // Family records/membership and guardianship creation are the
                // same kind of civil-registry write as the two rules above,
                // so they share CITIZEN_MANAGE rather than getting their own
                // narrow permission each. Requesting a registry transfer or
                // civil-status amendment is also data entry, so it's
                // CITIZEN_MANAGE too -- but *deciding* one is a distinct
                // authority (approve/reject someone else's request), mirrored
                // on the REQUEST_TRANSITION_SUBMIT/REQUEST_TRANSITION_DECIDE
                // split already used for correspondence requests below, and
                // enforced on top of (not instead of) the service layer's own
                // SI-12 check that the approver can't be the requester.
                .requestMatchers(HttpMethod.POST, "/api/family-records/**").hasAuthority("CITIZEN_MANAGE")
                .requestMatchers(HttpMethod.PATCH, "/api/family-records/**").hasAuthority("CITIZEN_MANAGE")
                .requestMatchers(HttpMethod.POST, "/api/guardianships").hasAuthority("CITIZEN_MANAGE")
                .requestMatchers(HttpMethod.POST, "/api/registry-transfers").hasAuthority("CITIZEN_MANAGE")
                .requestMatchers(HttpMethod.PATCH, "/api/registry-transfers/**").hasAuthority("CITIZEN_REGISTRY_DECIDE")
                .requestMatchers(HttpMethod.POST, "/api/civil-status-amendments").hasAuthority("CITIZEN_MANAGE")
                .requestMatchers(HttpMethod.PATCH, "/api/civil-status-amendments/**").hasAuthority("CITIZEN_REGISTRY_DECIDE")
                // Issuing any of the 7 document subtypes (birth/marriage/
                // divorce/death certificates, national ID cards,
                // naturalization and name-change records) is the same kind
                // of civil-registry write as everything else gated on
                // CITIZEN_MANAGE above -- there's no separate "decide" step
                // here (a document is issued outright, not requested then
                // approved), so this domain doesn't need its own
                // CITIZEN_REGISTRY_DECIDE-style split. Reads stay open to
                // any authenticated user, matching every other read in this
                // migration.
                // Validating a document is a decision on someone else's work, so it
                // reuses CITIZEN_REGISTRY_DECIDE (ADMIN/MANAGER). It must come before
                // the general documents rule below, because the first match wins.
                .requestMatchers(HttpMethod.POST, "/api/documents/*/validations").hasAuthority("CITIZEN_REGISTRY_DECIDE")
                .requestMatchers(HttpMethod.POST, "/api/documents/**").hasAuthority("CITIZEN_MANAGE")
                // The workflow engine's *catalog* (states/transitions) is
                // system configuration, not day-to-day data entry -- the
                // same tier as managing users/roles above, so it reuses
                // USER_MANAGE rather than inventing a parallel admin
                // permission. Its *runtime* (creating an instance, executing
                // a transition) is deliberately left ungated here: each
                // WorkflowTransition already carries its own
                // requiredPermissions, checked inside
                // WorkflowEngineService.executeTransition() itself -- the
                // exact same "permission lives on the business rule, not a
                // blanket HTTP matcher" design RequestService.transition()
                // already uses for /api/requests/**/transition (also absent
                // from this matcher list). Gating the whole endpoint here
                // too would make that per-transition permission model
                // pointless, since only USER_MANAGE holders could ever
                // reach it.
                .requestMatchers(HttpMethod.POST, "/api/workflow/states").hasAuthority("USER_MANAGE")
                .requestMatchers(HttpMethod.POST, "/api/workflow/transitions").hasAuthority("USER_MANAGE")
                // Operating an instance (create + execute a transition) needs at
                // least one request-workflow permission, so a read-only VIEWER
                // cannot write here. Each transition's own requiredPermissions
                // are still checked inside WorkflowEngineService on top of this.
                .requestMatchers(HttpMethod.POST, "/api/workflow/instances", "/api/workflow/instances/*/transition")
                    .hasAnyAuthority("REQUEST_TRANSITION_SUBMIT", "REQUEST_TRANSITION_REVIEW", "REQUEST_TRANSITION_DECIDE", "REQUEST_TRANSITION_ARCHIVE")
                // Full service-request model (SLA records & payments,
                // RequestFinanceController): reading a request's SLA snapshot
                // or payment history stays open to any authenticated user,
                // same as every other read in this migration, and so does
                // refreshing the SLA snapshot (it only recomputes a cached
                // derived value from data the caller could already see, so
                // gating it would add nothing). Recording a payment is a
                // genuine front-line write, gated on PAYMENT_RECORD; reversing
                // one is a distinct correction authority, gated on
                // PAYMENT_REVERSE -- see those two permissions' own Javadoc
                // in DataSeeder for why OFFICER holds only the first.
                .requestMatchers(HttpMethod.POST, "/api/payments").hasAuthority("PAYMENT_RECORD")
                .requestMatchers(HttpMethod.PATCH, "/api/payments/*/reverse").hasAuthority("PAYMENT_REVERSE")
                // Correspondence-request writes. Transitions are gated inside
                // RequestService.transition() (per-transition permission from the workflow
                // catalog). The other writes each have their own permission, so a reviewer
                // can no longer create or edit drafts and an officer can no longer assign.
                //   REQUEST_CREATE : create / edit a draft, attach documents (OFFICER)
                //   REQUEST_ASSIGN : assign or reassign an open request (MANAGER, ADMIN override)
                .requestMatchers(HttpMethod.POST, "/api/requests", "/api/requests/*/documents")
                    .hasAuthority("REQUEST_CREATE")
                .requestMatchers(HttpMethod.PUT, "/api/requests/*")
                    .hasAuthority("REQUEST_CREATE")
                .requestMatchers(HttpMethod.PATCH, "/api/requests/*/assign")
                    .hasAuthority("REQUEST_ASSIGN")
                // Exporting every request as CSV is reporting, not reading one request:
                // it used to be open to any signed-in user, including the read-only VIEWER.
                .requestMatchers(HttpMethod.GET, "/api/requests/export").hasAuthority("REPORTS_VIEW")
                .anyRequest().authenticated())
            .authenticationProvider(authenticationProvider())
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
