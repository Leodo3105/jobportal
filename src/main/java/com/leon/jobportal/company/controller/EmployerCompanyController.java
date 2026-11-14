package com.leon.jobportal.company.controller;

import com.leon.jobportal.company.dto.CompanyRequest;
import com.leon.jobportal.company.dto.CompanyResponse;
import com.leon.jobportal.company.service.CompanyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * The logged-in employer's own company. The owner is always taken from the JWT, never from the request.
 */
@RestController
@RequestMapping("/api/v1/employer/company")
@RequiredArgsConstructor
public class EmployerCompanyController {

    private final CompanyService companyService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CompanyResponse create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CompanyRequest request) {
        return companyService.create(Long.valueOf(jwt.getSubject()), request);
    }

    @GetMapping
    public CompanyResponse getMyCompany(@AuthenticationPrincipal Jwt jwt) {
        return companyService.getMyCompany(Long.valueOf(jwt.getSubject()));
    }

    @PutMapping
    public CompanyResponse update(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CompanyRequest request) {
        return companyService.updateMyCompany(Long.valueOf(jwt.getSubject()), request);
    }
}
