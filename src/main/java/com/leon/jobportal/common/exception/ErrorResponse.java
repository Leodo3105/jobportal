package com.leon.jobportal.common.exception;

import com.fasterxml.jackson.annotation.JsonInclude;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(
        int status,
        String error,
        String message,
        Instant timestamp,
        Map<String, String> fieldErrors) {

    public static ErrorResponse of(HttpStatus status, String message) {
        return of(status, message, null);
    }

    public static ErrorResponse of(HttpStatus status, String message, Map<String, String> fieldErrors) {
        return new ErrorResponse(status.value(), status.getReasonPhrase(), message, Instant.now(), fieldErrors);
    }
}
