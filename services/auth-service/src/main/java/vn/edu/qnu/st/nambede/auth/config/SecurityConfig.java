package vn.edu.qnu.st.nambede.auth.config;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.servlet.HandlerExceptionResolver;
import vn.edu.qnu.st.nambede.auth.jwt.JwtProperties;
import vn.edu.qnu.st.nambede.auth.jwt.JwtService;
import vn.edu.qnu.st.nambede.auth.security.JsonAuthErrors;
import vn.edu.qnu.st.nambede.auth.security.JwtAuthenticationFilter;

@Configuration
@EnableWebSecurity
@EnableConfigurationProperties(JwtProperties.class)
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, JwtService jwtService,
            @Qualifier("handlerExceptionResolver") HandlerExceptionResolver resolver) throws Exception {
        JsonAuthErrors errors = new JsonAuthErrors(resolver);
        http
                .csrf(csrf -> csrf.disable())
                .formLogin(form -> form.disable())
                .httpBasic(basic -> basic.disable())
                .logout(logout -> logout.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(handling -> handling.authenticationEntryPoint(errors).accessDeniedHandler(errors))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/auth/**", "/actuator/health", "/actuator/health/**", "/error").permitAll()
                        // Public keys that verify tokens (RS256), for the gateway and the other services
                        .requestMatchers(HttpMethod.GET, "/.well-known/jwks.json").permitAll()
                        // Swagger: the API description is public, calling the API still needs a token
                        .requestMatchers("/v3/api-docs", "/v3/api-docs/**", "/swagger-ui.html", "/swagger-ui/**").permitAll()
                        // Any signed-in user: own profile, and user info used by other services (/users/lookup, /users/{id})
                        .requestMatchers(HttpMethod.GET, "/users/me", "/users/*", "/users/*/account-type").authenticated()
                        // Any signed-in user: change their own name and password
                        .requestMatchers(HttpMethod.PUT, "/users/me", "/users/me/password").authenticated()
                        // Everything else under /users is user management
                        .requestMatchers("/users", "/users/**").hasRole("ADMIN")
                        .anyRequest().authenticated())
                .addFilterBefore(new JwtAuthenticationFilter(jwtService, errors),
                        UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
