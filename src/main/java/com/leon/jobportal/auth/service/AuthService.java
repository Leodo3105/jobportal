package com.leon.jobportal.auth.service;

import com.leon.jobportal.auth.dto.AuthResponse;
import com.leon.jobportal.auth.dto.LoginRequest;
import com.leon.jobportal.auth.dto.RegisterRequest;
import com.leon.jobportal.common.exception.ApiException;
import com.leon.jobportal.security.JwtProperties;
import com.leon.jobportal.security.JwtService;
import com.leon.jobportal.user.dto.UserResponse;
import com.leon.jobportal.user.entity.Role;
import com.leon.jobportal.user.entity.User;
import com.leon.jobportal.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final String INVALID_CREDENTIALS = "Invalid email or password";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final JwtProperties jwtProperties;

    @Transactional
    public UserResponse register(RegisterRequest request) {
        String email = normalizeEmail(request.email());
        if (userRepository.existsByEmail(email)) {
            throw new ApiException(HttpStatus.CONFLICT, "Email is already registered");
        }

        User user = new User(
                email,
                passwordEncoder.encode(request.password()),
                request.fullName().trim(),
                Role.valueOf(request.role().name()));
        return UserResponse.from(userRepository.save(user));
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        // Same error for unknown email, wrong password and disabled account,
        // so callers cannot probe which emails are registered.
        User user = userRepository.findByEmail(normalizeEmail(request.email()))
                .filter(u -> passwordEncoder.matches(request.password(), u.getPasswordHash()))
                .filter(User::isEnabled)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, INVALID_CREDENTIALS));

        return new AuthResponse(
                jwtService.generateToken(user),
                "Bearer",
                jwtProperties.expiration().toSeconds());
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
