package com.moi.cts;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class CtsBackendApplication {
    public static void main(String[] args) {
        SpringApplication.run(CtsBackendApplication.class, args);
    }
}
