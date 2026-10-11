package vn.edu.qnu.st.nambede.auth.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import vn.edu.qnu.st.nambede.auth.auth.dto.LoginRequest;
import vn.edu.qnu.st.nambede.auth.common.ApiException;
import vn.edu.qnu.st.nambede.auth.jwt.JwtProperties;
import vn.edu.qnu.st.nambede.auth.jwt.JwtService;
import vn.edu.qnu.st.nambede.auth.jwt.TestKeys;
import vn.edu.qnu.st.nambede.auth.user.Role;
import vn.edu.qnu.st.nambede.auth.user.User;
import vn.edu.qnu.st.nambede.auth.user.UserRepository;
import vn.edu.qnu.st.nambede.auth.user.UserService;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AuthServiceTest {

    // Cost 4 keeps the test fast; the application uses the default strength
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder(4);
    private final LoginAttempts loginAttempts = new LoginAttempts();

    @Mock
    private UserRepository users;

    private AuthService service;
    private JwtService jwtService;
    private User student;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService(new JwtProperties("nambede-auth", 60), TestKeys.KEYS);
        service = new AuthService(users, new UserService(users, passwordEncoder, org.mockito.Mockito.mock(vn.edu.qnu.st.nambede.auth.events.Outbox.class)), passwordEncoder, jwtService, loginAttempts);
        student = new User("sv1@nambede.local", passwordEncoder.encode("Student@123"), "Sinh Viên", Role.STUDENT);
        org.springframework.test.util.ReflectionTestUtils.setField(student, "id", 2L);
        when(users.findByEmail("sv1@nambede.local")).thenReturn(Optional.of(student));
        when(users.findById(2L)).thenReturn(Optional.of(student));
    }

    private void failTimes(int times) {
        for (int i = 0; i < times; i++) {
            assertThatThrownBy(() -> service.login(new LoginRequest("sv1@nambede.local", "sai-mat-khau")))
                    .isInstanceOfSatisfying(ApiException.class, ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED));
        }
    }

    @Test
    void rightPasswordSignsIn() {
        assertThat(service.login(new LoginRequest("sv1@nambede.local", "Student@123")).accessToken()).isNotBlank();
    }

    @Test
    void fiveWrongPasswordsBlockTheEmailEvenForTheRightPassword() {
        failTimes(LoginAttempts.MAX_FAILURES);

        // Written in another case: the email is normalised before it is counted
        assertThatThrownBy(() -> service.login(new LoginRequest(" SV1@nambede.local", "Student@123")))
                .isInstanceOfSatisfying(TooManyLoginsException.class, ex -> {
                    assertThat(ex.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
                    assertThat(ex.getRetryAfterSeconds()).isPositive();
                });
    }

    @Test
    void signingInClearsEarlierWrongPasswords() {
        failTimes(LoginAttempts.MAX_FAILURES - 1);
        service.login(new LoginRequest("sv1@nambede.local", "Student@123"));
        failTimes(LoginAttempts.MAX_FAILURES - 1);

        assertThat(service.login(new LoginRequest("sv1@nambede.local", "Student@123")).accessToken()).isNotBlank();
    }

    @Test
    void unknownEmailsAreCountedToo() {
        for (int i = 0; i < LoginAttempts.MAX_FAILURES; i++) {
            assertThatThrownBy(() -> service.login(new LoginRequest("ai-do@nambede.local", "x")))
                    .isInstanceOfSatisfying(ApiException.class, ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED));
        }

        assertThatThrownBy(() -> service.login(new LoginRequest("ai-do@nambede.local", "x")))
                .isInstanceOf(TooManyLoginsException.class);
    }

    private static void assertRefused(Runnable action, String message) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ApiException.class, ex -> {
            assertThat(ex.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED);
            assertThat(ex.getMessage()).isEqualTo(message);
        });
    }

    @Test
    void aFreshTokenHasAGoodSession() {
        String token = service.login(new LoginRequest("sv1@nambede.local", "Student@123")).accessToken();

        service.checkSession(token); // no exception
    }

    @Test
    void endingTheSessionsRefusesTokensIssuedBefore() {
        String before = service.login(new LoginRequest("sv1@nambede.local", "Student@123")).accessToken();
        student.endSessions(); // e.g. an admin changed the role

        assertRefused(() -> service.checkSession(before), "Session ended, sign in again");
        String after = service.login(new LoginRequest("sv1@nambede.local", "Student@123")).accessToken();
        service.checkSession(after);
    }

    @Test
    void aLockedOrDeletedAccountHasNoSession() {
        String token = service.login(new LoginRequest("sv1@nambede.local", "Student@123")).accessToken();

        student.setStatus(vn.edu.qnu.st.nambede.auth.user.UserStatus.LOCKED);
        assertRefused(() -> service.checkSession(token), "Account is locked");
        when(users.findById(2L)).thenReturn(Optional.empty());
        assertRefused(() -> service.checkSession(token), "This account no longer exists");
        assertRefused(() -> service.checkSession("not-a-jwt"), "Invalid or expired token");
    }
}
