package vn.edu.qnu.st.nambede.auth.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class LoginAttemptsTest {

    private static final String EMAIL = "sv1@nambede.local";

    /** A clock the test moves forward by hand. */
    static final class TestClock extends Clock {
        Instant now = Instant.parse("2026-10-10T08:00:00Z");

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public Instant instant() {
            return now;
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }
    }

    private final TestClock clock = new TestClock();
    private final LoginAttempts attempts = new LoginAttempts(clock);

    private void failTimes(int times) {
        for (int i = 0; i < times; i++) {
            attempts.failed(EMAIL);
        }
    }

    @Test
    void fourFailuresStillAllowAnotherTry() {
        failTimes(LoginAttempts.MAX_FAILURES - 1);

        assertThat(attempts.retryAfterSeconds(EMAIL)).isZero();
    }

    @Test
    void fiveFailuresBlockUntilTheFirstOneIsOutOfTheWindow() {
        failTimes(1);
        clock.advance(Duration.ofMinutes(1));
        failTimes(LoginAttempts.MAX_FAILURES - 1);

        assertThat(attempts.retryAfterSeconds(EMAIL)).isEqualTo(LoginAttempts.WINDOW.minusMinutes(1).toSeconds());

        clock.advance(LoginAttempts.WINDOW.minusMinutes(1));
        assertThat(attempts.retryAfterSeconds(EMAIL)).isZero();
    }

    @Test
    void successClearsTheCount() {
        failTimes(LoginAttempts.MAX_FAILURES - 1);
        attempts.succeeded(EMAIL);
        failTimes(LoginAttempts.MAX_FAILURES - 1);

        assertThat(attempts.retryAfterSeconds(EMAIL)).isZero();
    }

    @Test
    void otherEmailsAreNotBlocked() {
        failTimes(LoginAttempts.MAX_FAILURES);

        assertThat(attempts.retryAfterSeconds(EMAIL)).isPositive();
        assertThat(attempts.retryAfterSeconds("sv2@nambede.local")).isZero();
    }
}
