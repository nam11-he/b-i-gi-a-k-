package vn.edu.qnu.st.nambede.auth.user;

import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.qnu.st.nambede.auth.common.ApiException;
import vn.edu.qnu.st.nambede.auth.events.Events;
import vn.edu.qnu.st.nambede.auth.events.Outbox;
import vn.edu.qnu.st.nambede.auth.user.dto.AccountTypeResponse;
import vn.edu.qnu.st.nambede.auth.user.dto.UserResponse;

@Service
public class UserService {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final Outbox outbox;

    public UserService(UserRepository users, PasswordEncoder passwordEncoder, Outbox outbox) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.outbox = outbox;
    }

    /** Data of the user.deleted event: the role tells consumers what to clean up (a student's classes, points...). */
    public record UserDeleted(Long userId, String role) {
    }

    public static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    @Transactional(readOnly = true)
    public List<UserResponse> list(Role role) {
        List<User> result = role == null ? users.findAllByOrderByIdAsc() : users.findByRoleOrderByIdAsc(role);
        return result.stream().map(UserResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public UserResponse get(Long id) {
        return UserResponse.from(find(id));
    }

    private static final int MAX_LOOKUP = 500;

    @Transactional(readOnly = true)
    public List<UserResponse> lookup(Collection<Long> ids) {
        if (ids.size() > MAX_LOOKUP) {
            throw ApiException.badRequest("At most " + MAX_LOOKUP + " ids per lookup");
        }
        return users.findAllById(new HashSet<>(ids)).stream()
                .sorted(Comparator.comparing(User::getId))
                .map(UserResponse::from)
                .toList();
    }

    @Transactional
    public User create(String email, String password, String fullName, Role role) {
        String normalized = normalizeEmail(email);
        if (users.existsByEmail(normalized)) {
            throw ApiException.conflict("Email is already registered");
        }
        return users.save(new User(normalized, passwordEncoder.encode(password), fullName.trim(), role));
    }

    @Transactional
    public UserResponse updateFullName(Long id, String fullName) {
        User user = find(id);
        user.setFullName(fullName.trim());
        return UserResponse.from(user);
    }

    /** The signed-in user changes their own password; the current one must be right. */
    @Transactional
    public void changePassword(Long id, String currentPassword, String newPassword) {
        User user = find(id);
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            // 403, not 401: the session is fine, only this request is refused
            throw new ApiException(HttpStatus.FORBIDDEN, "Current password is incorrect");
        }
        if (passwordEncoder.matches(newPassword, user.getPasswordHash())) {
            throw ApiException.badRequest("The new password must be different from the current one");
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
    }

    @Transactional
    public void delete(Long id, Long currentUserId) {
        if (id.equals(currentUserId)) {
            throw ApiException.badRequest("You cannot delete your own account");
        }
        User user = find(id);
        users.delete(user);
        // Same transaction: the other services hear about it if and only if the user is really deleted
        outbox.add(Events.USER_DELETED, new UserDeleted(user.getId(), user.getRole().name()));
    }

    @Transactional
    public UserResponse changeRole(Long id, Role role, Long currentUserId) {
        if (id.equals(currentUserId)) {
            throw ApiException.badRequest("You cannot change your own role");
        }
        User user = find(id);
        if (user.getRole() != role) {
            user.setRole(role);
            // The role is written in the token: the old tokens must not keep the old rights
            user.endSessions();
        }
        return UserResponse.from(user);
    }

    @Transactional
    public UserResponse changeStatus(Long id, UserStatus status, Long currentUserId) {
        if (id.equals(currentUserId) && status == UserStatus.LOCKED) {
            throw ApiException.badRequest("You cannot lock your own account");
        }
        User user = find(id);
        if (status == UserStatus.LOCKED && user.getStatus() != UserStatus.LOCKED) {
            // A locked user is signed out now, not when the token expires
            user.endSessions();
        }
        user.setStatus(status);
        return UserResponse.from(user);
    }

    @Transactional
    public UserResponse changeAccountType(Long id, AccountType accountType) {
        User user = find(id);
        user.setAccountType(accountType);
        return UserResponse.from(user);
    }

    @Transactional(readOnly = true)
    public AccountTypeResponse accountType(Long id) {
        return new AccountTypeResponse(id, find(id).getAccountType());
    }

    private User find(Long id) {
        return users.findById(id).orElseThrow(() -> ApiException.notFound("User " + id + " not found"));
    }
}
