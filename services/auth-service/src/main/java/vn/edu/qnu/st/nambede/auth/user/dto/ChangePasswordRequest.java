package vn.edu.qnu.st.nambede.auth.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import vn.edu.qnu.st.nambede.auth.common.MaxBytes;

/** A user changing their own password: the current one is checked first. Same length rule as registering (6 characters to 72 bytes). */
public record ChangePasswordRequest(
        @NotBlank String currentPassword,
        @NotBlank @Size(min = 6) @MaxBytes(72) String newPassword) {
}
