package com.leon.jobportal.user;

import com.leon.jobportal.user.entity.Role;
import com.leon.jobportal.user.entity.User;
import com.leon.jobportal.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Locale;

/**
 * Creates the initial admin account from ADMIN_EMAIL / ADMIN_PASSWORD if it does not exist yet.
 * Never overwrites an existing account.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AdminAccountInitializer implements ApplicationRunner {

    private final AdminProperties adminProperties;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!StringUtils.hasText(adminProperties.email()) || !StringUtils.hasText(adminProperties.password())) {
            log.warn("ADMIN_EMAIL or ADMIN_PASSWORD is not set; skipping admin account creation");
            return;
        }

        String email = adminProperties.email().trim().toLowerCase(Locale.ROOT);
        if (userRepository.existsByEmail(email)) {
            log.info("Admin account {} already exists", email);
            return;
        }

        userRepository.save(new User(email, passwordEncoder.encode(adminProperties.password()), "Administrator", Role.ADMIN));
        log.info("Created admin account {}", email);
    }
}
