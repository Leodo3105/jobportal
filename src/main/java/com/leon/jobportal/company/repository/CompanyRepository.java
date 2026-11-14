package com.leon.jobportal.company.repository;

import com.leon.jobportal.company.entity.Company;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CompanyRepository extends JpaRepository<Company, Long> {

    Optional<Company> findByOwnerId(Long ownerId);

    boolean existsByOwnerId(Long ownerId);

    Page<Company> findByNameContainingIgnoreCase(String name, Pageable pageable);
}
