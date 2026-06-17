/*
 * PetScholar real login configuration.
 * 這個檔案不能只靠 ChatGPT 自動填滿，因為 OAuth/SSO 需要你在各平台後台申請正式憑證。
 *
 * 1) Google:
 *    - 到 Google Cloud Console 建立 OAuth Web Client ID。
 *    - Authorized JavaScript origins 加入你的正式網域，例如 https://your-domain.example。
 *    - 將 clientId 填到下方 google.clientId。
 *
 * 2) Apple:
 *    - 到 Apple Developer 建立 Services ID，啟用 Sign in with Apple。
 *    - 登記並驗證你的網域與 Redirect URI。
 *    - 將 Services ID 填到 apple.clientId，redirectURI 填正式回呼網址。
 *
 * 3) 北科校園入口:
 *    - 需由學校資訊單位核發 SSO/OAuth/SAML/CAS 設定。
 *    - 若學校提供 OIDC/OAuth2，填 authorizeUrl、clientId、redirectUri。
 *    - 若學校提供 SAML/CAS，通常還需要後端驗證 ticket/assertion，不能只靠靜態 HTML 完成安全登入。
 */
window.PetScholarAuthConfig = {
  google: {
    clientId: "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"
  },
  apple: {
    clientId: "YOUR_APPLE_SERVICE_ID",               // 例如 com.yourteam.petscholar.web
    redirectURI: "https://YOUR_DOMAIN/auth/callback.html",
    scope: "name email"
  },
  schoolSso: {
    authorizeUrl: "YOUR_NTUT_SSO_AUTHORIZE_URL",     // 由北科資訊單位提供
    clientId: "YOUR_NTUT_SSO_CLIENT_ID",
    redirectUri: "https://YOUR_DOMAIN/auth/callback.html",
    responseType: "code",
    scope: "openid profile email"
  }
};
