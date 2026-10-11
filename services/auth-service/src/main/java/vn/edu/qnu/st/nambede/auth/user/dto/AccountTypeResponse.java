package vn.edu.qnu.st.nambede.auth.user.dto;

import vn.edu.qnu.st.nambede.auth.user.AccountType;

/** Used by other services, e.g. Learning Service: FREE = 20 practice questions, VIP = 50. */
public record AccountTypeResponse(Long userId, AccountType accountType) {
}
