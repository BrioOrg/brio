# syntax=docker/dockerfile:1
#
# Backend image (ADR 0024). Build from the repository root — the Maven build copies
# content/referentiel and docs/schema onto the classpath:
#   docker build -f backend/Dockerfile .

FROM eclipse-temurin:21-jdk AS build
WORKDIR /src/backend

# Dependencies first, so source edits reuse the cached layer.
COPY backend/.mvn .mvn
COPY backend/mvnw backend/pom.xml ./
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -q dependency:go-offline

COPY content/referentiel /src/content/referentiel
COPY docs/schema /src/docs/schema
COPY backend/src src
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -q package -DskipTests \
    && cp target/brio-backend-*.jar /app.jar

FROM eclipse-temurin:21-jre
RUN useradd --system --uid 1001 --no-create-home brio
WORKDIR /app
COPY --from=build /app.jar app.jar
# Chapter files for the one-off `ingest` service (docker-compose.prod.yml).
COPY content content
USER brio
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
