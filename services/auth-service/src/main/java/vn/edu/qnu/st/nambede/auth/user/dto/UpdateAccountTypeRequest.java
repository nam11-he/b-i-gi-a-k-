package vn.edu.qnu.st.nambede.auth.user.dto;

import jakarta.validation.constraints.NotNull;
import vn.edu.qnu.st.nambede.auth.user.AccountType;

public record UpdateAccountTypeRequest(@NotNull AccountType accountType) {
}
