/**
 * Genera el archivo pom.xml de Maven para el proyecto Spring Boot 3 generado.
 *
 * @returns Contenido del archivo pom.xml en formato string
 */
export function generatePomXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.2.5</version>
        <relativePath/> <!-- lookup parent from repository -->
    </parent>

    <groupId>com.example</groupId>
    <artifactId>generated-backend</artifactId>
    <version>0.0.1-SNAPSHOT</version>
    <name>generated-backend</name>
    <description>Backend generated automatically from UML diagrams</description>

    <properties>
        <java.version>17</java.version>
    </properties>

    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>

        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa</artifactId>
        </dependency>

        <dependency>
            <groupId>org.postgresql</groupId>
            <artifactId>postgresql</artifactId>
            <scope>runtime</scope>
        </dependency>

        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>
</project>
`;
}

/**
 * Genera el archivo application.properties con la configuración base de Spring Boot y PostgreSQL.
 *
 * @returns Contenido de application.properties en formato string
 */
export function generateApplicationProperties(): string {
  return `spring.datasource.url=jdbc:postgresql://localhost:5432/generated_db
spring.datasource.username=postgres
spring.datasource.password=postgres
spring.jpa.hibernate.ddl-auto=update
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect
server.port=8081
spring.jpa.show-sql=true
`;
}

/**
 * Genera la clase principal ejecutable de Spring Boot (GeneratedBackendApplication.java).
 *
 * @returns Contenido del archivo Java en formato string
 */
export function generateMainApplicationClass(): string {
  return `package com.example.generatedbackend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class GeneratedBackendApplication {
    public static void main(String[] args) {
        SpringApplication.run(GeneratedBackendApplication.class, args);
    }
}
`;
}
