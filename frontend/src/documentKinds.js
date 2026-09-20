// Shared config for the 7 document subtypes (ERD domain 6) -- one map
// from a URL-friendly key to the API path segment
// (POST/GET /api/documents/<apiSegment>) and the DocumentType seed code
// (DataSeeder) used to resolve documentTypeId, instead of duplicating a
// switch statement across DocumentsSection/DocumentCreatePage/
// DocumentDetailPage.
//
// National ID cards are deliberately left out of the per-id detail
// lookup: the backend never got a `GET /api/documents/national-id-cards/
// {id}` endpoint (only the create POST and the citizen-scoped
// `GET /api/citizens/{id}/national-id-cards` list) -- so DocumentsSection
// renders a card's detail from that list directly instead of linking to
// a route the API can't serve.
export const DOCUMENT_KINDS = [
  { key: 'birth', apiSegment: 'birth-certificates', typeCode: 'BIRTH_CERT', labelKey: 'documentRegistry.kindBirth', hasDetailRoute: true },
  { key: 'marriage', apiSegment: 'marriage-certificates', typeCode: 'MARRIAGE_CERT', labelKey: 'documentRegistry.kindMarriage', hasDetailRoute: true },
  { key: 'divorce', apiSegment: 'divorce-certificates', typeCode: 'DIVORCE_CERT', labelKey: 'documentRegistry.kindDivorce', hasDetailRoute: true },
  { key: 'death', apiSegment: 'death-certificates', typeCode: 'DEATH_CERT', labelKey: 'documentRegistry.kindDeath', hasDetailRoute: true },
  { key: 'nationalId', apiSegment: 'national-id-cards', typeCode: 'NATIONAL_ID', labelKey: 'documentRegistry.kindNationalId', hasDetailRoute: false },
  { key: 'naturalization', apiSegment: 'naturalization-records', typeCode: 'NATURALIZATION', labelKey: 'documentRegistry.kindNaturalization', hasDetailRoute: true },
  { key: 'nameChange', apiSegment: 'name-change-records', typeCode: 'NAME_CHANGE', labelKey: 'documentRegistry.kindNameChange', hasDetailRoute: true },
];

export function kindByTypeCode(code) {
  return DOCUMENT_KINDS.find((k) => k.typeCode === code);
}

export function kindByApiSegment(segment) {
  return DOCUMENT_KINDS.find((k) => k.apiSegment === segment);
}
