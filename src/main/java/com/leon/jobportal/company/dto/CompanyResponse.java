package com.leon.jobportal.company.dto;

import com.leon.jobportal.company.entity.Company;

import java.time.Instant;

public record CompanyResponse(
        Long id,
        String name,
        String website,
        String address,
        String industry,
        String description,
        Instant createdAt,
        Instant updatedAt) {

    public static CompanyResponse from(Company company) {
        return new CompanyResponse(
                company.getId(),
                company.getName(),
                company.getWebsite(),
                company.getAddress(),
                company.getIndustry(),
                company.getDescription(),
                company.getCreatedAt(),
                company.getUpdatedAt());
    }
}
