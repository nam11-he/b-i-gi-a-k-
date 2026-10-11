const BASE_URL = (import.meta.env.VITE_API_URL ?? "/api").replace(/\/+$/, "")
const TOKEN_KEY = "nambede.token"

export const tokenStore = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY),
  set: (token: string): void => localStorage.setItem(TOKEN_KEY, token),
  clear: (): void => localStorage.removeItem(TOKEN_KEY),
}

export class ApiError extends Error {
  /** HTTP status, or 0 when the server could not be reached */
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

let unauthorizedHandler: (() => void) | null = null

/** Called when a request sent with a token gets 401, i.e. the session expired. */
export function onUnauthorized(handler: (() => void) | null): void {
  unauthorizedHandler = handler
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE"
  body?: unknown
  /** Send the saved token (default true). Login and register do not. */
  auth?: boolean
}

/** Calls the gateway. Every request goes through it, never to a service directly. */
export async function api<T>(path: string, { method = "GET", body, auth = true }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" }
  if (body !== undefined) headers["Content-Type"] = "application/json"
  const token = auth ? tokenStore.get() : null
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await send(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  return readJson<T>(response, token)
}

/** Sends a file as multipart/form-data (the browser sets the boundary), e.g. questions from Excel. */
export async function upload<T>(path: string, form: FormData): Promise<T> {
  const token = tokenStore.get()
  const headers: Record<string, string> = { Accept: "application/json" }
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await send(path, { method: "POST", headers, body: form })
  return readJson<T>(response, token)
}

/** Downloads a file with the saved token, then lets the browser save it under `filename`. */
export async function download(path: string, filename: string): Promise<void> {
  const token = tokenStore.get()
  const response = await send(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!response.ok) await readJson(response, token)
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.append(link) // Firefox only follows links that are in the page
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function send(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(BASE_URL + path, init)
  } catch {
    throw new ApiError(0, "Network error")
  }
}

async function readJson<T>(response: Response, token: string | null): Promise<T> {
  const text = await response.text()
  const data: unknown = text ? parseJson(text) : null
  if (!response.ok) {
    if (response.status === 401 && token) {
      tokenStore.clear()
      unauthorizedHandler?.()
    }
    throw new ApiError(response.status, readMessage(data) ?? response.statusText)
  }
  return data as T
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** NamBeDe services answer {"message": ...}; FastAPI's defaults use {"detail": ...}. */
function readMessage(data: unknown): string | null {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>
    if (typeof record.message === "string") return record.message
    if (typeof record.detail === "string") return record.detail
  }
  return null
}

const UNAVAILABLE = "Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau."

const STATUS_TEXT: Record<number, string> = {
  0: "Không kết nối được máy chủ. Vui lòng thử lại.",
  401: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  403: "Bạn không có quyền thực hiện thao tác này.",
  404: "Không tìm thấy dữ liệu.",
  409: "Dữ liệu đã tồn tại.",
  429: "Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau ít phút.",
  502: UNAVAILABLE,
  503: UNAVAILABLE,
  504: UNAVAILABLE,
}

/** Vietnamese message for an error. `overrides` rewords specific status codes for one screen. */
export function errorText(error: unknown, overrides: Record<number, string> = {}): string {
  if (!(error instanceof ApiError)) return "Đã có lỗi xảy ra. Vui lòng thử lại."
  const text = overrides[error.status] ?? STATUS_TEXT[error.status]
  if (text) return text
  if (error.status === 400) return `Dữ liệu không hợp lệ: ${error.message}`
  return "Đã có lỗi xảy ra. Vui lòng thử lại."
}
