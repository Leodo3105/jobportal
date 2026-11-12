package com.leon.jobportal.common.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * Business error carrying the HTTP status to return. Handled by {@link GlobalExceptionHandler}.
 */
@Getter
public class ApiException extends RuntimeException {

    private final HttpStatus status;

    public ApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }
}
