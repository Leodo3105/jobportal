package com.leon.jobportal.auth.dto;

/**
 * @param expiresIn token lifetime in seconds
 */
public record AuthResponse(String accessToken, String tokenType, long expiresIn) {
}
