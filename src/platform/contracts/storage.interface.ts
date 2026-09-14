/**
 * Platform Storage Contract
 * Abstracts persistent key-value storage across Web (localStorage/sessionStorage)
 * and Mobile (AsyncStorage / SecureStore).
 */
export interface IPlatformStorage {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
  removeItem(key: string): Promise<void> | void;
  clear(): Promise<void> | void;
}
