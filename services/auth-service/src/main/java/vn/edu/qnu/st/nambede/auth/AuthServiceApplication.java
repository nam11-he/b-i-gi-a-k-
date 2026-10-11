package vn.edu.qnu.st.nambede.auth;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration;

// Login is handled by AuthController + JWT, so Spring's default in-memory user is not needed
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
public class AuthServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(AuthServiceApplication.class, args);
    }
}
