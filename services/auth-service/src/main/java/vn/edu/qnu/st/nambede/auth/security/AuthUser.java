package vn.edu.qnu.st.nambede.auth.security;

import java.util.List;
import org.springframework.security.core.AuthenticatedPrincipal;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

/** The caller as read from a verified JWT. Inject it with {@code @AuthenticationPrincipal AuthUser}. */
public record AuthUser(Long id, String email, String role) implements AuthenticatedPrincipal {

    @Override
    public String getName() {
        return String.valueOf(id);
    }

    public List<GrantedAuthority> authorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role));
    }
}
