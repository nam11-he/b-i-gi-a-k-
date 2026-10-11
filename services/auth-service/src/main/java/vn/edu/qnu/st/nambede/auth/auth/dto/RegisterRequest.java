package vn.edu.qnu.st.nambede.auth.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import vn.edu.qnu.st.nambede.auth.common.MaxBytes;

public record RegisterRequest(
        @NotBlank @Email @Size(max = 255) String email,
        @NotBlank @Size(min = 6) @MaxBytes(72) String password,
        @NotBlank @Size(max = 255) String fullName) {
}
