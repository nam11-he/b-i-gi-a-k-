package vn.edu.qnu.st.nambede.auth.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import vn.edu.qnu.st.nambede.auth.common.MaxBytes;
import vn.edu.qnu.st.nambede.auth.user.Role;

public record CreateUserRequest(
        @NotBlank @Email @Size(max = 255) String email,
        @NotBlank @Size(min = 6) @MaxBytes(72) String password,
        @NotBlank @Size(max = 255) String fullName,
        @NotNull Role role) {
}
