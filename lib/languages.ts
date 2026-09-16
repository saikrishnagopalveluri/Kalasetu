// India's 22 scheduled languages (8th Schedule) + English.
export const LANGUAGES = [
  { id: 'en', label: 'English', name: 'English' },
  { id: 'hi', label: 'हिंदी', name: 'Hindi' },
  { id: 'bn', label: 'বাংলা', name: 'Bengali' },
  { id: 'te', label: 'తెలుగు', name: 'Telugu' },
  { id: 'mr', label: 'मराठी', name: 'Marathi' },
  { id: 'ta', label: 'தமிழ்', name: 'Tamil' },
  { id: 'ur', label: 'اردو', name: 'Urdu' },
  { id: 'gu', label: 'ગુજરાતી', name: 'Gujarati' },
  { id: 'kn', label: 'ಕನ್ನಡ', name: 'Kannada' },
  { id: 'or', label: 'ଓଡ଼ିଆ', name: 'Odia' },
  { id: 'pa', label: 'ਪੰਜਾਬੀ', name: 'Punjabi' },
  { id: 'ml', label: 'മലയാളം', name: 'Malayalam' },
  { id: 'as', label: 'অসমীয়া', name: 'Assamese' },
  { id: 'mai', label: 'मैथिली', name: 'Maithili' },
  { id: 'sat', label: 'ᱥᱟᱱᱛᱟᱲᱤ', name: 'Santali' },
  { id: 'ks', label: 'کٲشُر', name: 'Kashmiri' },
  { id: 'ne', label: 'नेपाली', name: 'Nepali' },
  { id: 'gom', label: 'कोंकणी', name: 'Konkani' },
  { id: 'sd', label: 'سنڌي', name: 'Sindhi' },
  { id: 'doi', label: 'डोगरी', name: 'Dogri' },
  { id: 'mni', label: 'মৈতৈলোন্', name: 'Manipuri' },
  { id: 'sa', label: 'संस्कृतम्', name: 'Sanskrit' },
  { id: 'brx', label: 'बड़ो', name: 'Bodo' },
] as const

export type LanguageId = typeof LANGUAGES[number]['id']

export const LANGUAGE_NAMES: Record<string, string> = Object.fromEntries(
  LANGUAGES.map((l) => [l.id, l.name])
)
