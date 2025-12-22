INSERT INTO users (id, email, name, role, status, "createdAt", "updatedAt")
VALUES (
  'admin_stefan_001',
  'stefan@veda.legal',
  'Stefan Ratchev',
  'ADMIN',
  'ACTIVE',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  role = 'ADMIN',
  status = 'ACTIVE',
  "updatedAt" = NOW();
