export const API_BASE_STORAGE = 'vehicle-viz:api-base-url'

export function getStoredApiBase() {
  try {
    return sessionStorage.getItem(API_BASE_STORAGE)
  } catch {
    return null
  }
}

export function setStoredApiBase(base) {
  try {
    sessionStorage.setItem(API_BASE_STORAGE, base)
  } catch {
    /* ignore */
  }
}

export function clearStoredApiBase() {
  try {
    sessionStorage.removeItem(API_BASE_STORAGE)
  } catch {
    /* ignore */
  }
}
