package com.leon.jobportal.company.service;

import com.leon.jobportal.common.dto.PageResponse;
import com.leon.jobportal.common.exception.ApiException;
import com.leon.jobportal.company.dto.CompanyRequest;
import com.leon.jobportal.company.dto.CompanyResponse;
import com.leon.jobportal.company.entity.Company;
import com.leon.jobportal.company.repository.CompanyRepository;
import com.leon.jobportal.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class CompanyService {

    private final CompanyRepository companyRepository;
    private final UserRepository userRepository;

    @Transactional
    public CompanyResponse create(Long userId, CompanyRequest request) {
        if (companyRepository.existsByOwnerId(userId)) {
            throw new ApiException(HttpStatus.CONFLICT, "Company profile already exists");
        }

        // getReferenceById only creates a reference by id; no query to the users table
        Company company = new Company(userRepository.getReferenceById(userId));
        applyRequest(company, request);
        return CompanyResponse.from(companyRepository.save(company));
    }

    @Transactional(readOnly = true)
    public CompanyResponse getMyCompany(Long userId) {
        return CompanyResponse.from(findByOwner(userId));
    }

    @Transactional
    public CompanyResponse updateMyCompany(Long userId, CompanyRequest request) {
        Company company = findByOwner(userId);
        applyRequest(company, request);
        // Changes to a managed entity would be saved at commit anyway (dirty checking), but
        // @UpdateTimestamp is only set on flush, so flush now to return the new updatedAt.
        return CompanyResponse.from(companyRepository.saveAndFlush(company));
    }

    @Transactional(readOnly = true)
    public CompanyResponse getById(Long id) {
        Company company = companyRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Company not found"));
        return CompanyResponse.from(company);
    }

    @Transactional(readOnly = true)
    public PageResponse<CompanyResponse> search(String keyword, Pageable pageable) {
        Page<Company> companies;
        if (StringUtils.hasText(keyword)) {
            companies = companyRepository.findByNameContainingIgnoreCase(keyword.trim(), pageable);
        } else {
            companies = companyRepository.findAll(pageable);
        }
        return PageResponse.from(companies.map(CompanyResponse::from));
    }

    private Company findByOwner(Long userId) {
        return companyRepository.findByOwnerId(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "You have not created a company profile yet"));
    }

    private void applyRequest(Company company, CompanyRequest request) {
        company.setName(request.name().trim());
        company.setWebsite(trimToNull(request.website()));
        company.setAddress(trimToNull(request.address()));
        company.setIndustry(trimToNull(request.industry()));
        company.setDescription(trimToNull(request.description()));
    }

    private static String trimToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}
