package com.moi.cts.config;

import com.moi.cts.security.AppUserDetailsService;
import com.moi.cts.security.JwtAuthFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
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
                .requestMatchers(HttpMethod.POST, "/api/documents/**").hasAuthority("CITIZEN_MANAGE")
                .anyRequest().authenticated())
            .authenticationProvider(authenticationProvider())
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
