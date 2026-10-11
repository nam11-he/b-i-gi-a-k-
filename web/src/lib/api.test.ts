import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, ApiError, errorText, onUnauthorized, tokenStore } from "@/lib/api"

describe("errorText", () => {
  it("explains a 400 with the server's message", () => {
    expect(errorText(new ApiError(400, "password: must be at most 72 bytes"))).toBe(
      "Dữ liệu không hợp lệ: password: must be at most 72 bytes"
    )
  })

  it("has a Vietnamese text for the usual statuses", () => {
    expect(errorText(new ApiError(0, "Network error"))).toBe("Không kết nối được máy chủ. Vui lòng thử lại.")
    expect(errorText(new ApiError(403, "Forbidden"))).toBe("Bạn không có quyền thực hiện thao tác này.")
    expect(errorText(new ApiError(404, "Not found"))).toBe("Không tìm thấy dữ liệu.")
    expect(errorText(new ApiError(429, "Too many failed sign-ins, try again in 240 seconds"))).toBe(
      "Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau ít phút."
    )
  })

  it("says the service is unavailable for 502, 503 and 504", () => {
    for (const status of [502, 503, 504]) {
      expect(errorText(new ApiError(status, "learning-service is unavailable"))).toBe(
        "Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau."
      )
    }
  })

  it("lets a screen reword one status", () => {
    expect(errorText(new ApiError(409, "This word is already in your notebook"), { 409: "Từ này đã có trong sổ." })).toBe("Từ này đã có trong sổ.")
    expect(errorText(new ApiError(404, "Word 7 not found"), { 409: "Từ này đã có trong sổ." })).toBe("Không tìm thấy dữ liệu.")
  })

  it("falls back to a general message", () => {
    expect(errorText(new ApiError(500, "Internal server error"))).toBe("Đã có lỗi xảy ra. Vui lòng thử lại.")
    expect(errorText(new Error("boom"))).toBe("Đã có lỗi xảy ra. Vui lòng thử lại.")
  })
})

describe("api", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
    localStorage.clear()
    onUnauthorized(null)
  })

  function reply(status: number, body: unknown) {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }))
  }

  it("calls the gateway with the saved token and returns the JSON", async () => {
    tokenStore.set("jwt-1")
    reply(200, { id: 2, fullName: "Nguyễn Văn A" })

    await expect(api("/users/me")).resolves.toEqual({ id: 2, fullName: "Nguyễn Văn A" })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("/api/users/me")
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer jwt-1")
  })

  it("sends no token to login", async () => {
    tokenStore.set("old-jwt")
    reply(200, { accessToken: "t" })

    await api("/auth/login", { method: "POST", body: { email: "a@nambede.local", password: "x" }, auth: false })

    const [, init] = fetchMock.mock.calls[0]
    expect(new Headers(init?.headers).has("Authorization")).toBe(false)
    expect(init?.body).toBe('{"email":"a@nambede.local","password":"x"}')
  })

  it("throws the message of the shared error body", async () => {
    reply(409, { status: 409, error: "Conflict", message: "Email already in use", path: "/auth/register" })

    await expect(api("/auth/register", { method: "POST", body: {}, auth: false })).rejects.toEqual(
      new ApiError(409, "Email already in use")
    )
  })

  it("reads FastAPI's detail when there is no message", async () => {
    reply(422, { detail: "topicId is required" })

    await expect(api("/questions")).rejects.toMatchObject({ status: 422, message: "topicId is required" })
  })

  it("signs out when a request with a token gets 401", async () => {
    const signedOut = vi.fn()
    onUnauthorized(signedOut)
    tokenStore.set("expired-jwt")
    reply(401, { status: 401, message: "Invalid or expired token" })

    await expect(api("/users/me")).rejects.toMatchObject({ status: 401 })

    expect(tokenStore.get()).toBeNull()
    expect(signedOut).toHaveBeenCalledOnce()
  })

  it("keeps the session when a wrong password gets 401 at login", async () => {
    const signedOut = vi.fn()
    onUnauthorized(signedOut)
    reply(401, { status: 401, message: "Invalid email or password" })

    await expect(api("/auth/login", { method: "POST", body: {}, auth: false })).rejects.toMatchObject({ status: 401 })

    expect(signedOut).not.toHaveBeenCalled()
  })

  it("turns a network failure into status 0", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"))

    await expect(api("/topics")).rejects.toEqual(new ApiError(0, "Network error"))
  })
})
