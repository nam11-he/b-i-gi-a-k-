# syntax=docker/dockerfile:1.7
FROM eclipse-temurin:17-jdk-noble AS build
WORKDIR /workspace
COPY mvnw pom.xml ./
COPY .mvn .mvn
# Downloads Maven and the dependencies once; the cache mount keeps them between builds
RUN --mount=type=cache,target=/root/.m2,sharing=locked ./mvnw -q -B -ntp dependency:go-offline
COPY src src
ARG SKIP_TESTS=false
RUN --mount=type=cache,target=/root/.m2,sharing=locked \
    ./mvnw -q -B -ntp package -DskipTests=${SKIP_TESTS} && cp target/*.jar /app.jar

FROM eclipse-temurin:17-jre-noble
WORKDIR /app
COPY --from=build /app.jar app.jar
EXPOSE 8081
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
