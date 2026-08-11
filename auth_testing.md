# Auth Testing Playbook (Akademi)

Unified session auth: email/password (bcrypt) + Emergent Google login. Both create a
`session_token` stored in `user_sessions` and set as an httpOnly cookie.

## Admin
- Email: yildirimkamil977@gmail.com
- Password: Admin!2026Panel

## API tests
```
# Register a student (accept_terms required)
curl -c c.txt -X POST $URL/api/auth/register -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"student1@example.com","password":"pass1234","accept_terms":true}'

# Login admin
curl -c admin.txt -X POST $URL/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"yildirimkamil977@gmail.com","password":"Admin!2026Panel"}'

# Current user
curl -b admin.txt $URL/api/auth/me
```

## Google session (manual)
Frontend redirects to https://auth.emergentagent.com/?redirect=<origin>/panel
Returns to #session_id=... , frontend POSTs {session_id, accept_terms} to /api/auth/google/session.
For automated tests, insert a user + user_sessions doc with a known session_token, then set
cookie `session_token` or use Authorization: Bearer <token>.
