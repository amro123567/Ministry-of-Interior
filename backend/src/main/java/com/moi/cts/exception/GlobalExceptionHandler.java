package com.moi.cts.exception;

import com.moi.cts.dto.MiscDtos;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final org.slf4j.Logger LOG = org.slf4j.LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiExceptions.NotFoundException.class)
    public ResponseEntity<MiscDtos.ApiError> notFound(ApiExceptions.NotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MiscDtos.ApiError(e.getMessage()));
    }

    @ExceptionHandler({ApiExceptions.BadRequestException.class, ApiExceptions.IllegalTransitionException.class})
    public ResponseEntity<MiscDtos.ApiError> badRequest(RuntimeException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new MiscDtos.ApiError(e.getMessage()));
    }

    @ExceptionHandler(ApiExceptions.AuthException.class)
    public ResponseEntity<MiscDtos.ApiError> auth(ApiExceptions.AuthException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MiscDtos.ApiError(e.getMessage()));
    }

    @ExceptionHandler(org.springframework.security.access.AccessDeniedException.class)
    public ResponseEntity<MiscDtos.ApiError> forbidden(Exception e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new MiscDtos.ApiError("Not permitted for your role."));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<MiscDtos.ApiError> validation(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .findFirst().orElse("Invalid request");
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new MiscDtos.ApiError(msg));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<MiscDtos.ApiError> generic(Exception e) {
        // The detail (SQL, class names, paths) goes to the server log only; the caller gets a
        // reference they can quote, never the raw exception message.
        String ref = java.util.UUID.randomUUID().toString().substring(0, 8);
        LOG.error("Unexpected error (ref {})", ref, e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new MiscDtos.ApiError("Unexpected error. Please try again; if it keeps happening, quote reference " + ref + "."));
    }
}
