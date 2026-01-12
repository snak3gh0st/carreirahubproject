/**
 * AuthService handles password hashing and verification
 * Uses bcrypt with 12 salt rounds for a good balance between security and performance
 * ~100ms hash time, prevents brute force attacks while remaining fast enough for real-time login
 *
 * NOTE: bcrypt is imported lazily to avoid loading native binaries on every request
 * (dashboard pages import auth.ts which used to load bcrypt at top level)
 */
export class AuthService {
  private saltRounds = 12; // 12 rounds = ~100ms hash time, strong security

  /**
   * Hash a plaintext password using bcrypt
   * @param password - The plaintext password to hash
   * @returns Promise<string> - The bcrypt hash
   * @throws Error if password is less than 8 characters
   *
   * Minimum 8 characters enforces a basic security standard:
   * - Protects against dictionary attacks
   * - Complies with most password policy standards (NIST, OWASP)
   * - Still allows reasonable user experience
   */
  async hashPassword(password: string): Promise<string> {
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    // Lazy import - only load bcrypt when password hashing is needed
    const bcrypt = await import('bcrypt');
    return bcrypt.default.hash(password, this.saltRounds);
  }

  /**
   * Verify a plaintext password against a bcrypt hash
   * @param password - The plaintext password to verify
   * @param hash - The bcrypt hash to compare against
   * @returns Promise<boolean> - True if password matches hash, false otherwise
   *
   * Never throws - returns false on any error (invalid input, format issues, etc)
   * This prevents information leakage about why verification failed
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      // Lazy import - only load bcrypt when password verification is needed
      const bcrypt = await import('bcrypt');
      return await bcrypt.default.compare(password, hash);
    } catch (error) {
      // Return false instead of throwing - prevents info leakage about hash format
      return false;
    }
  }
}

// Export singleton instance
export const authService = new AuthService();
