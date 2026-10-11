package vn.edu.qnu.st.nambede.auth.events;

import org.springframework.amqp.core.TopicExchange;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Events between services go through RabbitMQ: one topic exchange, the routing key is the event type.
 * Every service declares the exchange it uses (declaring it again is harmless), so start order does not matter.
 */
@Configuration
@EnableScheduling
public class Events {

    public static final String EXCHANGE = "nambede.events";

    /** An admin deleted a user: Class Service and Learning Service remove that user's data. */
    public static final String USER_DELETED = "user.deleted";

    @Bean
    TopicExchange eventsExchange() {
        return new TopicExchange(EXCHANGE, true, false);
    }
}
