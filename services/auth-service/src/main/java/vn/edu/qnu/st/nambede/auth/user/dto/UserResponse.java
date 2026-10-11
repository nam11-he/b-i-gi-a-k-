package vn.edu.qnu.st.nambede.auth.user.dto;

import java.time.Instant;
import vn.edu.qnu.st.nambede.auth.user.AccountType;
import vn.edu.qnu.st.nambede.auth.user.Role;
import vn.edu.qnu.st.nambede.auth.user.User;
import vn.edu.qnu.st.nambede.auth.user.UserStatus;

public record UserResponse(
        Long id,
        String email,
        String fullName,
        Role role,
        UserStatus status,
        AccountType accountType,
        Instant createdAt) {

    public static UserResponse from(User user) {
        return new UserResponse(user.getId(), user.getEmail(), user.getFullName(), user.getRole(),
                user.getStatus(), user.getAccountType(), user.getCreatedAt());
    }
}
