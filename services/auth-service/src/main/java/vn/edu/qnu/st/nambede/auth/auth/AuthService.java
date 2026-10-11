package vn.edu.qnu.st.nambede.auth.auth;

import io.jsonwebtoken.JwtException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.qnu.st.nambede.auth.auth.dto.LoginRequest;
import vn.edu.qnu.st.nambede.auth.auth.dto.LoginResponse;
import vn.edu.qnu.st.nambede.auth.auth.dto.RegisterRequest;
import vn.edu.qnu.st.nambede.auth.common.ApiException;
import vn.edu.qnu.st.nambede.auth.jwt.JwtService;
import vn.edu.qnu.st.nambede.auth.user.Role;
import vn.edu.qnu.st.nambede.auth.user.User;
import vn.edu.qnu.st.nambede.auth.user.UserRepository;
import vn.edu.qnu.st.nambede.auth.user.UserService;
import vn.edu.qnu.st.nambede.auth.user.UserStatus;
import vn.edu.qnu.st.nambede.auth.user.dto.UserResponse;

@Service
public class AuthService {

    private final UserRepository users;
    private final UserService userService;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final LoginAttempts loginAttempts;

    public AuthService(UserRepository users, UserService userService, PasswordEncoder passwordEncoder,
            JwtService jwtService, LoginAttempts loginAttempts) {
        this.users = users;
        this.userService = userService;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.loginAttempts = loginAttempts;
    }

    /** Too many wrong passwords for one email answer 429 for a while, even with the right password (see LoginAttempts). */
    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request) {
        String email = UserService.normalizeEmail(request.email());
        long retryAfter = loginAttempts.retryAfterSeconds(email);
        if (retryAfter > 0) {
            throw new TooManyLoginsException(retryAfter);
        }
        User user = users.findByEmail(email)
                .filter(candidate -> passwordEncoder.matches(request.password(), candidate.getPasswordHash()))
                .orElse(null);
        if (user == null) {
            loginAttempts.failed(email);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }
        loginAttempts.succeeded(email);
        if (user.getStatus() == UserStatus.LOCKED) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Account is locked");
        }
        return tokenFor(user);
    }

    /** Public sign-up always creates a STUDENT. Teachers and admins are created by an admin. */
    @Transactional
    public LoginResponse register(RegisterRequest request) {
        User user = userService.create(request.email(), request.password(), request.fullName(), Role.STUDENT);
        return tokenFor(user);
    }

    /**
     * Whether a token is still good right now: signed by us, not expired, its user still exists and is active, and it
     * was issued after the last time the user's sessions were ended. The gateway asks this for each request (cached a
     * few seconds). Throws 401 with the reason otherwise.
     */
    @Transactional(readOnly = true)
    public void checkSession(String token) {
        JwtService.Session session;
        try {
            session = jwtService.session(token);
        } catch (JwtException | IllegalArgumentException ex) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid or expired token");
        }
        User user = users.findById(session.userId())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "This account no longer exists"));
        if (user.getStatus() == UserStatus.LOCKED) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Account is locked");
        }
        if (user.getTokenVersion() != session.tokenVersion()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Session ended, sign in again");
        }
    }

    private LoginResponse tokenFor(User user) {
        String token = jwtService.issue(user.getId(), user.getEmail(), user.getFullName(), user.getRole(),
                user.getTokenVersion());
        return new LoginResponse(token, "Bearer", jwtService.expiresInSeconds(), UserResponse.from(user));
    }
}
