package com.moi.cts.exception;

public class ApiExceptions {

    public static class NotFoundException extends RuntimeException {
        public NotFoundException(String message) { super(message); }
    }

    public static class BadRequestException extends RuntimeException {
        public BadRequestException(String message) { super(message); }
    }

    public static class IllegalTransitionException extends RuntimeException {
        public IllegalTransitionException(String message) { super(message); }
    }

    public static class AuthException extends RuntimeException {
        public AuthException(String message) { super(message); }
    }
}
