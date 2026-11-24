INSERT OR REPLACE INTO app_settings (key, value, updated_by, updatedAt)
VALUES (
  'company',
  '{"name":"ZAQONE TRAVEL & TOURS SDN BHD","brandName":"ZAQONE Travel","registrationNo":"SA0123456789-KLM","licenseNo":"KPL/LN/000012345","licenseExpiry":"2028-06-30","phone":"+60 3-2711 8899","email":"hello@zaqone.travel","website":"https://travelcrm.zaqone.com","address":"Jalan Ampang 88, 50450 Kuala Lumpur","city":"Kuala Lumpur","state":"Wilayah Persekutuan","postcode":"50450","country":"Malaysia","taxId":"MY-TIN-2026-001","bankName":"Maybank Islamic Berhad","bankAccount":"1234 5678 9012","bankHolder":"ZAQONE TRAVEL & TOURS SDN BHD"}',
  'system',
  unixepoch()
);

INSERT OR REPLACE INTO app_settings (key, value, updated_by, updatedAt)
VALUES (
  'site',
  '{"brandName":"ZAQONE Travel","tagline":"Agensi pelancongan","whatsapp":"60123880030","currency":"MYR","defaultLang":"ms"}',
  'system',
  unixepoch()
);
