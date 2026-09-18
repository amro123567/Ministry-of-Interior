package com.moi.cts.entity;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "citizens")
public class Citizen {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 20)
    private String registryNumber;

    @Column(nullable = false, length = 100)
    private String firstNameEn;

    @Column(length = 100)
    private String lastNameEn;

    @Column(length = 100)
    private String firstNameAr;

    @Column(length = 100)
    private String lastNameAr;

    private LocalDate dateOfBirth;

    @Column(length = 10)
    private String gender;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "registered_office_id")
    private Office registeredOffice;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getRegistryNumber() { return registryNumber; }
    public void setRegistryNumber(String registryNumber) { this.registryNumber = registryNumber; }
    public String getFirstNameEn() { return firstNameEn; }
    public void setFirstNameEn(String firstNameEn) { this.firstNameEn = firstNameEn; }
    public String getLastNameEn() { return lastNameEn; }
    public void setLastNameEn(String lastNameEn) { this.lastNameEn = lastNameEn; }
    public String getFirstNameAr() { return firstNameAr; }
    public void setFirstNameAr(String firstNameAr) { this.firstNameAr = firstNameAr; }
    public String getLastNameAr() { return lastNameAr; }
    public void setLastNameAr(String lastNameAr) { this.lastNameAr = lastNameAr; }
    public LocalDate getDateOfBirth() { return dateOfBirth; }
    public void setDateOfBirth(LocalDate dateOfBirth) { this.dateOfBirth = dateOfBirth; }
    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }
    public Office getRegisteredOffice() { return registeredOffice; }
    public void setRegisteredOffice(Office registeredOffice) { this.registeredOffice = registeredOffice; }
}
