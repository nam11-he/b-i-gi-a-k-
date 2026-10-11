package vn.edu.qnu.st.nambede.auth.auth;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Failed sign-ins per email, against password guessing: after {@link #MAX_FAILURES} failures within {@link #WINDOW}
 * the email cannot sign in until the oldest of them is older than the window. A successful sign-in clears the count.
 *
 * <p>Counted per email, not per IP: behind nginx and Docker's port mapping most clients reach the gateway from the
 * same address. Kept in memory, which is enough for one auth-service instance; several instances would need a shared
 * store (a database table or Redis).
 */
@Component
public class LoginAttempts {

    static final int MAX_FAILURES = 5;
    static final Duration WINDOW = Duration.ofMinutes(5);
    /** Above this many emails, the ones without a recent failure are dropped so random emails cannot fill the memory. */
    private static final int PRUNE_ABOVE = 10_000;

    private final Clock clock;
    private final Map<String, Deque<Instant>> failures = new ConcurrentHashMap<>();

    @Autowired
    public LoginAttempts() {
        this(Clock.systemUTC());
    }

    LoginAttempts(Clock clock) {
        this.clock = clock;
    }

    /** Seconds until {@code email} may try again, or 0 when it may sign in now. */
    public long retryAfterSeconds(String email) {
        Deque<Instant> recent = failures.get(email);
        if (recent == null) {
            return 0;
        }
        synchronized (recent) {
            Instant now = clock.instant();
            dropExpired(recent, now);
            if (recent.size() < MAX_FAILURES) {
                return 0;
            }
            Duration wait = Duration.between(now, recent.peekFirst().plus(WINDOW));
            return Math.max(1, (wait.toMillis() + 999) / 1000);
        }
    }

    public void failed(String email) {
        if (failures.size() > PRUNE_ABOVE) {
            prune();
        }
        Deque<Instant> recent = failures.computeIfAbsent(email, key -> new ArrayDeque<>());
        synchronized (recent) {
            Instant now = clock.instant();
            dropExpired(recent, now);
            recent.addLast(now);
            while (recent.size() > MAX_FAILURES) {
                recent.removeFirst();
            }
        }
    }

    public void succeeded(String email) {
        failures.remove(email);
    }

    private void prune() {
        Instant now = clock.instant();
        failures.values().removeIf(recent -> {
            synchronized (recent) {
                dropExpired(recent, now);
                return recent.isEmpty();
            }
        });
    }

    private static void dropExpired(Deque<Instant> recent, Instant now) {
        while (!recent.isEmpty() && !recent.peekFirst().plus(WINDOW).isAfter(now)) {
            recent.removeFirst();
        }
    }
}
