# PetScholar 真實登入串接說明

本版已在登入頁加入三個真實串接入口：北科校園入口、Google、Apple。

## 必填設定
請先部署到 HTTPS 網域，然後修改根目錄 `auth-config.js`。

### Google
1. 到 Google Cloud Console 建立 OAuth Web Client ID。
2. 在 Authorized JavaScript origins 加入你的正式網域。
3. 將 Client ID 填入 `PetScholarAuthConfig.google.clientId`。

### Apple
1. 到 Apple Developer 建立 Services ID，啟用 Sign in with Apple。
2. 完成網域驗證並登記 Redirect URI。
3. 將 Services ID 與 Redirect URI 填入 `PetScholarAuthConfig.apple`。

### 北科校園入口
此項需要北科資訊單位提供正式 SSO 設定。若是 OIDC/OAuth2，填入 authorizeUrl、clientId、redirectUri。若是 CAS/SAML，必須加後端驗證票證，純靜態頁面無法安全完成真正登入。

## 注意
目前網站仍保留靜態 demo 的 localStorage 狀態保存方式。正式上線時，請以後端 session / token 驗證取代單純 localStorage。


## 本版已完成的介面連結
- 根目錄 `index.html` 的「登入」會導向 `stitch_studypet_village 2/_1/code.html`。
- 所有 Stitch 子頁面的「會員登入 / 登入」按鈕都會導向同一個登入頁。
- 登入頁已提供北科校園入口、Google、Apple 三個入口；填入正式 OAuth / SSO 憑證後才能真正驗證身分。
