package vn.edu.qnu.st.nambede.auth.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import vn.edu.qnu.st.nambede.auth.user.Role;
import vn.edu.qnu.st.nambede.auth.user.User;
import vn.edu.qnu.st.nambede.auth.user.UserRepository;
import vn.edu.qnu.st.nambede.auth.user.UserService;

/** Creates the first ADMIN account from ADMIN_EMAIL / ADMIN_PASSWORD if it does not exist yet. */
@Component
public class AdminSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminSeeder.class);

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final String email;
    private final String password;

    public AdminSeeder(UserRepository users, PasswordEncoder passwordEncoder,
            @Value("${app.admin.email}") String email, @Value("${app.admin.password}") String password) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.email = email;
        this.password = password;
    }

    @Override
    public void run(ApplicationArguments args) {
        String normalized = UserService.normalizeEmail(email);
        if (users.existsByEmail(normalized)) {
            return;
        }
        users.save(new User(normalized, passwordEncoder.encode(password), "Administrator", Role.ADMIN));
        log.info("Created the initial admin account {}", normalized);
    }
}
