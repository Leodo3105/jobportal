package com.leon.jobportal.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * @param secret     Base64-encoded HMAC key, at least 32 bytes once decoded
 * @param issuer     value of the "iss" claim; tokens with a different issuer are rejected
 * @param expiration access token lifetime, e.g. "1h"
 */
@ConfigurationProperties(prefix = "jwt")
public record JwtProperties(String secret, String issuer, Duration expiration) {
}
