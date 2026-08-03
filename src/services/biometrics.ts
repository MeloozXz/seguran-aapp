import { StorageService } from './storage';
import { encryptData, decryptData, deriveKey, generateSalt } from '../crypto/webcrypto';

const BIOMETRIC_KEY_PREFIX = 'zk_bio_auth_';
const BIOMETRIC_CONFIG_PREFIX = 'zk_bio_config_';

export interface BiometricConfig {
  enabled: boolean;
  credentialId: string; // Base64 do ID da credencial WebAuthn
  registeredAt: string;
}

export const BiometricsService = {
  /**
   * Verifica se a API de biometria (WebAuthn/Credentials) está disponível no dispositivo/navegador
   */
  async isAvailable(): Promise<boolean> {
    if (!window.PublicKeyCredential) return false;
    
    // Verifica se há suporte para biometria nativa da plataforma (TouchID, FaceID, Windows Hello)
    if (window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
    return false;
  },

  /**
   * Ativa a biometria para a conta ativa
   * @param email E-mail da conta ativa
   * @param masterPassword Senha Mestra atual que será criptografada
   */
  async registerBiometrics(email: string, masterPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      const isSupported = await this.isAvailable();
      if (!isSupported) {
        return { success: false, error: 'Biometria não suportada neste dispositivo ou navegador.' };
      }

      const emailKey = email.toLowerCase().trim();
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const userId = new Uint8Array(16);
      window.crypto.getRandomValues(userId);

      // Solicita registro de credencial biométrica local (WebAuthn)
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: challenge,
          rp: { name: "Cofre Seguro TCC" },
          user: {
            id: userId,
            name: emailKey,
            displayName: emailKey
          },
          pubKeyCredParams: [{ alg: -7, type: "public-key" }], // ES256
          authenticatorSelection: {
            authenticatorAttachment: "platform", // Força leitor nativo do dispositivo
            userVerification: "required"
          },
          timeout: 60000
        }
      }) as PublicKeyCredential;

      if (!credential) {
        return { success: false, error: 'O processo de registro de biometria foi cancelado.' };
      }

      // Converte o ID da credencial para string Base64 para armazenar
      const rawId = new Uint8Array(credential.rawId);
      const credentialIdB64 = btoa(String.fromCharCode.apply(null, Array.from(rawId)));

      // Gera uma senha local aleatória e salt
      const localBioPasswordArray = new Uint8Array(32);
      window.crypto.getRandomValues(localBioPasswordArray);
      const localBioPassword = btoa(String.fromCharCode.apply(null, Array.from(localBioPasswordArray)));
      const salt = generateSalt();

      // Deriva a CryptoKey a partir da senha biométrica local
      const cryptoKey = await deriveKey(localBioPassword, salt);

      // Criptografa a Senha Mestra real usando a CryptoKey derivada
      const encryptedMasterPassword = await encryptData(masterPassword, cryptoKey);

      // Salva os dados criptografados e a chave de descriptografia biométrica
      const payload = JSON.stringify({
        encryptedMasterPassword,
        localBioPassword,
        salt
      });
      localStorage.setItem(`${BIOMETRIC_KEY_PREFIX}${emailKey}`, payload);

      // Salva a configuração de biometria
      const config: BiometricConfig = {
        enabled: true,
        credentialId: credentialIdB64,
        registeredAt: new Date().toISOString()
      };
      localStorage.setItem(`${BIOMETRIC_CONFIG_PREFIX}${emailKey}`, JSON.stringify(config));

      return { success: true };
    } catch (err: any) {
      console.error('Erro ao registrar biometria:', err);
      return { success: false, error: err.message || 'Erro desconhecido ao registrar biometria.' };
    }
  },

  /**
   * Verifica se a biometria está ativa para o e-mail informado
   */
  isEnrolled(email: string): boolean {
    const emailKey = email.toLowerCase().trim();
    const configStr = localStorage.getItem(`${BIOMETRIC_CONFIG_PREFIX}${emailKey}`);
    if (!configStr) return false;
    try {
      const config = JSON.parse(configStr) as BiometricConfig;
      return config.enabled && !!config.credentialId;
    } catch {
      return false;
    }
  },

  /**
   * Desativa a biometria para a conta informada
   */
  disableBiometrics(email: string): void {
    const emailKey = email.toLowerCase().trim();
    localStorage.removeItem(`${BIOMETRIC_KEY_PREFIX}${emailKey}`);
    localStorage.removeItem(`${BIOMETRIC_CONFIG_PREFIX}${emailKey}`);
  },

  /**
   * Autentica com biometria e retorna a Senha Mestra descriptografada
   */
  async authenticate(email: string): Promise<{ success: boolean; masterPassword?: string; error?: string }> {
    try {
      const emailKey = email.toLowerCase().trim();
      const configStr = localStorage.getItem(`${BIOMETRIC_CONFIG_PREFIX}${emailKey}`);
      const keyDataStr = localStorage.getItem(`${BIOMETRIC_KEY_PREFIX}${emailKey}`);

      if (!configStr || !keyDataStr) {
        return { success: false, error: 'Biometria não cadastrada para esta conta.' };
      }

      const config = JSON.parse(configStr) as BiometricConfig;
      const keyData = JSON.parse(keyDataStr);

      // Converte o credentialId em base64 de volta para ArrayBuffer
      const rawId = new Uint8Array(
        atob(config.credentialId)
          .split("")
          .map((c) => c.charCodeAt(0))
      );

      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      // Dispara a validação biométrica do sistema operacional
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: challenge,
          allowCredentials: [{
            id: rawId,
            type: "public-key"
          }],
          userVerification: "required",
          timeout: 60000
        }
      });

      if (!assertion) {
        return { success: false, error: 'Falha na autenticação biométrica.' };
      }

      // Deriva a CryptoKey a partir da chave biométrica local salva
      const cryptoKey = await deriveKey(keyData.localBioPassword, keyData.salt);

      // Descriptografa a Senha Mestra usando a CryptoKey
      const masterPassword = await decryptData(keyData.encryptedMasterPassword, cryptoKey);
      return { success: true, masterPassword };
    } catch (err: any) {
      console.error('Erro na autenticação biométrica:', err);
      return { success: false, error: 'A validação biométrica foi cancelada ou falhou.' };
    }
  }
};
