package com.moi.cts.security;

import com.moi.cts.entity.AppUser;
import com.moi.cts.entity.Permission;
import com.moi.cts.entity.Role;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.Instant;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Set;

public class AppUserPrincipal implements UserDetails {

    private final AppUser user;

    public AppUserPrincipal(AppUser user) {
        this.user = user;
    }

    public AppUser getUser() { return user; }
    public Long getId() { return user.getId(); }

    /**
     * Every request's authorization decision is made against this set, not
     * against role names -- it carries a {@code ROLE_<name>} authority per
     * role (kept for readability/back-compat, e.g. logs) plus the raw
     * permission code for every permission any of the user's roles grants.
     * SecurityConfig's {@code hasAuthority("SOME_PERMISSION")} matchers,
     * and RequestService.transition()'s check, both read from here -- so a
     * role's actual access is entirely determined by {@code role_permissions}
     * in the database, not by anything hardcoded in Java.
     */
    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        Set<GrantedAuthority> authorities = new LinkedHashSet<>();
        for (Role role : user.getRoles()) {
            authorities.add(new SimpleGrantedAuthority("ROLE_" + role.getName().name()));
            for (Permission permission : role.getPermissions()) {
                authorities.add(new SimpleGrantedAuthority(permission.getCode()));
            }
        }
        return authorities;
    }

    @Override public String getPassword() { return user.getPasswordHash(); }
    @Override public String getUsername() { return user.getUsername(); }
    @Override public boolean isAccountNonExpired() { return true; }
    @Override
    public boolean isAccountNonLocked() {
        // Checked by DaoAuthenticationProvider before the password is even
        // compared, so a locked account gets a distinct LockedException
        // instead of the generic BadCredentialsException a wrong password
        // produces -- AuthService.login() relies on that distinction.
        return user.getLockedUntil() == null || user.getLockedUntil().isBefore(Instant.now());
    }
    @Override public boolean isCredentialsNonExpired() { return true; }
    @Override public boolean isEnabled() { return user.isEnabled(); }
}
