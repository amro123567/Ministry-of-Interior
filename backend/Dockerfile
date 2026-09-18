# ---- build stage ----
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build

# Cache dependencies separately from source so a source-only change
# doesn't re-download the whole Maven repository on every build.
COPY pom.xml .
RUN mvn -B dependency:go-offline

COPY src ./src
RUN mvn -B clean package -DskipTests

# ---- runtime stage ----
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

RUN addgroup -S cts && adduser -S cts -G cts
COPY --from=build /build/target/cts-backend.jar app.jar
RUN mkdir -p /data/uploaded-documents && chown -R cts:cts /data /app
USER cts

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
