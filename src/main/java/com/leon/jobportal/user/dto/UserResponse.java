package com.leon.jobportal.user.dto;

import com.leon.jobportal.user.entity.Role;
import com.leon.jobportal.user.entity.User;

import java.time.Instant;

public record UserResponse(
        Long id,
        String email,
        String fullName,
        Role role,
        Instant createdAt) {

    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getFullName(),
                user.getRole(),
                user.getCreatedAt());
    }
}
