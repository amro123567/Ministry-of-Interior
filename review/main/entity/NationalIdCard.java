package com.moi.cts.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "national_id_cards")
public class NationalIdCard {

    @Id
    private Long documentId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "document_id")
    private Document document;

    @Column(unique = true, length = 40)
    private String cardNumber;

    @Column(length = 500)
    private String biometricPhotoPath;

    @Column(length = 64)
    private String biometricPhotoHash;

    @Column(length = 64)
    private String fingerprintHash;

    @Column(length = 60)
    private String chipSerialNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CardStatus status = CardStatus.ACTIVE;

    public Long getDocumentId() { return documentId; }
    public Document getDocument() { return document; }
    public void setDocument(Document document) { this.document = document; }
    public String getCardNumber() { return cardNumber; }
    public void setCardNumber(String cardNumber) { this.cardNumber = cardNumber; }
    public String getBiometricPhotoPath() { return biometricPhotoPath; }
    public void setBiometricPhotoPath(String biometricPhotoPath) { this.biometricPhotoPath = biometricPhotoPath; }
    public String getBiometricPhotoHash() { return biometricPhotoHash; }
    public void setBiometricPhotoHash(String biometricPhotoHash) { this.biometricPhotoHash = biometricPhotoHash; }
    public String getFingerprintHash() { return fingerprintHash; }
    public void setFingerprintHash(String fingerprintHash) { this.fingerprintHash = fingerprintHash; }
    public String getChipSerialNumber() { return chipSerialNumber; }
    public void setChipSerialNumber(String chipSerialNumber) { this.chipSerialNumber = chipSerialNumber; }
    public CardStatus getStatus() { return status; }
    public void setStatus(CardStatus status) { this.status = status; }
}
