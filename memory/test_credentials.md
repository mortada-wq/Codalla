# Codalla Test Credentials

## Auth methods enabled
- Email + Password (JWT httpOnly cookies)
- Emergent-managed Google Auth
- Both methods link to the same user via matching email

## Test User (created via API)
- **Email**: mortada@codalla.dev
- **Password**: testpassword123
- **Name**: Mortada Gzar
- **User ID**: 041a5410-4905-43a5-b04a-9a8bacd629e1
- **Role**: owner

## Auth endpoints (public)
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/refresh
- POST /api/auth/google/session   (body: { sessionId })
- POST /api/auth/forgot-password
- POST /api/auth/reset-password

## Auth endpoints (protected — require cookie)
- GET  /api/auth/me
- POST /api/auth/logout
- PATCH /api/auth/profile
- POST /api/auth/change-password

## All other /api/* routes now require auth (401 without cookie)

## Session details
- Access token: 15 min (httpOnly, SameSite=Lax, path=/)
- Refresh token: 7 days (httpOnly, SameSite=Lax, path=/)
- JWT_SECRET stored in supervisor env for codalla-api

## Brute-force protection
- 5 failed logins in a row locks the identifier (ip:email) for 15 minutes
- Cleared on any successful login
