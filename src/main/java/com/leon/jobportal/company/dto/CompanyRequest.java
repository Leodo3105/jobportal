package com.leon.jobportal.company.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.hibernate.validator.constraints.URL;

/**
 * Used for both create (POST) and full update (PUT).
 */
public record CompanyRequest(
        @NotBlank @Size(max = 150) String name,
        @URL @Size(max = 255) String website,
        @Size(max = 255) String address,
        @Size(max = 100) String industry,
        @Size(max = 5000) String description) {
}
