import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import type { AuthApi } from "../../api/auth-api";
import { HttpApiError } from "../../api/http-api";
import { AuthPanel } from "./AuthPanel";
import { AuthProvider, useAuth } from "./auth-context";

const authenticated = { user: { id: "user-id", email: "person@example.com" }, csrfToken: "memory-csrf" };

function api(overrides: Partial<AuthApi> = {}): AuthApi {
  return { register: vi.fn(async () => authenticated), login: vi.fn(async () => authenticated), me: vi.fn(async () => { throw new HttpApiError({ kind: "api", status: 401, code: "UNAUTHENTICATED", message: "no" }); }), logout: vi.fn(async () => undefined), ...overrides };
}

function Session() {
  const auth = useAuth();
  return <div><span>{auth.status}</span><span>{auth.user?.email}</span><span>{auth.csrfToken}</span><span>{auth.sessionError}</span><button onClick={() => void auth.logout()}>log out now</button></div>;
}

describe("frontend auth session", () => {
  it("calls me on startup and represents unauthenticated state", async () => {
    const client = api();
    render(<AuthProvider api={client}><Session /></AuthProvider>);
    expect(screen.getByText("unknown")).toBeTruthy();
    expect(await screen.findByText("unauthenticated")).toBeTruthy();
    expect(client.me).toHaveBeenCalledOnce();
  });

  it("initializes the session only once under StrictMode", async () => {
    const client = api();
    render(<StrictMode><AuthProvider api={client}><Session /></AuthProvider></StrictMode>);
    expect(await screen.findByText("unauthenticated")).toBeTruthy();
    expect(client.me).toHaveBeenCalledOnce();
  });

  it("recovers user and CSRF from me and clears memory on logout", async () => {
    const client = api({ me: vi.fn(async () => authenticated) });
    const user = userEvent.setup();
    render(<AuthProvider api={client}><Session /></AuthProvider>);
    expect(await screen.findByText("person@example.com")).toBeTruthy();
    expect(screen.getByText("memory-csrf")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "log out now" }));
    await waitFor(() => expect(client.logout).toHaveBeenCalledWith("memory-csrf"));
    expect(screen.getByText("unauthenticated")).toBeTruthy();
  });

  it("keeps the authenticated state and reports when logout cannot reach the server", async () => {
    const client = api({ me: vi.fn(async () => authenticated), logout: vi.fn(async () => { throw new HttpApiError({ kind: "network", message: "offline" }); }) });
    const user = userEvent.setup();
    render(<AuthProvider api={client}><Session /></AuthProvider>);
    expect(await screen.findByText("person@example.com")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "log out now" }));
    expect(await screen.findByText(/session is still active/)).toBeTruthy();
    expect(screen.getByText("authenticated")).toBeTruthy();
  });

  it("registers and signs in without closing over workspace state", async () => {
    const client = api();
    const user = userEvent.setup();
    render(<AuthProvider api={client}><AuthPanel onClose={() => undefined} /><Session /></AuthProvider>);
    await screen.findByText("unauthenticated");
    await user.click(screen.getByRole("group", { name: "Authentication mode" }).querySelectorAll("button")[1]!);
    await user.type(screen.getByLabelText("Email"), "person@example.com");
    await user.type(screen.getByLabelText("Password"), "password-long");
    await user.click(document.querySelector<HTMLButtonElement>('.auth-form button[type="submit"]')!);
    expect(await screen.findByText("authenticated")).toBeTruthy();
    expect(client.register).toHaveBeenCalledWith("person@example.com", "password-long");
  });

  it("maps login errors without exposing the technical code as primary copy", async () => {
    const client = api({ login: vi.fn(async () => { throw new HttpApiError({ kind: "api", status: 401, code: "INVALID_CREDENTIALS", message: "technical" }); }) });
    const user = userEvent.setup();
    render(<AuthProvider api={client}><AuthPanel onClose={() => undefined} /></AuthProvider>);
    await user.type(screen.getByLabelText("Email"), "person@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(document.querySelector<HTMLButtonElement>('.auth-form button[type="submit"]')!);
    expect((await screen.findByRole("alert")).textContent).toContain("Email or password is incorrect.");
  });
});
