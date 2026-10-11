package vn.edu.qnu.st.nambede.auth.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;

import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import vn.edu.qnu.st.nambede.auth.common.ApiException;
import vn.edu.qnu.st.nambede.auth.events.Events;
import vn.edu.qnu.st.nambede.auth.events.Outbox;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    // Cost 4 keeps the test fast; the application uses the default strength
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder(4);

    @Mock
    private UserRepository users;
    @Mock
    private Outbox outbox;

    private UserService service;
    private User teacher;

    @BeforeEach
    void setUp() {
        service = new UserService(users, passwordEncoder, outbox);
        teacher = new User("gv1@nambede.local", passwordEncoder.encode("Teacher@123"), "Trần Thị B", Role.TEACHER);
        // lenient: the tests that refuse a request early never look the user up
        org.mockito.Mockito.lenient().when(users.findById(3L)).thenReturn(Optional.of(teacher));
    }

    @Test
    void changePasswordStoresTheNewHash() {
        service.changePassword(3L, "Teacher@123", "Moi@2026");

        assertThat(passwordEncoder.matches("Moi@2026", teacher.getPasswordHash())).isTrue();
        assertThat(passwordEncoder.matches("Teacher@123", teacher.getPasswordHash())).isFalse();
    }

    @Test
    void changePasswordRefusesAWrongCurrentPassword() {
        assertThatThrownBy(() -> service.changePassword(3L, "sai-mat-khau", "Moi@2026"))
                .isInstanceOfSatisfying(ApiException.class, ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.FORBIDDEN));
        assertThat(passwordEncoder.matches("Teacher@123", teacher.getPasswordHash())).isTrue();
    }

    @Test
    void lockingOrChangingTheRoleEndsTheSessionsButTheAccountTypeDoesNot() {
        service.changeAccountType(3L, AccountType.VIP);
        assertThat(teacher.getTokenVersion()).isZero();

        service.changeStatus(3L, UserStatus.LOCKED, 1L);
        assertThat(teacher.getTokenVersion()).isEqualTo(1);
        service.changeStatus(3L, UserStatus.LOCKED, 1L); // already locked: nothing more to end
        service.changeStatus(3L, UserStatus.ACTIVE, 1L);
        assertThat(teacher.getTokenVersion()).isEqualTo(1);

        service.changeRole(3L, Role.ADMIN, 1L);
        assertThat(teacher.getTokenVersion()).isEqualTo(2);
        service.changeRole(3L, Role.ADMIN, 1L); // same role: the tokens are still right
        assertThat(teacher.getTokenVersion()).isEqualTo(2);
    }

    @Test
    void deleteAnnouncesTheDeletionToTheOtherServices() {
        org.springframework.test.util.ReflectionTestUtils.setField(teacher, "id", 3L);

        service.delete(3L, 1L);

        verify(users).delete(teacher);
        verify(outbox).add(Events.USER_DELETED, new UserService.UserDeleted(3L, "TEACHER"));
    }

    @Test
    void deletingYourselfIsRefusedAndAnnouncesNothing() {
        assertThatThrownBy(() -> service.delete(1L, 1L)).isInstanceOf(ApiException.class);

        verify(outbox, never()).add(anyString(), any());
    }

    @Test
    void changePasswordRefusesTheSamePassword() {
        assertThatThrownBy(() -> service.changePassword(3L, "Teacher@123", "Teacher@123"))
                .isInstanceOfSatisfying(ApiException.class, ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
    }
}
